const canvas = document.getElementById('bugCanvas');
const ctx = canvas.getContext('2d');

let width, height;
const cellSize = 1;
let grid;
let ants = [];
let gridCols = 0, gridRows = 0;
let intervalId = null;
let stepsPerTick;
let isRunning = true;

const initialScale = 8;
let scale = initialScale;
let offsetX = 0;
let offsetY = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let isDragging = false;

const minScale = 0.1;
const maxScale = 50;
const zoomFactor = 1.1;

const slowModeThreshold = 1000 / 16;

const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }
];

let currentIntervalId = null;
let currentIntervalDelay = 0;
let currentStepsPerTick = 1;
let timeoutId = null;

const minSimSpeed = 1;
const midSimSpeed = 60;
const maxSimSpeed = 100000;
const maxStepsPerLoopIteration = 100000;

const cellColors = [
    '#000000',
    '#FFFFFF',
    '#FF00FF',
    '#FFFF00',
    '#00FF00',
    '#00FFFF',
    '#FF0000',
    '#FFA500',
    '#0000FF',
    '#FF69B4'
];
const maxPossibleColors = cellColors.length;

let rules = {};

function generateRandomRules(numStates, numColorsToUse) {
    const newRules = {};
    const moveOptions = ['L', 'R', 'N', 'U'];
    for (let s = 0; s < numStates; s++) {
        newRules[s] = [];
        for (let c = 0; c < numColorsToUse; c++) {
            const writeColor = Math.floor(Math.random() * numColorsToUse);
            const moveIndex = Math.floor(Math.random() * moveOptions.length);
            const move = moveOptions[moveIndex];
            const nextState = Math.floor(Math.random() * numStates);
            newRules[s].push({ writeColor, move, nextState });
        }
    }
    rules = newRules;
}

function generateRandomRulesForAnt(numStates, numColorsToUse) {
    const antSpecificRules = {};
    const moveOptions = ['L', 'R', 'N', 'U'];
    for (let s = 0; s < numStates; s++) {
        antSpecificRules[s] = [];
        for (let c = 0; c < numColorsToUse; c++) {
            const writeColor = Math.floor(Math.random() * numColorsToUse);
            const moveIndex = Math.floor(Math.random() * moveOptions.length);
            const move = moveOptions[moveIndex];
            const nextState = Math.floor(Math.random() * numStates);
            antSpecificRules[s].push({ writeColor, move, nextState });
        }
    }
    return antSpecificRules;
}

let simulationTimeoutId = null;
let nextStepTime = 0;
let renderRequestId = null;
let pauseTime = 0;
let cellsToUpdate = new Set();
let needsFullRedraw = true;

function mapSliderToSpeed(sliderValue) {
    const sliderMin = 1;
    const sliderMax = 100;
    const sliderMid = 50;
    if (sliderValue == sliderMid) {
        return midSimSpeed;
    } else if (sliderValue < sliderMid) {
        const speed = minSimSpeed + (sliderValue - sliderMin) * (midSimSpeed - minSimSpeed) / (sliderMid - sliderMin);
        return Math.max(minSimSpeed, speed);
    } else {
        const power = 3;
        const normalizedInput = (sliderValue - sliderMid) / (sliderMax - sliderMid);
        const scaledOutput = Math.pow(normalizedInput, power);
        const speed = midSimSpeed + scaledOutput * (maxSimSpeed - midSimSpeed);
        return Math.min(maxSimSpeed, speed);
    }
}

function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    setCanvasSmoothing(false);
    needsFullRedraw = true;
    if (!renderRequestId && !isRunning) {
        requestAnimationFrame(draw);
    }
}

function setCanvasSmoothing(enabled) {
    if (!ctx) return;
    ctx.imageSmoothingEnabled = enabled;
    ctx.mozImageSmoothingEnabled = enabled;
    ctx.webkitImageSmoothingEnabled = enabled;
    ctx.msImageSmoothingEnabled = enabled;
}

function initGrid() {
    gridCols = Math.ceil(width / scale);
    gridRows = Math.ceil(height / scale);
    if (gridCols <= 0 || gridRows <= 0) {
        gridCols = 1; gridRows = 1;
    }
    const defaultColorIndex = 0;
    grid = Array(gridRows).fill(null).map(() => Array(gridCols).fill(defaultColorIndex));
}

function updateIndividualRulesVisibility(antCount, rulesDisplayContainer, individualRulesContainer, individualRulesCheck, applyBtn) {
    const showIndividualOption = antCount > 1;
    let mainRuleShouldBeVisible = true;
    let mainRuleDisplayNeedsUpdate = false;
    if (individualRulesContainer) {
        individualRulesContainer.classList.toggle('hidden', !showIndividualOption);
    }
    if (individualRulesCheck) {
        const wasChecked = individualRulesCheck.checked;
        individualRulesCheck.disabled = !showIndividualOption;
        if (!showIndividualOption && wasChecked) {
            individualRulesCheck.checked = false;
            mainRuleShouldBeVisible = true;
            mainRuleDisplayNeedsUpdate = true;
            if(applyBtn) applyBtn.disabled = false;
        } else if (showIndividualOption && wasChecked) {
            mainRuleShouldBeVisible = false;
        }
    } else {
        mainRuleShouldBeVisible = true;
    }
    if (rulesDisplayContainer) {
        const wasHidden = rulesDisplayContainer.classList.contains('hidden');
        rulesDisplayContainer.classList.toggle('hidden', !mainRuleShouldBeVisible);
        if (mainRuleShouldBeVisible && wasHidden) {
            const rulesDisplay = document.getElementById('rulesDisplay');
            if (rulesDisplay) {
                const sourceRules = (ants.length > 0 && ants[0].individualRule) ? ants[0].individualRule : rules;
                const numStatesInRules = Object.keys(sourceRules).length;
                const numColorsInRules = sourceRules[0] ? sourceRules[0].length : 0;
                let rulesString = `// States: ${numStatesInRules}\n`;
                rulesString += `// Colors: ${numColorsInRules}\n`;
                rulesString += `// Moves: L:Left, R:Right, N:None, U:U-Turn\n\n`;
                try { rulesString += JSON.stringify(sourceRules, null, 2); } catch (e) { rulesString = "Error stringifying rules.";}
                rulesDisplay.textContent = rulesString;
            }
        }
    }
}

function initAnts() {
    ants = [];
    cellsToUpdate.clear();
    if (gridCols <= 0 || gridRows <= 0) { return; }
    const antCountInput = document.getElementById('antCountInput');
    const startPositionSelect = document.getElementById('startPositionSelect');
    const individualRulesCheck = document.getElementById('individualRulesCheck');
    const startMode = startPositionSelect ? startPositionSelect.value : 'center';
    const numAntsToCreate = antCountInput ? parseInt(antCountInput.value, 10) : 1;
    const validatedAntCount = Math.max(1, Math.min(1024, numAntsToCreate || 1));
    const useIndividualRules = individualRulesCheck ? individualRulesCheck.checked && validatedAntCount > 1 : false;
    const possibleStatesInput = document.getElementById('possibleStatesInput');
    const possibleColorsInput = document.getElementById('possibleColorsInput');
    const maxStates = possibleStatesInput ? parseInt(possibleStatesInput.value, 10) : 2;
    const maxColors = possibleColorsInput ? parseInt(possibleColorsInput.value, 10) : 2;
    const validatedMaxStates = Math.max(1, Math.min(100, maxStates || 1));
    const validatedMaxColors = Math.max(2, Math.min(maxPossibleColors, maxColors || 2));
    const centerX = Math.floor(gridCols / 2);
    const centerY = Math.floor(gridRows / 2);
    const occupied = new Set();
    for (let i = 0; i < validatedAntCount; i++) {
        let gridX, gridY;
        let attempts = 0;
        const MAX_ATTEMPTS = 2000;
        switch (startMode) {
            case 'random':
                do {
                    gridX = Math.floor(Math.random() * gridCols);
                    gridY = Math.floor(Math.random() * gridRows);
                    attempts++;
                } while (occupied.has(`${gridX},${gridY}`) && attempts < MAX_ATTEMPTS);
                break;
            case 'grid':
                const gridRatio = gridCols / gridRows;
                let cols = Math.ceil(Math.sqrt(validatedAntCount * gridRatio));
                let rows = Math.ceil(validatedAntCount / cols);
                cols = Math.min(cols, gridCols);
                rows = Math.min(rows, gridRows);
                if (cols * rows < validatedAntCount) {
                    rows = Math.ceil(validatedAntCount / cols);
                    if (cols * rows < validatedAntCount) {
                        cols = Math.ceil(validatedAntCount / rows);
                    }
                }
                const spacingX = gridCols / (cols + 1);
                const spacingY = gridRows / (rows + 1);
                const colIndex = i % cols;
                const rowIndex = Math.floor(i / cols);
                gridX = Math.floor(spacingX * (colIndex + 1));
                gridY = Math.floor(spacingY * (rowIndex + 1));
                gridX = Math.max(0, Math.min(gridCols - 1, gridX));
                gridY = Math.max(0, Math.min(gridRows - 1, gridY));
                let originalGridX = gridX;
                let originalGridY = gridY;
                while(occupied.has(`${gridX},${gridY}`) && attempts < 100) {
                    gridX = (originalGridX + attempts) % gridCols;
                    gridY = originalGridY;
                    attempts++;
                }
                break;
            case 'center':
            default:
                const clusterSize = Math.ceil(Math.sqrt(validatedAntCount));
                const offset = Math.floor(clusterSize / 2);
                gridX = centerX - offset + (i % clusterSize);
                gridY = centerY - offset + Math.floor(i / clusterSize);
                gridX = Math.max(0, Math.min(gridCols - 1, gridX));
                gridY = Math.max(0, Math.min(gridRows - 1, gridY));
                break;
        }
        occupied.add(`${gridX},${gridY}`);
        let individualRule = null;
        if (useIndividualRules) {
            const antStates = Math.floor(Math.random() * validatedMaxStates) + 1;
            const antColors = Math.floor(Math.random() * (validatedMaxColors - 1)) + 2;
            individualRule = generateRandomRulesForAnt(antStates, antColors);
        }
        const newAnt = {
            x: gridX, y: gridY, dir: 0, state: 0,
            individualRule: individualRule
        };
        ants.push(newAnt);
        cellsToUpdate.add(`${gridX},${gridY}`);
    }
}

function resetCamera() {
    scale = initialScale;
    const tempGridCols = Math.ceil(width / scale);
    const tempGridRows = Math.ceil(height / scale);
    const tempGridCenterX = tempGridCols / 2 * cellSize;
    const tempGridCenterY = tempGridRows / 2 * cellSize;
    offsetX = width / 2 - tempGridCenterX * scale;
    offsetY = height / 2 - tempGridCenterY * scale;
    setCanvasSmoothing(false);
    cellsToUpdate.clear();
    needsFullRedraw = true;
}

function initSimulation(randomize = false, numStates = 1, numColorsToUse = 2, wasRunning = true) {
    stopSimulationLoop();
    stopRenderLoop();
    const individualRulesCheck = document.getElementById('individualRulesCheck');
    const useIndividual = individualRulesCheck ? individualRulesCheck.checked : false;
    const antCountInput = document.getElementById('antCountInput');
    const antCount = antCountInput ? parseInt(antCountInput.value, 10) : 1;
    if (randomize) {
        generateRandomRules(numStates, numColorsToUse);
    }
    else if (Object.keys(rules).length === 0) {
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
    if (!canvas) { return; }
    canvas.width = width; canvas.height = height;
    const originalScale = scale;
    scale = initialScale;
    initGrid();
    initAnts();
    scale = originalScale;
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
    try { rulesString += JSON.stringify(rules, null, 2); } catch (e) { }
    if (rulesDisplay) rulesDisplay.textContent = rulesString;
    if (applyBtn) applyBtn.disabled = true;
    setCanvasSmoothing(false);
    cellsToUpdate.clear();
    needsFullRedraw = true;
    drawGrid();
    isRunning = wasRunning;
    updateButtonText();
    pauseTime = 0;
    if (individualRulesCheck) {
        individualRulesCheck.disabled = (antCount <= 1);
        if (antCount <= 1 && individualRulesCheck.checked) {
            individualRulesCheck.checked = false;
            if (rulesDisplay) rulesDisplay.classList.remove('hidden');
        }
    }
    if (rulesDisplay) {
        if (useIndividual && antCount > 1) {
            rulesDisplay.classList.add('hidden');
        } else {
            rulesDisplay.classList.remove('hidden');
        }
    }
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
    } else {
        currentIntervalDelay = 1000;
        currentIntervalId = setInterval(runSimulationTick, currentIntervalDelay);
    }
}

function stopSimulation() {
    if (currentIntervalId) {
        clearInterval(currentIntervalId);
        currentIntervalId = null;
    }
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }
}

function updateButtonText() {
    const btn = document.getElementById('startStopBtn');
    if (btn) btn.innerHTML = isRunning ? '❚❚' : '▶';
}

function stepSingleAntLogic(ant) {
    if (!grid || !ant) return;
    if (gridCols <= 0 || gridRows <= 0) return;
    ant.x = (ant.x + gridCols) % gridCols;
    ant.y = (ant.y + gridRows) % gridRows;
    if (!grid[ant.y] || ant.y < 0 || ant.y >= grid.length || ant.x < 0 || ant.x >= grid[ant.y].length) {
        return;
    }
    const currentCellX = ant.x;
    const currentCellY = ant.y;
    const currentCellColor = grid[currentCellY][currentCellX];
    const currentState = ant.state;
    const ruleSetToUse = ant.individualRule || rules;
    let rule;
    if (ruleSetToUse[currentState] && ruleSetToUse[currentState][currentCellColor]) {
        rule = ruleSetToUse[currentState][currentCellColor];
    } else {
        if (ruleSetToUse[currentState] && ruleSetToUse[currentState][0]) {
            rule = ruleSetToUse[currentState][0];
        } else {
            rule = { writeColor: currentCellColor, move: 'N', nextState: 0 };
        }
    }
    if (rule.writeColor !== currentCellColor) {
        grid[currentCellY][currentCellX] = rule.writeColor;
        cellsToUpdate.add(`${currentCellX},${currentCellY}`);
    }
    switch (rule.move) {
        case 'R': ant.dir = (ant.dir + 1) % 4; break;
        case 'L': ant.dir = (ant.dir - 1 + 4) % 4; break;
        case 'U': ant.dir = (ant.dir + 2) % 4; break;
        case 'N': default: break;
    }
    ant.state = rule.nextState;
    const moveOffset = directions[ant.dir];
    ant.x += moveOffset.dx;
    ant.y += moveOffset.dy;
}

function runSimulationTick() {
    if (!isRunning) {
        if (currentIntervalId) clearInterval(currentIntervalId);
        currentIntervalId = null;
        return;
    }
    for (let i = 0; i < currentStepsPerTick; i++) {
        stepSingleAntLogic(ants[i]);
    }
    requestAnimationFrame(draw);
}

function runMaxSpeedLoop() {
    if (!isRunning) {
        timeoutId = null;
        return;
    }
    for (let i = 0; i < currentStepsPerTick; i++) {
        stepSingleAntLogic(ants[i]);
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
    for (let i = 0; i < ants.length; i++) {
        const ant = ants[i];
        if (!ant) continue;
        if (ant.x < 0 || ant.x >= gridCols || ant.y < 0 || ant.y >= gridRows) {
            continue;
        }
        const antCenterX = offsetX + (ant.x + 0.5) * cellSize * scale;
        const antCenterY = offsetY + (ant.y + 0.5) * cellSize * scale;
        const antRadius = (cellSize / 2.5) * scale;
        if (antCenterX + antRadius > 0 && antCenterX - antRadius < width &&
            antCenterY + antRadius > 0 && antCenterY - antRadius < height) {
            ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(antCenterX, antCenterY, antRadius, 0, 2 * Math.PI); ctx.fill();
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
    for (let i = 0; i < ants.length; i++) {
        const ant = ants[i];
        if (!ant) continue;
        if (ant.x < 0 || ant.x >= gridCols || ant.y < 0 || ant.y >= gridRows) {
            continue;
        }
        const antCenterX = offsetX + (ant.x + 0.5) * cellSize * scale;
        const antCenterY = offsetY + (ant.y + 0.5) * cellSize * scale;
        const antRadius = (cellSize / 2.5) * scale;
        if (antCenterX + antRadius > 0 && antCenterX - antRadius < width &&
            antCenterY + antRadius > 0 && antCenterY - antRadius < height)
        {
            ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(antCenterX, antCenterY, antRadius, 0, 2 * Math.PI); ctx.fill();
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
    if (!ctx) { return; }
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
    const antCountInput = document.getElementById('antCountInput');
    const startPositionSelect = document.getElementById('startPositionSelect');
    const possibleStatesInput = document.getElementById('possibleStatesInput');
    const possibleColorsInput = document.getElementById('possibleColorsInput');
    const rulesDisplayContainer = document.getElementById('rulesDisplay')?.parentNode;
    const individualRulesCheck = document.getElementById('individualRulesCheck');
    const individualRulesContainer = document.querySelector('.individual-rules-container');
    const editRuleBtn = document.getElementById('editRuleBtn');
    const ruleLabel = document.querySelector('.rules-display-container label');
    if (!simSpeedSlider || !simSpeedValueSpan || !startStopBtn || !resetBtn || !resetViewBtn || !minimizeBtn || !maximizeBtn || !controlPanel || !rulesDisplay || !applyBtn || !randomizeBtn || !antCountInput || !startPositionSelect || !possibleStatesInput || !possibleColorsInput || !rulesDisplayContainer || !individualRulesCheck || !individualRulesContainer || !editRuleBtn || !ruleLabel) {
        return;
    }
    if (antCountInput && rulesDisplayContainer && individualRulesContainer && individualRulesCheck && applyBtn && rulesDisplay) {
        updateIndividualRulesVisibility( parseInt(antCountInput.value, 10) || 0, rulesDisplayContainer, individualRulesContainer, individualRulesCheck, applyBtn );
        rulesDisplay.classList.add('hidden');
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
    if (antCountInput) {
        antCountInput.addEventListener('input', () => {
            const currentVal = parseInt(antCountInput.value, 10);
            const minVal = parseInt(antCountInput.min, 10);
            const maxVal = 1024;
            if (!isNaN(currentVal)) {
                if (currentVal < minVal) antCountInput.value = minVal;
                else if (currentVal > maxVal) antCountInput.value = maxVal;
            }
            const currentCount = parseInt(antCountInput.value, 10) || 0;
            updateIndividualRulesVisibility(currentCount, rulesDisplayContainer, individualRulesContainer, individualRulesCheck, applyBtn);
            if (applyBtn) applyBtn.disabled = false;
            if (currentCount <= 1 && rulesDisplay && !rulesDisplay.classList.contains('hidden')) {
                rulesDisplay.classList.add('hidden');
            }
        });
    }
    rulesDisplay.addEventListener('input', () => {
        if (applyBtn) applyBtn.disabled = false;
    });
    if (individualRulesCheck) {
        individualRulesCheck.addEventListener('change', () => {
            updateIndividualRulesVisibility(
                parseInt(document.getElementById('antCountInput').value, 10) || 0,
                rulesDisplayContainer,
                individualRulesContainer,
                individualRulesCheck,
                applyBtn
            );
            if (rulesDisplay && individualRulesCheck.checked) {
                rulesDisplay.classList.add('hidden');
            }
            if (applyBtn) applyBtn.disabled = false;
        });
    }
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
            initSimulation(false, undefined, undefined, currentState);
        });
    }
    if (randomizeBtn) {
        randomizeBtn.addEventListener('click', () => {
            const currentState = isRunning;
            const maxStates = possibleStatesInput ? parseInt(possibleStatesInput.value, 10) : 2;
            const maxColors = possibleColorsInput ? parseInt(possibleColorsInput.value, 10) : 2;
            const validatedMaxStates = Math.max(1, Math.min(100, maxStates || 1));
            const validatedMaxColors = Math.max(2, Math.min(maxPossibleColors, maxColors || 2));
            const randomStates = Math.floor(Math.random() * validatedMaxStates) + 1;
            const randomColors = Math.floor(Math.random() * (validatedMaxColors - 1)) + 2;
            initSimulation(true, randomStates, randomColors, currentState);
            if (applyBtn) applyBtn.disabled = true;
        });
    }
    if (startPositionSelect) {
        startPositionSelect.addEventListener('input', () => {
            if (applyBtn) applyBtn.disabled = false;
        });
    }
    if (canvas) {
        canvas.addEventListener('wheel', handleZoom);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        canvas.style.cursor = 'grab';
    }
    if (possibleColorsInput) possibleColorsInput.max = maxPossibleColors;
    const toggleRuleEditor = () => {
        if (rulesDisplay && !individualRulesCheck.checked) {
            rulesDisplay.classList.toggle('hidden');
        }
    };
    if (editRuleBtn) {
        editRuleBtn.addEventListener('click', toggleRuleEditor);
    }
    if (ruleLabel) {
        ruleLabel.addEventListener('click', toggleRuleEditor);
    }
    initSimulation(false, undefined, undefined, true);
});

window.addEventListener('resize', resizeCanvas);

function simulationLoop() {
    if (!isRunning) {
        simulationTimeoutId = null; return;
    }
    const now = performance.now();
    let totalStepsExecutedThisLoop = 0;
    const slider = document.getElementById('simSpeedSlider');
    const targetSpeed = slider ? parseInt(slider.value, 10) : 50;
    const mappedSpeed = mapSliderToSpeed(targetSpeed);
    const stepDuration = (mappedSpeed > 0) ? 1000 / mappedSpeed : Infinity;
    while (now >= nextStepTime && totalStepsExecutedThisLoop < maxStepsPerLoopIteration) {
        for (let i = 0; i < ants.length; i++) {
            const ant = ants[i];
            if (!ant) continue;
            const prevX = ant.x;
            const prevY = ant.y;
            cellsToUpdate.add(`${prevX},${prevY}`);
            stepSingleAntLogic(ant);
            cellsToUpdate.add(`${ant.x},${ant.y}`);
        }
        nextStepTime += stepDuration;
        totalStepsExecutedThisLoop += ants.length;
        if (stepDuration <= 0 || !isFinite(stepDuration)) { break; }
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