# Bug Simulation - Langton's Ant

### Running Locally
1. Clone or download the project files
2. Open `index.html` in a modern web browser
3. The simulation starts automatically


### Files Structure
```
├── index.html      # Main HTML page
├── script.js       # Simulation logic and rendering
├── styles.css      # User interface styling
└── README.md       # This file
```

### Simulation Controls
- **❚❚ Button**: Start/Stop the simulation
- **↻ Button**: Reset simulation to initial state  
- **⌖ Button**: Reset camera view to center

### Speed Control
- **Slider (1-100)**: Adjusts simulation speed
  - Values 1-50: Linear scaling from 1 to 60 steps/second
  - Value 50: Exactly 60 steps/second
  - Values 51-100: Exponential scaling up to 100,000+ steps/second

### Navigation
- **Mouse Wheel**: Zoom in/out (0.1x to 50x)
- **Click + Drag**: Pan the view
- **Minimize (-) / Maximize (□)**: Toggle control panel

### Grid Representation
- **Black cells**: Value 1 (default state)
- **White cells**: Value 0 (visited by ant)
- **Red dot**: The ant's current position
- **Infinite Grid**: Wrapping boundaries for continuous exploration

### What to Look For
1. **Initial Chaos**: Random-looking patterns for ~10,000 steps
2. **Emergent Structure**: Organized patterns begin forming
3. **Highway Construction**: After ~11,000 steps, the ant builds a diagonal "highway"
4. **Infinite Growth**: The highway continues indefinitely

### Recommended Viewing
- Start at default speed (60 steps/sec)
- Use Reset View to center the ant periodically
- Zoom out to see large-scale patterns
- Increase speed to observe long-term behavior
