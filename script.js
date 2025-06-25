const canvas = document.getElementById('antCanvas');
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
    '#FF69B4',
    '#DA70D6',
    '#8A2BE2'
];
const maxPossibleColors = cellColors.length;

let rules = {};

let lastAppliedState = {};

function generateRandomRules(numStates, numColorsToUse) {
    const newRules = {};
    const moveOptions = ['L', 'R', 'N', 'U', 'S'];

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
    const moveOptions = ['L', 'R', 'N', 'U', 'S'];
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

function updateIndividualRulesVisibility(antCount, rulesDisplayContainer, individualRulesContainer, individualRulesCheck, rulesDisplayPre) {
    const showIndividualOption = antCount > 1;
    if (individualRulesContainer) {
        individualRulesContainer.classList.toggle('hidden', !showIndividualOption);
    }
    let isIndividualChecked = false;
    if (individualRulesCheck) {
        individualRulesCheck.disabled = !showIndividualOption;
        if (!showIndividualOption && individualRulesCheck.checked) {
            individualRulesCheck.checked = false;
            const applyBtn = document.getElementById('applyBtn');
            if (applyBtn) applyBtn.disabled = false;
        }
        isIndividualChecked = individualRulesCheck.checked;
    }
    if (rulesDisplayContainer) {
        rulesDisplayContainer.classList.toggle('hidden', isIndividualChecked);
    }
    if (rulesDisplayPre && isIndividualChecked) {
        rulesDisplayPre.classList.add('hidden');
    }
}

function initAnts(preservedIndividualRules = null) {
    ants = [];
    cellsToUpdate.clear();
    if (gridCols <= 0 || gridRows <= 0) { return; }

    const antCountInput = document.getElementById('antCountInput');
    const startPositionSelect = document.getElementById('startPositionSelect');
    const startDirectionSelect = document.getElementById('startDirectionSelect');
    const individualRulesCheck = document.getElementById('individualRulesCheck');
    const rulesDisplayPre = document.getElementById('rulesDisplay');
    const saveRuleBtn = document.getElementById('saveRuleBtn');
    const loadRuleBtn = document.getElementById('loadRuleBtn');
    const presetSelect = document.getElementById('presetSelect');

    const startMode = startPositionSelect ? startPositionSelect.value : 'center';
    const startDirMode = startDirectionSelect ? startDirectionSelect.value : '0';
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
                if (attempts >= MAX_ATTEMPTS) {
                }
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
            case 'row':
                const rowWidth = Math.min(validatedAntCount, gridCols);
                const numRows = Math.ceil(validatedAntCount / gridCols);
                const startX = Math.floor(centerX - rowWidth / 2);
                const startY = Math.floor(centerY - numRows / 2);
                const colOffset = i % gridCols;
                const rowOffset = Math.floor(i / gridCols);
                gridX = startX + colOffset;
                gridY = startY + rowOffset;
                if (occupied.has(`${gridX},${gridY}`)) {
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
        gridX = Math.max(0, Math.min(gridCols - 1, gridX || 0));
        gridY = Math.max(0, Math.min(gridRows - 1, gridY || 0));
        occupied.add(`${gridX},${gridY}`);
        let individualRule = null;
        if (useIndividualRules) {
            if (preservedIndividualRules && i < preservedIndividualRules.length && preservedIndividualRules[i]) {
                individualRule = preservedIndividualRules[i];
            } else {
                const antStates = Math.floor(Math.random() * validatedMaxStates) + 1;
                const antColors = Math.floor(Math.random() * (validatedMaxColors - 1)) + 2;
                individualRule = generateRandomRulesForAnt(antStates, antColors);
            }
        }
        let initialDir = 0;
        if (startDirMode === 'random') {
            initialDir = Math.floor(Math.random() * 4);
        } else {
            const dirValue = parseInt(startDirMode, 10);
            if (!isNaN(dirValue) && dirValue >= 0 && dirValue < 4) {initialDir = dirValue;}
        }
        const newAnt = {
            x: gridX, y: gridY,
            dir: initialDir,
            state: 0,
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
    let preservedIndividualRules = null;
    if (!randomize && useIndividual && antCount > 0 && ants.length > 0) {
        preservedIndividualRules = ants.map(ant => ant?.individualRule).filter(rule => rule);
    }
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
    initAnts(preservedIndividualRules);
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
    rulesString += `// Moves: L:Left, R:Right, N:None, U:U-Turn, S:Stay\n\n`;
    try { rulesString += JSON.stringify(rules, null, 2); } catch (e) { rulesString = "Error stringifying rules.";}
    if (rulesDisplay) rulesDisplay.textContent = rulesString;
    if (applyBtn) applyBtn.disabled = true;
    const discardBtn = document.getElementById('discardBtn');
    if (discardBtn) discardBtn.disabled = true;
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
        }
    }

    if (isRunning) {
        startSimulationLoop();
        startRenderLoop();
    }

    const currentAntCount = antCountInput ? antCountInput.value : '1';
    const currentStartPosition = startPositionSelect ? startPositionSelect.value : 'center';
    const currentStartDirection = startDirectionSelect ? startDirectionSelect.value : '0';
    const currentMaxStates = possibleStatesInput ? possibleStatesInput.value : '2';
    const currentMaxColors = possibleColorsInput ? possibleColorsInput.value : '2';
    const currentIndividualChecked = individualRulesCheck ? individualRulesCheck.checked : false;
    const currentRulesText = rulesDisplay ? rulesDisplay.textContent : '';

    lastAppliedState = {
        antCount: currentAntCount,
        startPosition: currentStartPosition,
        startDirection: currentStartDirection,
        maxStates: currentMaxStates,
        maxColors: currentMaxColors,
        individualChecked: currentIndividualChecked,
        rulesText: currentRulesText
    };
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
    try {
        if (ruleSetToUse[currentState] && ruleSetToUse[currentState][currentCellColor]) {
            rule = ruleSetToUse[currentState][currentCellColor];
        } else {
            if (ruleSetToUse[currentState] && ruleSetToUse[currentState][0]) {
                rule = ruleSetToUse[currentState][0];
            } else {
                rule = { writeColor: currentCellColor, move: 'N', nextState: 0 };
            }
        }
    } catch (e) {
        return;
    }

    if (rule.writeColor !== currentCellColor) {
        grid[currentCellY][currentCellX] = rule.writeColor;
        cellsToUpdate.add(`${currentCellX},${currentCellY}`);
    }
    let dx = 0, dy = 0;
    switch (rule.move) {
        case 'R': ant.dir = (ant.dir + 1) % 4; break;
        case 'L': ant.dir = (ant.dir - 1 + 4) % 4; break;
        case 'U': ant.dir = (ant.dir + 2) % 4; break;
        case 'S': break;
        case 'N': default: break;
    }
    if (rule.move !== 'S') {
        const moveOffset = directions[ant.dir];
        if (moveOffset) {
            dx = moveOffset.dx;
            dy = moveOffset.dy;
        }
    }
    ant.state = rule.nextState;
    ant.x += dx;
    ant.y += dy;
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
function drawAntShape(ant) {
    if (ant.x < 0 || ant.x >= gridCols || ant.y < 0 || ant.y >= gridRows) return;
    const cellSize = 1;
    const antCenterX = offsetX + (ant.x + 0.5) * cellSize * scale;
    const antCenterY = offsetY + (ant.y + 0.5) * cellSize * scale;
    const antSize = (cellSize * scale) * 0.8;
    const antRadius = antSize / 2.5;
    if (!(antCenterX + antSize > 0 && antCenterX - antSize < width &&
        antCenterY + antSize > 0 && antCenterY - antSize < height)) {
        return;
    }
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(antCenterX, antCenterY, antRadius, 0, 2 * Math.PI);
    ctx.fill();
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
        if (ants[i]) drawAntShape(ants[i]);
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
        if (ants[i]) drawAntShape(ants[i]);
    }
    setCanvasSmoothing(false);
    cellsToUpdate.clear();
}
function draw() {
    if (!ctx) return;
    if (needsFullRedraw) {
        ctx.fillStyle = '#222222';
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
    } else {newScale = Math.max(minScale, scale / zoomFactor);}
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
    else if (event.key === 'f' || event.key === 'F') {
        const btn = document.getElementById('randomizeBtn');
        if (btn) btn.click();
    }
    else if (event.key === 'r' || event.key === 'R') {
        const btn = document.getElementById('resetBtn');
        if (btn) btn.click();
    }
});
document.addEventListener('DOMContentLoaded', () => {
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
    const startDirectionSelect = document.getElementById('startDirectionSelect');
    const rulesDisplayPre = document.getElementById('rulesDisplay');
    const saveRuleBtn = document.getElementById('saveRuleBtn');
    const loadRuleBtn = document.getElementById('loadRuleBtn');
    const discardBtn = document.getElementById('discardBtn');
    const presetSelect = document.getElementById('presetSelect');

    if (!simSpeedSlider || !simSpeedValueSpan || !startStopBtn || !resetBtn || !resetViewBtn || !minimizeBtn || !maximizeBtn || !controlPanel || !rulesDisplay || !applyBtn || !randomizeBtn || !antCountInput || !startPositionSelect || !possibleStatesInput || !possibleColorsInput || !rulesDisplayContainer || !individualRulesCheck || !individualRulesContainer || !editRuleBtn || !ruleLabel || !startDirectionSelect || !rulesDisplayPre || !saveRuleBtn || !loadRuleBtn || !discardBtn || !presetSelect) {
        return;
    }

    if (antCountInput && rulesDisplayContainer && individualRulesContainer && individualRulesCheck && rulesDisplayPre) {
        updateIndividualRulesVisibility(
            parseInt(antCountInput.value, 10) || 0,
            rulesDisplayContainer,
            individualRulesContainer,
            individualRulesCheck,
            rulesDisplayPre
        );
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
        const discardBtn = document.getElementById('discardBtn');
        if (discardBtn) discardBtn.disabled = true;
        if (antCountInput && rulesDisplayContainer && individualRulesContainer && individualRulesCheck && rulesDisplayPre) {
            updateIndividualRulesVisibility(
                parseInt(antCountInput.value, 10) || 0,
                rulesDisplayContainer,
                individualRulesContainer,
                individualRulesCheck,
                rulesDisplayPre
            );
        }
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
            if (rulesDisplayContainer && individualRulesContainer && individualRulesCheck && rulesDisplayPre) {
                updateIndividualRulesVisibility(currentCount, rulesDisplayContainer, individualRulesContainer, individualRulesCheck, rulesDisplayPre);
            }
            if (applyBtn) applyBtn.disabled = false;
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = false;
            if (presetSelect) presetSelect.value = 'custom';
        });
    }
    rulesDisplay.addEventListener('input', () => {
        if (applyBtn) applyBtn.disabled = false;
        const discardBtn = document.getElementById('discardBtn');
        if (discardBtn) discardBtn.disabled = false;
        if (presetSelect) presetSelect.value = 'custom';
    });
    if (individualRulesCheck) {
        individualRulesCheck.addEventListener('change', () => {
            updateIndividualRulesVisibility(
                parseInt(document.getElementById('antCountInput').value, 10) || 0,
                rulesDisplayContainer,
                individualRulesContainer,
                individualRulesCheck,
                rulesDisplayPre
            );
            if (applyBtn) applyBtn.disabled = false;
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = false;
            if (presetSelect) presetSelect.value = 'custom';
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
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = true;
            const currentState = isRunning;
            initSimulation(false, undefined, undefined, currentState);
            if (antCountInput && rulesDisplayContainer && individualRulesContainer && individualRulesCheck && rulesDisplayPre) {
                updateIndividualRulesVisibility(
                    parseInt(antCountInput.value, 10) || 0,
                    rulesDisplayContainer,
                    individualRulesContainer,
                    individualRulesCheck,
                    rulesDisplayPre
                );
            }
        });
    }
    if (randomizeBtn) {
        randomizeBtn.addEventListener('click', () => {
            const currentState = isRunning;
            const maxStates = possibleStatesInput ? parseInt(possibleStatesInput.value, 10) : 2;
            const maxColors = possibleColorsInput ? parseInt(possibleColorsInput.value, 10) : 2;
            const validatedMaxStates = Math.max(1, Math.min(1000, maxStates || 1));
            const validatedMaxColors = Math.max(2, Math.min(maxPossibleColors, maxColors || 2));
            const randomStates = Math.floor(Math.random() * validatedMaxStates) + 1;
            const randomColors = Math.floor(Math.random() * (validatedMaxColors - 1)) + 2;
            initSimulation(true, randomStates, randomColors, currentState);
            if (applyBtn) applyBtn.disabled = true;
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = true;
            if (antCountInput && rulesDisplayContainer && individualRulesContainer && individualRulesCheck && rulesDisplayPre) {
                updateIndividualRulesVisibility(
                    parseInt(antCountInput.value, 10) || 0,
                    rulesDisplayContainer,
                    individualRulesContainer,
                    individualRulesCheck,
                    rulesDisplayPre
                );
            }
        });
    }
    if (startPositionSelect) {
        startPositionSelect.addEventListener('input', () => {
            if (applyBtn) applyBtn.disabled = false;
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = false;
            if (presetSelect) presetSelect.value = 'custom';
        });
    }

    if (startDirectionSelect) {
        startDirectionSelect.addEventListener('input', () => {
            if (applyBtn) applyBtn.disabled = false;
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = false;
            if (presetSelect) presetSelect.value = 'custom';
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
        const rulesEditorPre = document.getElementById('rulesDisplay');
        if (rulesEditorPre && !individualRulesCheck.checked) {
            rulesEditorPre.classList.toggle('hidden');
        }
    };
    if (editRuleBtn) {
        editRuleBtn.addEventListener('click', toggleRuleEditor);
    }

    if (possibleStatesInput) {
        possibleStatesInput.addEventListener('input', () => {
            const input = possibleStatesInput;
            const currentVal = parseInt(input.value, 10);
            const minVal = parseInt(input.min, 10);
            const maxVal = parseInt(input.max, 10);
            if (!isNaN(currentVal)) {
                if (currentVal < minVal) input.value = minVal;
                else if (currentVal > maxVal) input.value = maxVal;
            }
            if (applyBtn) applyBtn.disabled = false;
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = false;
            if (presetSelect) presetSelect.value = 'custom';
        });
    }

    if (possibleColorsInput) {
        possibleColorsInput.addEventListener('input', () => {
            const input = possibleColorsInput;
            const currentVal = parseInt(input.value, 10);
            const minVal = parseInt(input.min, 10);
            const maxVal = parseInt(input.max, 10);
            if (!isNaN(currentVal)) {
                if (currentVal < minVal) input.value = minVal;
                else if (currentVal > maxVal) input.value = maxVal;
            }
            if (applyBtn) applyBtn.disabled = false;
            const discardBtn = document.getElementById('discardBtn');
            if (discardBtn) discardBtn.disabled = false;
            if (presetSelect) presetSelect.value = 'custom';
        });
    }

    if (saveRuleBtn) {
        saveRuleBtn.addEventListener('click', () => {
            const rulesEditor = document.getElementById('rulesDisplay');
            if (!rulesEditor) return;
            let rulesText = rulesEditor.textContent || "";
            const rulesWithoutComments = rulesText.replace(/^\s*\/\/.*$/gm, '').trim();
            if (!rulesWithoutComments) {
                alert("Rule editor is empty or contains only comments. Nothing to save.");
                return;
            }
            try {
                const parsedRules = JSON.parse(rulesWithoutComments);
                const jsonString = JSON.stringify(parsedRules, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'turmite_rule.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (e) {
                alert(`Could not save rule. The content (after removing comments) is not valid JSON:\n\n${e.message}`);
            }
        });
    }

    if (loadRuleBtn) {
        loadRuleBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json,application/json';
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', (event) => {
                const file = event.target.files ? event.target.files[0] : null;
                if (!file) {
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target?.result;
                    const rulesEditor = document.getElementById('rulesDisplay');
                    const applyBtn = document.getElementById('applyBtn');
                    const discardBtn = document.getElementById('discardBtn');
                    if (!rulesEditor || !applyBtn || !discardBtn) return;
                    try {
                        if (typeof content !== 'string') {
                            throw new Error("Failed to read file content as text.");
                        }
                        const parsedRules = JSON.parse(content);
                        if (typeof parsedRules !== 'object' || parsedRules === null || Array.isArray(parsedRules)) {
                            throw new Error("Loaded JSON is not a valid rule object.");
                        }
                        const numStates = Object.keys(parsedRules).length;
                        const numColors = parsedRules[0] ? parsedRules[0].length : 0;
                        let rulesString = "";
                        rulesString += `// States: ${numStates}\n`;
                        rulesString += `// Colors: ${numColors}\n`;
                        rulesString += `// Moves: L:Left, R:Right, N:None, U:U-Turn, S:Stay\n\n`;
                        rulesString += JSON.stringify(parsedRules, null, 2);
                        rulesEditor.textContent = rulesString;
                        applyBtn.disabled = false;
                        if (discardBtn) discardBtn.disabled = false;
                        if (presetSelect) presetSelect.value = 'custom';
                    } catch (error) {
                        alert(`Failed to load rule: ${error.message}`);
                    }
                };
                reader.onerror = (e) => {
                    alert("An error occurred while trying to read the file.");
                };
                reader.readAsText(file);
            });
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        });
    }
    if (discardBtn) {
        discardBtn.addEventListener('click', () => {
            if (Object.keys(lastAppliedState).length === 0) {
                if (applyBtn) applyBtn.disabled = true;
                if (discardBtn) discardBtn.disabled = true;
                return;
            }
            if (antCountInput) antCountInput.value = lastAppliedState.antCount;
            if (startPositionSelect) startPositionSelect.value = lastAppliedState.startPosition;
            if (startDirectionSelect) startDirectionSelect.value = lastAppliedState.startDirection;
            if (possibleStatesInput) possibleStatesInput.value = lastAppliedState.maxStates;
            if (possibleColorsInput) possibleColorsInput.value = lastAppliedState.maxColors;
            if (individualRulesCheck) individualRulesCheck.checked = lastAppliedState.individualChecked;
            if (rulesDisplayPre) rulesDisplayPre.textContent = lastAppliedState.rulesText;
            if (antCountInput && rulesDisplayContainer && individualRulesContainer && individualRulesCheck && rulesDisplayPre) {
                updateIndividualRulesVisibility(
                    parseInt(lastAppliedState.antCount, 10) || 0,
                    rulesDisplayContainer,
                    individualRulesContainer,
                    individualRulesCheck,
                    rulesDisplayPre
                );
            }
            if (applyBtn) applyBtn.disabled = true;
            if (discardBtn) discardBtn.disabled = true;
        });
    }

    function loadPresetRule(presetValue) {
        const rulesEditor = document.getElementById('rulesDisplay');
        const applyBtn = document.getElementById('applyBtn');
        const discardBtn = document.getElementById('discardBtn');
        if (!rulesEditor || !applyBtn || !discardBtn) return;
        if (presetValue === 'custom') {
            return;
        }
        const selectedPreset = presetDefinitions[presetValue];
        if (selectedPreset) {
            const presetRules = selectedPreset.rules;
            const presetName = selectedPreset.name;
            try {
                const numStates = Object.keys(presetRules).length;
                const numColors = presetRules[0] ? presetRules[0].length : 0;
                let rulesString = `// Preset: ${presetName}\n`;
                rulesString += `// States: ${numStates}\n`;
                rulesString += `// Colors: ${numColors}\n`;
                rulesString += `// Moves: L:Left, R:Right, N:None, U:U-Turn, S:Stay\n\n`;
                rulesString += JSON.stringify(presetRules, null, 2);
                rulesEditor.textContent = rulesString;
                applyBtn.disabled = false;
                discardBtn.disabled = false;
            } catch (error) {
                alert(`Failed to load preset '${presetName}': ${error.message}`);
            }
        }
    }

    if (presetSelect) {
        presetSelect.addEventListener('change', (event) => {
            loadPresetRule(event.target.value);
        });
    }
    initSimulation(false, undefined, undefined, true);
    loadPresetRule(presetSelect.value);
    if (applyBtn) applyBtn.disabled = true;
    if (discardBtn) discardBtn.disabled = true;
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
