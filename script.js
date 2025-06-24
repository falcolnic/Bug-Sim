const canvas = document.getElementById('bugCanvas');
const ctx = canvas.getContext('2d');

let width, height;
const cellSize = 1;
let grid;
let intervalId;
let stepsPerTick;
let isRunning = true;
let bug;

let scale = 8;
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
    {dx: 0, dy: -1},  // u
    {dx: 1, dy: 0},   // r
    {dx: 0, dy: 1},   // d
    {dx: -1, dy: 0}   // l
]
let gridCols = 0
let gridRows = 0;

let currentIntervalId = null;
let currentIntervalDelay = 0;
let currentStepsPerTick = 1;
let timeoutId = null;
let minSimSpeed = 1;
const midSimSpeed = 60;
const maxSimSpeed = 100000;
const maxStepsPerLoopIteration = 1000;

let simulationTimeourId = null;
let nextStepTime = 0;
let renderRequestId = null;
let pauseTime = 0;

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
    canvas.width = width;
    canvas.height = height;

    if (gridCols > 0 && gridRows > 0) {
        const gridCentX = gridCols/2 * cellSize;
        const gridCentY = gridRows/2 * cellSize;
        offsetX = width/2 - gridCentX * scale;
        offsetY = height/2 - gridCentY * scale;
        
    } else {
        offsetX = width / 2;
        offsetY = height / 2;
    }
    setCanvasSmoothing(false)
    requestAnimationFrame(draw)
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
    grid = Array(gridRows).fill(null).map(() => Array(gridCols).fill(1));
    console.log(`${gridCols}x${gridRows} scale - ${scale}`);

}

function initBug() {
    bug = {
        x: Math.floor(gridCols / 2),
        y: Math.floor(gridRows / 2),
        dir: 0,
    }
}
function resetCamera() {
    scale = 8;
    offsetX = 0;
    offsetY = 0;
}

function initSimulation() {
    stopSimulationLoop();
    stopRenderLoop();
    width = window.innerWidth;
    height = window.innerHeight;
    if (!canvas) { console.error("no canvas found"); return; }
    canvas.width = width;
    canvas.height = height;
    scale = 8;
    initGrid()
    initBug();
    if (gridCols > 0 && gridRows > 0) {
        const gridCentX = gridCols / 2 * cellSize;
        const gridCentY = gridRows / 2 * cellSize;
        initialOffsetX = width / 2 - gridCentX * scale;
        initialOffsetY = height / 2 - gridCentY * scale;
        offsetX = initialOffsetX;
        offsetY = initialOffsetY;
    } else {
        initialOffsetX = width / 2;
        initialOffsetY = height / 2;
        offsetX = initialOffsetX;
        offsetY = initialOffsetY;
    }
    const simSpeedSlider = document.getElementById('simSpeedSlider');
    const simSpeedValue = document.getElementById('simSpeedValue');
    if (!simSpeedSlider || !simSpeedValue) {
        console.error("No UI");
        return;
    }
    const initialSliderValue = parseInt(simSpeedSlider.value, 10);
    const initialSimSpeed = mapSliderToSpeed(initialSliderValue);
    simSpeedSlider.value = initialSliderValue;
    simSpeedValue.textContent = Math.round(initialSimSpeed);
    // frameRate = initialSimSpeed; 0? 
    setCanvasSmoothing(false);
    isRunning = true;
    updateButtonText()

    const panel = document.getElementById('controlPanel');
    if (panel) { panel.classList.remove('minimized'); }
    pauseTime = 0;
    startSimulationLoop();
    startRenderLoop();
}

function startSimulation(){
    stopSimulation();
    if (currentIntervalId || timeoutId) {
        console.error("startSimulation called");
        return;
    }
    console.log("Setup loop")
    isRunning = true;
    updateButtonText();
    const fpsSlider = document.getElementById('fpsSlider');
    const stepsSlider = document.getElementById('stepsSlider');
    const targetFps = fpsSlider ? parseInt(fpsSlider.value, 10) : 60;
    currentStepsPerTick = stepsSlider ? parseInt(stepsSlider.value, 10) : 1;

    currentStepsPerTick = Math.max(1, currentStepsPerTick);
    if (targetFps >= 239) {
        currentIntervalDelay = 0
        console.log(`maxSpeed:${currentStepsPerTick} steps/tick`);
        runMaxSpeedLoop();
    } else if (targetFps >= 1) {
        currentIntervalDelay = Math.round(1000 / targetFps);
        console.log(`targetFps:${targetFps} steps/tick:${currentStepsPerTick} currentIntervalDelay:${currentIntervalDelay}`);
        currentIntervalId = setInterval(runSimulationTick, currentIntervalDelay);
        console.log(` intervalId: ${currentIntervalId}`);
    } else {
        currentIntervalDelay = 1000;
        console.warn(`Invalid FPS ${targetFps}`);
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
    console.log("Simulation stopped");
}
function updateButtonText() {
    const btn = document.getElementById('startStopBtn');
    if (btn) { btn.innerHTML = isRunning ? 'Stop' : 'Start'; }

}function resizeCanvas() {
    updateCanvas();
}

function stepLogic() {
    if (!grid || !bug || !grid.length || !grid[0].length) return;
    const cols = grid[0].length;
    const rows = grid.length;
    bug.x = (bug.x + cols) % cols;
    bug.y = (bug.y + rows) % rows;

    if (bug.y < 0 || bug.y >= grid.length || bug.x < 0 || bug.x >= grid[0].length) {
        console.warn(bug, "Out of bounds")
        bug.x = Math.floor(cols / 2);
        bug.y = Math.floor(rows / 2);

        bug.dir = 0;
        return;
    }
    const currentCellX = bug.x;
    const currentCellY = bug.y;
    try {
        if (grid[currentCellY][currentCellX] === 1) {
            bug.dir = (bug.dir + 1) % 4;
            grid[currentCellY][currentCellX] = 0;
        } else {
            bug.dir = (bug.dir + 3) % 4;
            grid[currentCellY][currentCellX] = 1;
        }
    } catch (e) {
        console.error(`Grid [${currentCellY}][${currentCellX}] bug:`, e)
        bug.x = Math.floor(cols / 2);
        bug.y = Math.floor(rows / 2);
        bug.dir = 0;
        return;
    }
    const move = directions[bug.dir];
    bug.x += move.dx;
    bug.y += move.dy;
}

function runSimulationTick() {
    if (!isRunning) {
        if (currentIntervalId) clearInterval(currentIntervalId);
        currentIntervalId = null;
        return;
    }
    for (let i = 0; i < currentStepsPerTick; i++) {
        stepLogic();
    }
    requestAnimationFrame(draw);
}
function runMaxSpeedLoop() {
    if (!isRunning) {
        timeoutId = null;
        return;
    }
    for (let i = 0; i < maxStepsPerLoopIteration; i++) {
        stepLogic();
    }
    requestAnimationFrame(draw);
    timeoutId = setTimeout(runMaxSpeedLoop, 0);
}

function drawGrid() {
    if (!grid || !grid.length || !grid[0].length) return;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    setCanvasSmoothing(false);

    const viewX1 = -offsetX / scale;
    const viewY1 = -offsetY / scale;
    const viewX2 = (width - offsetX) / scale;
    const viewY2 = (height - offsetY) / scale;
    const startCol = Math.max(0, Math.floor(viewX1/cellSize));
    const endCol = Math.min(grid[0].length, Math.ceil(viewX2/cellSize));
    const startRow = Math.max(0, Math.floor(viewY1/cellSize));
    const endRow = Math.min(grid.length, Math.ceil(viewY2/cellSize));
    ctx.beginPath();
    ctx.fillStyle = 'white';

    for (let y = startRow; y < endRow; y++) {
        if (y < 0 || y >= grid.length) continue;
        for (let x = startCol; x < endCol; x++) {
            if (x < 0 || x >= grid[y].length) continue;
            if (grid[y][x] === 0) {
                ctx.rect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }
    ctx.fill();
    if (bug && bug.x >= startCol && bug.x < endCol && bug.y >= startRow && bug.y < endRow) {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(bug.x * cellSize + cellSize / 2, bug.y * cellSize + cellSize / 2, cellSize / 2.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function draw() {
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    drawGrid();
}

function handleZoom(event){
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = (event.clientX - rect.left);
    const mouseY = (event.clientY - rect.top);
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
    requestAnimationFrame(draw);

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
        isDragging = false
        canvas.style.cursor = 'grab';
    }
}
function handleMouseMove(event) {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    offsetX += (mouseX - lastMouseX);
    offsetY += (mouseY - lastMouseY);
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    requestAnimationFrame(draw);
}
function handleMouseLeave(event) {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!ctx) return;
    const simSpeedSlider = document.getElementById('simSpeedSlider');
    const simSpeedValueSpan = document.getElementById('simSpeedValue');
    const startStopBtn = document.getElementById('startStopBtn');
    const resetBtn = document.getElementById('resetBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const maximizeBtn = document.getElementById('maximizeBtn');
    const controlPanel = document.getElementById('controlPanel');

    if (!simSpeedSlider || !simSpeedValueSpan || !startStopBtn || !resetBtn || !resetViewBtn || !minimizeBtn || !maximizeBtn || !controlPanel) {
        console.error("UI elements not found");
        if (!simSpeedSlider) console.error("- simSpeedSlider is null");
        if (!simSpeedValueSpan) console.error("- simSpeedValueSpan is null");
        if (!startStopBtn) console.error("- startStopBtn is null");
        if (!resetBtn) console.error("- resetBtn is null");
        if (!resetViewBtn) console.error("- resetViewBtn is null");
        if (!minimizeBtn) console.error("- minimizeBtn is null");
        if (!maximizeBtn) console.error("- maximizeBtn is null");
        if (!controlPanel) console.error("- controlPanel is null");
        return;
    }
    console.log("All control panel elements found");
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
        isRunning = true;
        initSimulation();
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
    
    if (canvas) {
        canvas.addEventListener('wheel', handleZoom);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        canvas.style.cursor = 'grab';
    } else {
        console.error("Canvas not found");
    }
    initSimulation();
});
window.addEventListener('resize', resizeCanvas);
function simulationLoop() {
    if (!isRunning) {
        simulationTimeourId = null;
        return;
    }
    const now = performance.now();
    let stepsExecuted = 0;

    const slider = document.getElementById('simSpeedSlider');
    const sliderValue = slider ? parseInt(slider.value, 10) : 50;
    const targetSpeed = mapSliderToSpeed(sliderValue);
    const stepDuration = (targetSpeed > 0) ? 1000 / targetSpeed : Infinity;

    while (now >= nextStepTime && stepsExecuted < maxStepsPerLoopIteration) {
        stepLogic();
        nextStepTime += stepDuration;
        stepsExecuted++;
        if (stepDuration <= 0 || !isFinite(stepDuration)){
            console.error("Invalid step duration:", stepDuration);
            nextStepTime = performance.now() + 1000;
            break;
        }
    }

    if (stepsExecuted >= maxStepsPerLoopIteration) {
        nextStepTime += performance.now() - stepDuration;
    }
    const timeTonext = Math.max(0, nextStepTime - performance.now());
    simulationTimeourId = setTimeout(simulationLoop, timeTonext);
}

function startSimulationLoop() {
    if (simulationTimeourId) {
        return;
    }
    if (pauseTime > 0) {
        const elpasedTime = performance.now() - pauseTime;
        nextStepTime += elpasedTime;
        pauseTime = 0;
    } else {
        nextStepTime = performance.now();
        console.log(nextStepTime, "nextStepTime");
    }

    const timeToFirstCall = Math.max(0, nextStepTime - performance.now());
    simulationTimeourId = setTimeout(simulationLoop, timeToFirstCall);

}

function stopSimulationLoop() {
    if (simulationTimeourId) {
        clearTimeout(simulationTimeourId);
        simulationTimeourId = null;
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
    if (renderRequestId) {
        return;
    }
    renderRequestId = requestAnimationFrame(renderLoop);
}
function stopRenderLoop() {
    if (renderRequestId) {
        cancelAnimationFrame(renderRequestId);
        renderRequestId = null;
    }
}
function calculateSimDelay(targetStepsPerSec){
    if (targetStepsPerSec <= 0) return 1000; 
    const delay = 1000 / targetStepsPerSec;
    return Math.max(0, Math.min(delay, 10000));
}