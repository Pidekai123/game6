// public/src/main.js
import * as THREE from 'three';
import { addGround } from './scene/ground.js';
import { addSky } from './scene/sky.js';
import { addObjects } from './scene/objects.js';
import { addLights } from './lighting/lights.js';
import { createCharacter } from './character/model.js';
import { setupControls, updateMovement } from './controls/movement.js';

// Scene, camera, renderer setup
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x87ceeb, 0.01);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Add components to scene
const ground = addGround(scene);
addSky(scene);
addObjects(scene);
const lights = addLights(scene);

// Clock for animation timing
const clock = new THREE.Clock();

// Animation management
let mixer, actions = {};

// Camera settings
const cameraSettings = {
  distance: 5,
  lookAtHeight: 0.5,
  horizontalRotation: 0,
  verticalRotation: Math.asin(0.25) // Approx. 14.5 degrees
};

// Initialize mouse control object
const mouseControl = {
  isRightClicking: false,
  previousX: 0,
  previousY: 0,
  rotationSensitivity: 0.009
};

// Set up mouse controls immediately
setupMouseControls(mouseControl);

createCharacter(scene).then((character) => {
  // Make character smaller
  character.scale.setScalar(0.005);

  // Position character higher to avoid terrain clipping
  character.position.y = 1;

  console.log("Character loaded with animations:", character.animations.length);

  // Create a new animation mixer
  mixer = new THREE.AnimationMixer(character);

  // Process each animation clip
  character.animations.forEach((clip) => {
    console.log(`Processing animation: ${clip.name}`);

    // Create an action from the clip
    const action = mixer.clipAction(clip);

    // Configure the action - simpler settings
    action.setLoop(THREE.LoopRepeat);
    action.enabled = true;

    // Store the action by name
    actions[clip.name] = action;
  });

  // Start with idle animation
  if (actions['idle']) {
    console.log("Starting idle animation");
    actions['idle'].play();
  } else {
    console.warn("No idle animation found!");
  }

  // Camera initial position
  camera.position.set(0, 1, 2);

  // Set up keyboard controls
  setupControls();

  // Create camera target
  const cameraTarget = new THREE.Object3D();
  scene.add(cameraTarget);
  cameraTarget.position.copy(character.position);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Update animations
    if (mixer) mixer.update(delta);

    // Update character movement
    updateMovement(character, actions, delta, camera, scene);

    // Update camera
    cameraTarget.position.lerp(character.position, 0.1);
    updateCamera(character, delta);

    // Update lighting
    if (lights.animate) lights.animate(clock.elapsedTime);

    // Render scene
    renderer.render(scene, camera);
  }

  animate();
}).catch(error => {
  console.error("Failed to load character:", error);
});

// Mouse controls setup
function setupMouseControls(mouseControl) {
  // Add event listeners directly to document
  window.addEventListener('mousedown', (event) => {
    if (event.button === 2) { // Right mouse button
      event.preventDefault();
      mouseControl.isRightClicking = true;
      mouseControl.previousX = event.clientX;
      mouseControl.previousY = event.clientY;
      console.log("Right mouse button down", mouseControl);
    }
  });

  window.addEventListener('mousemove', (event) => {
    if (mouseControl.isRightClicking) {
      const deltaX = event.clientX - mouseControl.previousX;
      const deltaY = event.clientY - mouseControl.previousY;

      cameraSettings.horizontalRotation += deltaX * mouseControl.rotationSensitivity;
      cameraSettings.verticalRotation += deltaY * mouseControl.rotationSensitivity;

      // Clamp vertical rotation between -60° and 60°
      const maxVertical = Math.PI / 3;
      const minVertical = -Math.PI / 3;
      cameraSettings.verticalRotation = Math.max(minVertical, Math.min(maxVertical, cameraSettings.verticalRotation));

      mouseControl.previousX = event.clientX;
      mouseControl.previousY = event.clientY;
    }
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 2) {
      mouseControl.isRightClicking = false;
      console.log("Right mouse button up");
    }
  });

  // This is critical - must be on window level
  window.addEventListener('contextmenu', (event) => {
    event.preventDefault(); // Prevent context menu from appearing
    console.log("Context menu prevented");
    return false;
  });
}

// Camera update function
function updateCamera(character, delta) {
  const lookAtPoint = character.position.clone();
  lookAtPoint.y += cameraSettings.lookAtHeight;

  const horizontalAngle = cameraSettings.horizontalRotation;
  const verticalAngle = cameraSettings.verticalRotation;
  const distance = cameraSettings.distance;

  const sinH = Math.sin(horizontalAngle);
  const cosH = Math.cos(horizontalAngle);
  const sinV = Math.sin(verticalAngle);
  const cosV = Math.cos(verticalAngle);

  camera.position.x = lookAtPoint.x + distance * sinH * cosV;
  camera.position.y = lookAtPoint.y + distance * sinV;
  camera.position.z = lookAtPoint.z + distance * cosH * cosV;

  camera.lookAt(lookAtPoint);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});