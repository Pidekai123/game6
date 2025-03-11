# Project Architecture

## Overview
A single-player 3D prototype using Three.js, serving static files with Express.js to support future online functionality.

## Data Flow
1. **Server Layer**
   - Express.js serving static files
   - Future capability for multiplayer networking

2. **Core Engine Layer**
   - Main.js initializes scene, camera, renderer
   - Animation loop manages updates and rendering
   - Event listeners handle window resizing

3. **Game Components Layer**
   - Scene: ground, sky, static objects
   - Lighting: ambient and directional light
   - Character: 3D model with textures
   - Controls: keyboard input processing

4. **Data Flow Diagram**
   ```
   User Input → Controls Module → Character Updates → Camera Updates → Rendering
                              ↓
   Server <--> Client (static files now, multiplayer later)
   ```

5. **Module Dependencies**
   - main.js imports from scene/, lighting/, character/, controls/
   - character/model.js imports from character/textures.js
   - All modules import Three.js library

6. **Event Flow**
   - Keyboard events → movement.js → character position updates
   - Animation frame → movement updates → camera updates → rendering

7. **Expansion Points**
   - Server: Add WebSocket for multiplayer
   - Physics: Add collision detection
   - Assets: Replace placeholders with final art
   - UI: Add HUD, menus, and game state