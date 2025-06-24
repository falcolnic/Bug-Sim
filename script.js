const canvas = document.getElementById('bugCanvas');
const ctx = canvas.getContext('2d');

let width, height;
const cellSize = 1;
let grid;
let intervalId;
let stepsPerTick;
let isRunning = true;
let bug = [];
let gridCols = 0, gridRows = 0;

let initialScale = 8
let scale = initialScale;
let offsetX = 0;
let offsetY = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let isDragging = false;

const minScale = 0.1;
const maxScale =50;
const zoomFactor = 1.1

const slowModeThreshold = 1000/16;

const directions = [
    {dx: 0, dy: -1},
    {dx: 1, dy: 0},
    {dx: 0, dy: 1},
    {dx: -1, dy: 0}
]

let currentIntervalId = null;
let currentIntervalDelay = 0;
let currentStepsPerTick = 1;
let timeoutId = null;
let minSimSpeed = 1;
const midSimSpeed = 60;
const maxSimSpeed = 100000;
const maxStepsPerLoopIteration = 1000;
const cellColors = [
    '#000000',
    '#FFFFFF',
    '#FF00FF',
    '#FFFF00',
    '#00FF00',
]
const numColors = cellColors.length;
let rules = {}
function generateRandomRules(numStates, numColorsToUse) {
    const newRules = {};
    const moveOptions = ['L', 'R', 'N', 'U']
    for (let s = 0; s < numStates; s++) {
        for (let c = 0; c < numColorsToUse; c++) {
            const writeColor = Math.floor(Math.random() * numColorsToUse);
            const moveIndex = Math.floor(Math.random() * moveOptions.length);
            const move = moveOptions[moveIndex];
            const nextState = Math.floor(Math.random() * numStates);
            newRules[s].push({writeColor, move, nextState});
        }
    }
    rules = newRules;
}

let simulationTimeourId = null;
let nextStepTime = 0;
let renderRequestId = null;
let pauseTime = 0;
let cellsToUpdate = new Set();
let needsFullRedraw = true;

function mapSliderToSpeed(SliderValue) {
    const sliderMin = 1
    const sliderMax = 100;
    const sliderMid = 50;
    if (SliderValue == sliderMid) {
        return midSimSpeed;
    } else if (SliderValue < sliderMid) {
        const speed = minSimSpeed + (SliderValue - sliderMin) * (midSimSpeed - minSimSpeed) / (sliderMid - sliderMin);
        return Math.max(speed, minSimSpeed);
    } else {
        const power = 3;
        const normalizedInput = (SliderValue - sliderMid) / (sliderMax - sliderMid);
        const scaledOutput = Math.pow(normalizedInput, power);
        const speed = midSimSpeed + scaledOutput * (maxSimSpeed - midSimSpeed);
        return Math.min(speed, maxSimSpeed);
    }
}

function updateCanvas() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    setCanvasSmoothing(false)
    needsFullRedraw = true;
    if (!renderRequestId && isRunning) {
        requestAnimationFrame(draw)
    }
}

function setCanvasSmoothing(flag) {
    if (!ctx) return
    ctx.imageSmoothingEnabled = flag;
    ctx.mozImageSmoothingEnabled = flag;
    ctx.webkitImageSmoothingEnabled = flag;
    ctx.msImageSmoothingEnabled = flag;
}

function initGrid() {
    gridCols = Math.floor(width / scale);
    gridRows = Math.floor(height / scale);
    if (gridCols <= 0 || gridRows <= 0) {
        gridCols = 1;
        gridRows = 1;
    }
    const defaultColorIndex = 0;
    grid = Array(gridRows).fill(null).map(() => Array(gridCols).fill(defaultColorIndex));
    console.log(`${gridCols}x${gridRows} scale - ${scale}`);

}

function initBug() {
    bug = [];
    if (gridCols <= 0 || gridRows <= 0) { return;}
    const bugCountInput = document.getElementById('bugCountInput');
    const numBugsCreate = bugCountInput ? parseInt(bugCountInput.value, 10) : 10;
    const validateBugCount = Math.min(1024, Math.max(1, numBugsCreate || 1))

    const centerX = Math.floor(gridCols / 2);
    const centerY = Math.floor(gridRows / 2);
    const clusterSize = Math.ceil(Math.sqrt(validateBugCount));
    const offset = Math.floor(clusterSize / 2);

    for (let i = 0; i < validateBugCount; i++) {
        const gridX = centerX - offset + (i % clusterSize);
        const gridY = centerY - offset + Math.floor(i / clusterSize);
        const newBug = {
            x: gridX,
            y: gridY,
            dir: 0,
            state: 0
        };
        bug.push(newBug);
    }
}

function resetCamera() {
    scale = initialScale;
    const tempGridCols = Math.ceil(width / scale);
    const tempGridRows = Math.ceil(height / scale);
    const tempGridCenterX = tempGridCols / 2 * cellSize;
    const tempGridCenterY = tempGridRows / 2 * cellSize;
    offsetX = width/2 - tempGridCenterX*scale;
    offsetY = height/2 - tempGridCenterY*scale;

    setCanvasSmoothing(false);
    cellsToUpdate.clear();
    needsFullRedraw = true;
}

function initSimulation(randomize = false, numStates = 1, numColorsToUse = 2, wasRunning = true) {
    stopSimulationLoop();
    stopRenderLoop();

    if (randomize) {
        generateRandomRules(numStates, numColorsToUse);
    } else if (Object.keys(rules).length === 0) {
        numStates = 1;
        numColorsToUse = 2;
        rules = {
            0: [
                { writeColor: 1, move: 'R', nextState: 0 },
                { writeColor: 0, move: 'L', nextState: 0 }
            ]
        };
    }

    width = window.innerWidth; height = window.innerHeight;
    if (!canvas) { console.error("Canvas missing!"); return; }
    canvas.width = width; canvas.height = height;
    const originalScale = scale;
    scale = initialScale;
        initGrid();
    initBug();
    scale = originalScale;
    console.log(`Restored scale to ${scale}.`);

    const simSpeedSlider = document.getElementById('simSpeedSlider');
    const simSpeedValueSpan = document.getElementById('simSpeedValue');
    const rulesDisplay = document.getElementById('rulesDisplay');
    const applyBtn = document.getElementById('applyBtn');

    if (!simSpeedSlider || !simSpeedValueSpan || !rulesDisplay || !applyBtn) { return; }
    const initialSliderValue = parseInt(simSpeedSlider.value, 10);
    const initialSimSpeed = mapSliderToSpeed(initialSliderValue);
    simSpeedSlider.value = initialSliderValue;
    simSpeedValueSpan.textContent = Math.round(initialSimSpeed);
    const numStatesInRules = Object.keys(rules).length;
    const numColorsInRules = rules[0] ? rules[0].length : 0;

    let rulesString = `// States: ${numStatesInRules}\n`;
    rulesString += `// Colors: ${numColorsInRules}\n`;
    rulesString += `// Moves: L:Left, R:Right, N:None, U:U-Turn\n\n`;
    try { rulesString += JSON.stringify(rules, null, 2); } catch (e) {  }
    if (rulesDisplay) rulesDisplay.textContent = rulesString;

    if (applyBtn) applyBtn.disabled = true;

    setCanvasSmoothing(false);
    cellsToUpdate.clear();
    needsFullRedraw = true;
    drawGrid();

    isRunning = wasRunning;
    updateButtonText();
    pauseTime = 0;
    if (isRunning) {
        startSimulationLoop();
        startRenderLoop();
    }
}

function startSimulation() {
    stopSimulation();
    if (currentIntervalId || timeoutId) { return; }
    isRunning = true;
    updateButtonText();

    const fpsSlider = document.getElementById('fpsSlider');
    const stepsSlider = document.getElementById('stepsSlider');
    const targetFPS = fpsSlider ? parseInt(fpsSlider.value, 10) : 60;
    currentStepsPerTick = stepsSlider ? parseInt(stepsSlider.value, 10) : 1;
    currentStepsPerTick = Math.max(1, currentStepsPerTick);

    if (targetFPS >= 240) {
        currentIntervalDelay = 0;
        runMaxSpeedLoop();
    } else if (targetFPS >= 1) {
        currentIntervalDelay = Math.round(1000 / targetFPS);
        currentIntervalId = setInterval(runSimulationTick, currentIntervalDelay);
        console.log(` -> intervalId set: ${currentIntervalId}`);
    } else {
        currentIntervalDelay = 1000;
        currentIntervalId = setInterval(runSimulationTick, currentIntervalDelay);
        console.log(` -> intervalId set (fallback): ${currentIntervalId}`);
    }
}

function stopSimulation() {
    if (currentIntervalId) {
        console.log(`Clearing intervalId: ${currentIntervalId}`);
        clearInterval(currentIntervalId);
        currentIntervalId = null;
    }
    if (timeoutId) {
        console.log(`Clearing timeoutId: ${timeoutId}`);
        clearTimeout(timeoutId);
        timeoutId = null;
    }
    console.log("Simulation timer/loop stopped.");
}

function updateButtonText() {
    const btn = document.getElementById('startStopBtn');
    if (btn) btn.innerHTML = isRunning ? '❚❚' : '▶';
}

function stepSingleBugLogic(b) {
    if (!grid || !b) return;
    if (gridCols <= 0 || gridRows <= 0) return;

    b.x = (b.x + gridCols) % gridCols;
    b.y = (b.y + gridRows) % gridRows;

    if (!grid[b.y] || b.y < 0 || b.y >= grid.length || b.x < 0 || b.x >= grid[b.y].length) {
        return;
    }

    const currentCellX = b.x;
    const currentCellY = b.y;
    const currentCellColor = grid[currentCellY][currentCellX];
    const currentState = b.state;

    let rule;
    try { rule = rules[currentState][currentCellColor]; }
    catch (e) { console.error(`Rule lookup failed! State: ${currentState}, Color: ${currentCellColor}`, e); isRunning = false; stopSimulationLoop(); stopRenderLoop(); updateButtonText(); return; }
    if (!rule) { console.error(`No rule found for State: ${currentState}, Color: ${currentCellColor}`); isRunning = false; stopSimulationLoop(); stopRenderLoop(); updateButtonText(); return; }

    if (rule.writeColor !== currentCellColor) {
        grid[currentCellY][currentCellX] = rule.writeColor;
        cellsToUpdate.add(`${currentCellX},${currentCellY}`);
    }

    switch (rule.move) {
        case 'R': b.dir = (b.dir + 1) % 4; break;
        case 'L': b.dir = (b.dir - 1 + 4) % 4; break;
        case 'U': b.dir = (b.dir + 2) % 4; break;
        case 'N': default: break;
    }

    b.state = rule.nextState;

    const moveOffset = directions[b.dir];
    b.x += moveOffset.dx;
    b.y += moveOffset.dy;
}

function runSimulationTick() {
    if (!isRunning) {
        if (currentIntervalId) clearInterval(currentIntervalId);
        currentIntervalId = null;
        return;
    }
    for (let i = 0; i < currentStepsPerTick; i++) {
        stepSingleBugLogic(bug[i]);
    }
    requestAnimationFrame(draw);
}
function runMaxSpeedLoop() {
    if (!isRunning) {
        timeoutId = null;
        return;
    }

    for (let i = 0; i < currentStepsPerTick; i++) {
        stepSingleBugLogic(bug[i]);
    }
    requestAnimationFrame(draw);
    timeoutId = setTimeout(runMaxSpeedLoop, 0);
}

function drawGrid() {
    if (!grid || !grid.length || !grid[0].length || !ctx) return;
    setCanvasSmoothing(false);

    if (gridCols <= 0 || gridRows <= 0) { return; }

    const viewX1 = -offsetX / scale, viewY1 = -offsetY / scale;
    const viewX2 = (width - offsetX) / scale, viewY2 = (height - offsetY) / scale;
    const cellSize = 1;
    const buffer = 2;
    const startCol = Math.max(0, Math.floor(viewX1 / cellSize) - buffer);
    const endCol = Math.min(gridCols, Math.ceil(viewX2 / cellSize) + buffer);
    const startRow = Math.max(0, Math.floor(viewY1 / cellSize) - buffer);
    const endRow = Math.min(gridRows, Math.ceil(viewY2 / cellSize) + buffer);

    for (let y = startRow; y < endRow; y++) {
        if (y < 0 || y >= grid.length || !grid[y]) continue;
        for (let x = startCol; x < endCol; x++) {
            if (x < 0 || x >= grid[y].length) continue;

            const colorIndex = grid[y][x];
            if (colorIndex >= 0 && colorIndex < cellColors.length) {
                ctx.fillStyle = cellColors[colorIndex];

                 const px = Math.floor(offsetX + x * cellSize * scale);
                 const py = Math.floor(offsetY + y * cellSize * scale);
                 const pw = Math.ceil(cellSize * scale);
                 const ph = Math.ceil(cellSize * scale);

                if (px + pw > 0 && px < width && py + ph > 0 && py < height) {
                    ctx.fillRect(px, py, pw, ph);
                }
            }
        }
    }

    setCanvasSmoothing(true);
    for (let i = 0; i < bug.length; i++) {
        const b = bug[i];
        if (!b) continue;

        if (b.x < 0 || b.x >= gridCols || b.y < 0 || b.y >= gridRows) {
            continue;
        }

        const bugCenterX = offsetX + (b.x + 0.5) * cellSize * scale;
        const bugCenterY = offsetY + (b.y + 0.5) * cellSize * scale;
        const bugRadius = (cellSize / 2.5) * scale;

        if (bugCenterX + bugRadius > 0 && bugCenterX - bugRadius < width &&
            bugCenterY + bugRadius > 0 && bugCenterY - bugRadius < height) {
            ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(bugCenterX, bugCenterY, bugRadius, 0, 2 * Math.PI); ctx.fill();
        }
    }
    setCanvasSmoothing(false);
}

function drawUpdates() {
    if (!ctx) return;
    setCanvasSmoothing(false);
    const cellSize = 1;

    cellsToUpdate.forEach(coordString => {
        const [xStr, yStr] = coordString.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);

        if (isNaN(x) || isNaN(y) || y < 0 || y >= grid.length || x < 0 || x >= grid[y].length) return;

        const colorIndex = grid[y][x];
        if (colorIndex >= 0 && colorIndex < cellColors.length) {
            ctx.fillStyle = cellColors[colorIndex];
             const px = Math.floor(offsetX + x * cellSize * scale);
             const py = Math.floor(offsetY + y * cellSize * scale);
             const pw = Math.ceil(cellSize * scale);
             const ph = Math.ceil(cellSize * scale);
            if (px + pw > 0 && px < width && py + ph > 0 && py < height) {
                ctx.fillRect(px, py, pw, ph);
            }
        }
    });

    setCanvasSmoothing(true);
    for (let i = 0; i < bug.length; i++) {
        const b = bug[i];
        if (!b) continue;

        if (b.x < 0 || b.x >= gridCols || b.y < 0 || b.y >= gridRows) {
            continue;
        }

        const bugCenterX = offsetX + (b.x + 0.5) * cellSize * scale;
        const bugCenterY = offsetY + (b.y + 0.5) * cellSize * scale;
        const bugRadius = (cellSize / 2.5) * scale;
        if (bugCenterX + bugRadius > 0 && bugCenterX - bugRadius < width &&
            bugCenterY + bugRadius > 0 && bugCenterY - bugRadius < height)
        {
            ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(bugCenterX, bugCenterY, bugRadius, 0, 2 * Math.PI); ctx.fill();
        }
    }
    setCanvasSmoothing(false);

    cellsToUpdate.clear();
}

function draw() {
    if (!ctx) return;

    if (needsFullRedraw) {
        ctx.fillStyle = '#555555';
        ctx.fillRect(0, 0, width, height);
        drawGrid();
        needsFullRedraw = false;
    } else {
        drawUpdates();
    }
}

function handleZoom(event) {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const worldX = (mouseX - offsetX) / scale;
    const worldY = (mouseY - offsetY) / scale;

    let newScale;
    if (event.deltaY < 0) {
        newScale = Math.min(maxScale, scale * zoomFactor);
    } else {
        newScale = Math.max(minScale, scale / zoomFactor);
    }

    offsetX = mouseX - worldX * newScale;
    offsetY = mouseY - worldY * newScale;
    scale = newScale;
    setCanvasSmoothing(false);
    needsFullRedraw = true;
    if (!renderRequestId && !isRunning) requestAnimationFrame(draw);
}
function handleMouseDown(event) {
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    lastMouseX = event.clientX - rect.left;
    lastMouseY = event.clientY - rect.top;
    canvas.style.cursor = 'grabbing';
}

function handleMouseUp(event) {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab';
    }
}
function handleMouseMove(event) {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    offsetX += mouseX - lastMouseX;
    offsetY += mouseY - lastMouseY;

    lastMouseX = mouseX;
    lastMouseY = mouseY;

    needsFullRedraw = true;
    if (!renderRequestId && !isRunning) requestAnimationFrame(draw);
}
function handleMouseLeave(event) {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab';
    }
}
window.addEventListener('keydown', (event) => {
    if (event.target === document.getElementById('rulesDisplay')) {
        return;
    }
    if (event.code === 'Space') {
        event.preventDefault();
        const btn = document.getElementById('startStopBtn');
        if (btn) btn.click();
    }
    else if (event.key === 'r' || event.key === 'R') {
        const btn = document.getElementById('randomizeBtn');
        if (btn) btn.click();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (!ctx) { console.error("Canvas context not found on DOMContentLoaded!"); return; }

    const simSpeedSlider = document.getElementById('simSpeedSlider');
    const simSpeedValueSpan = document.getElementById('simSpeedValue');
    const startStopBtn = document.getElementById('startStopBtn');
    const resetBtn = document.getElementById('resetBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const maximizeBtn = document.getElementById('maximizeBtn');
    const controlPanel = document.getElementById('controlPanel');
    const rulesDisplay = document.getElementById('rulesDisplay');
    const applyBtn = document.getElementById('applyBtn');
    const randomizeBtn = document.getElementById('randomizeBtn');
    const bugCountInput = document.getElementById('bugCountInput');

    if (!simSpeedSlider || !simSpeedValueSpan || !startStopBtn || !resetBtn || !resetViewBtn || !minimizeBtn || !maximizeBtn || !controlPanel || !rulesDisplay || !applyBtn || !randomizeBtn || !bugCountInput) {
        if (!simSpeedSlider) console.error("- simSpeedSlider is null");
        if (!simSpeedValueSpan) console.error("- simSpeedValueSpan is null");
        if (!startStopBtn) console.error("- startStopBtn is null");
        if (!resetBtn) console.error("- resetBtn is null");
        if (!resetViewBtn) console.error("- resetViewBtn is null");
        if (!minimizeBtn) console.error("- minimizeBtn is null");
        if (!maximizeBtn) console.error("- maximizeBtn is null");
        if (!controlPanel) console.error("- controlPanel is null");
        if (!rulesDisplay) console.error("- rulesDisplay is null");
        if (!applyBtn) console.error("- applyBtn is null");
        if (!randomizeBtn) console.error("- randomizeBtn is null");
        return;
    }

    startStopBtn.addEventListener('click', () => {
        if (isRunning) {
            isRunning = false;
            stopSimulationLoop();
            stopRenderLoop();
        } else {
            isRunning = true;
            startSimulationLoop();
            startRenderLoop();
        }
        updateButtonText();
    });
    resetBtn.addEventListener('click', () => {
        const currentState = isRunning;
        initSimulation(false, undefined, undefined, currentState);
        if (applyBtn) applyBtn.disabled = true;
    });
    resetViewBtn.addEventListener('click', resetCamera);
    minimizeBtn.addEventListener('click', () => {
        controlPanel.classList.add('minimized');
    });
    maximizeBtn.addEventListener('click', () => {
        controlPanel.classList.remove('minimized');
    });
    simSpeedSlider.addEventListener('input', () => {
        const sliderValue = parseInt(simSpeedSlider.value, 10);
        const newSpeed = mapSliderToSpeed(sliderValue);
        simSpeedValueSpan.textContent = Math.round(newSpeed);
    });

    if (bugCountInput) {
        bugCountInput.addEventListener('input', () => {
            const currentVal = parseInt(bugCountInput.value, 10);
            const minVal = parseInt(bugCountInput.min, 10);
            const maxVal = 1024;
            if (!isNaN(currentVal)) {
                if (currentVal < minVal) bugCountInput.value = minVal;
                else if (currentVal > maxVal) bugCountInput.value = maxVal;
            }
            if (applyBtn) applyBtn.disabled = false;
        });
    }
    rulesDisplay.addEventListener('input', () => {
        if (applyBtn) applyBtn.disabled = false;
    });

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            let rulesChanged = false;
            if (rulesDisplay) {
                try {
                    let rulesText = rulesDisplay.textContent;
                    const rulesWithoutComments = rulesText.replace(/^\s*\/\/.*$/gm, '').trim();
                    const parsedRules = JSON.parse(rulesWithoutComments);
                    if (typeof parsedRules !== 'object' || parsedRules === null) throw new Error("Invalid rules object.");
                    if (JSON.stringify(rules) !== JSON.stringify(parsedRules)) {
                        rules = parsedRules;
                        rulesChanged = true;
                    }
                } catch (e) {
                    alert(`Error parsing rules: ${e.message}\nPlease correct the rules definition.`);
                    return;
                }
            }

            applyBtn.disabled = true;
            const currentState = isRunning;
            console.log("Resetting simulation to apply changes.");
            initSimulation(false, undefined, undefined, currentState);
        });
    }
    if (randomizeBtn) {
        randomizeBtn.addEventListener('click', () => {
            const currentState = isRunning;
            const randomStates = Math.floor(Math.random() * 8) + 1;
            const randomColors = Math.floor(Math.random() * (numColors - 1)) + 2;
            initSimulation(true, randomStates, randomColors, currentState);
            if (applyBtn) applyBtn.disabled = true;
        });
    }

    if (canvas) {
        canvas.addEventListener('wheel', handleZoom);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        canvas.style.cursor = 'grab';
    } else {
        console.error("Canvas element not found for Pan/Zoom listeners!");
    }
    initSimulation(false, undefined, undefined, true);
});
window.addEventListener('resize', resizeCanvas);
function simulationLoop() {
    if (!isRunning) {
        simulationTimeoutId = null;
        return;
    }
    const now = performance.now();
    let totalStepsExecutedThisLoop = 0;
    const slider = document.getElementById('simSpeedSlider');
    const targetSpeed = slider ? parseInt(slider.value, 10) : 50;
    const mappedSpeed = mapSliderToSpeed(targetSpeed);
    const stepDuration = (mappedSpeed > 0) ? 1000 / mappedSpeed : Infinity;

    while (now >= nextStepTime && totalStepsExecutedThisLoop < maxStepsPerLoopIteration) {
        for (let i = 0; i < bug.length; i++) {
            const b = bug[i];
            if (!b) continue;
            const prevX = b.x;
            const prevY = b.y;
            cellsToUpdate.add(`${prevX},${prevY}`);
            stepSingleBugLogic(b);
            cellsToUpdate.add(`${b.x},${b.y}`);
        }
        nextStepTime += stepDuration;
        totalStepsExecutedThisLoop += bug.length;
        if (stepDuration <= 0 || !isFinite(stepDuration)) {  break; }
    }
    if (totalStepsExecutedThisLoop >= maxStepsPerLoopIteration) {
        nextStepTime = performance.now() + stepDuration;
    }
    const timeToNext = Math.max(0, nextStepTime - performance.now());
    simulationTimeoutId = setTimeout(simulationLoop, timeToNext);
}

function startSimulationLoop() {
    if (simulationTimeoutId) return;
    if (pauseTime > 0) {
        const elapsedPausedTime = performance.now() - pauseTime;
        nextStepTime += elapsedPausedTime;
        pauseTime = 0;
    } else {
        nextStepTime = performance.now();
        console.log(`Starting fresh. Initial nextStepTime ${nextStepTime.toFixed(0)}`);
    }

    const timeToFirstCall = Math.max(0, nextStepTime - performance.now());
    simulationTimeoutId = setTimeout(simulationLoop, timeToFirstCall);
}

function stopSimulationLoop() {
    if (simulationTimeoutId) {
        clearTimeout(simulationTimeoutId);
        simulationTimeoutId = null;
        pauseTime = performance.now();
    }
}
function renderLoop() {
    if (!isRunning) {
        renderRequestId = null;
        return;
    }
    draw();
    renderRequestId = requestAnimationFrame(renderLoop);
}

function startRenderLoop() {
    if (renderRequestId) return;
    renderRequestId = requestAnimationFrame(renderLoop);
}
function stopRenderLoop() {
    if (renderRequestId) {
        cancelAnimationFrame(renderRequestId);
        renderRequestId = null;
    }
}
function calculateSimDelay(targetStepsPerSec) {
    if (targetStepsPerSec <= 0) return 10000;
    const delay = 1000 / targetStepsPerSec;
    return Math.max(0, Math.min(10000, delay));
}
