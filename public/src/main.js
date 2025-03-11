// public/src/main.js
import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { addGround } from './scene/ground.js';
import { addSky } from './scene/sky.js';
import { addObjects } from './scene/objects.js';
import { addLights } from './lighting/lights.js';
import { createCharacter } from './character/model.js';
import { setupControls, updateMovement, movementParams } from './controls/movement.js';

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
let mixer, actions = {}, lastAnimationName = null;

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

// Create GUI
function setupGUI() {
  const gui = new GUI();

  const movementFolder = gui.addFolder('Movement');
  movementFolder.add(movementParams, 'walkSpeed', 0.01, 0.1).name('Walk Speed');
  movementFolder.add(movementParams, 'runSpeed', 0.02, 0.2).name('Run Speed');
  movementFolder.add(movementParams, 'rotationSpeed', 0.01, 0.2).name('Rotation Speed');
  movementFolder.add(movementParams, 'rotationSmoothness', 0.01, 0.2).name('Rotation Smoothness');

  const animationFolder = gui.addFolder('Animation Speeds');
  animationFolder.add(movementParams, 'animationSyncFactor', 5, 30).name('Animation Sync');
  animationFolder.add(movementParams, 'walkAnimationSpeed', 0.5, 2).name('Walk Anim Speed');
  animationFolder.add(movementParams, 'runAnimationSpeed', 0.5, 2).name('Run Anim Speed');
  animationFolder.add(movementParams, 'idleAnimationSpeed', 0.5, 2).name('Idle Anim Speed');
  animationFolder.add(movementParams, 'jumpAnimationSpeed', 0.5, 2).name('Jump Anim Speed');

  const transitionFolder = gui.addFolder('Transition Times');
  transitionFolder.add(movementParams, 'idleFadeTime', 0.1, 1).name('To Idle Fade');
  transitionFolder.add(movementParams, 'walkFadeTime', 0.1, 1).name('To Walk Fade');
  transitionFolder.add(movementParams, 'runFadeTime', 0.1, 1).name('To Run Fade');
  transitionFolder.add(movementParams, 'jumpFadeTime', 0.05, 0.5).name('To Jump Fade');

  const physicsFolder = gui.addFolder('Physics');
  physicsFolder.add(movementParams, 'jumpHeight', 1, 10).name('Jump Height');
  physicsFolder.add(movementParams, 'gravity', -20, -1).name('Gravity');
  physicsFolder.add(movementParams, 'groundOffset', 0, 3).name('Ground Offset');
  physicsFolder.add(movementParams, 'jumpCooldown', 0, 2).name('Jump Cooldown');

  const cameraFolder = gui.addFolder('Camera');
  cameraFolder.add(movementParams, 'cameraFollowSpeed', 0.01, 1).name('Camera Follow');
  cameraFolder.add(movementParams, 'cameraHeight', 0.5, 3).name('Camera Height');

  // Open folders by default
  movementFolder.open();
  animationFolder.open();
}

createCharacter(scene).then((character) => {
  // Make character smaller
  character.scale.setScalar(0.005);

  // Position character higher to avoid terrain clipping
  character.position.y = 1;

  console.log("Character loaded with animations:", character.animations.length);

  // Create a new animation mixer
  mixer = new THREE.AnimationMixer(character);

  // Debug: Check for skinned mesh and skeleton
  character.traverse(child => {
    if (child.isSkinnedMesh) {
      console.log('Found SkinnedMesh with skeleton:',
                  child.skeleton.bones.length, 'bones');
      console.log('First few bone names:',
                  child.skeleton.bones.slice(0, 5).map(b => b.name));
    }
  });

  // Process each animation clip
  character.animations.forEach((clip) => {
    console.log(`Processing animation: ${clip.name}, duration: ${clip.duration}`);

    // Debug: Log first few tracks
    if (clip.tracks.length > 0) {
      console.log(`Sample tracks:`,
                  clip.tracks.slice(0, 3).map(track => track.name));
    }

    // Create an action from the clip
    const action = mixer.clipAction(clip);

    // Configure based on animation type
    if (clip.name === 'jump') {
      action.setLoop(THREE.LoopOnce); // Play once for jump
      action.clampWhenFinished = true; // Stop at the last frame
    } else {
      action.setLoop(THREE.LoopRepeat); // Loop for walk, run, idle
    }

    action.enabled = true;
    action.setEffectiveTimeScale(1); // Default speed
    action.setEffectiveWeight(1);    // Full weight when playing
    action.zeroSlopeAtEnd = false;   // Don't force end slope to zero
    action.zeroSlopeAtStart = false; // Don't force start slope to zero

    // Store the action by name
    actions[clip.name] = action;
  });

  // Start with idle animation - ensure it plays
  if (actions['idle']) {
    console.log("Starting idle animation");
    actions['idle'].reset();
    actions['idle'].enabled = true;
    actions['idle'].setEffectiveWeight(1);
    actions['idle'].play();
    lastAnimationName = 'idle';
  } else {
    console.warn("No idle animation found!");

    // Fallback: try to play any available animation
    const firstAnimName = Object.keys(actions)[0];
    if (firstAnimName) {
      console.log(`Falling back to first available animation: ${firstAnimName}`);
      actions[firstAnimName].reset().play();
      lastAnimationName = firstAnimName;
    }
  }

  // Camera initial position
  camera.position.set(0, 1, 2);

  // Set up keyboard controls
  setupControls();

  // Set up GUI
  setupGUI();

  // Create camera target
  const cameraTarget = new THREE.Object3D();
  scene.add(cameraTarget);
  cameraTarget.position.copy(character.position);

  // Animation loop with debug
  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Update animations with debug
    if (mixer) {
      mixer.update(delta);

      // Check if current animation is playing
      const currentAction = actions[lastAnimationName];
      if (currentAction && !currentAction.isRunning()) {
        console.warn(`Animation ${lastAnimationName} stopped running`);
        // Restart the animation if it stopped unexpectedly
        currentAction.reset().play();
      }
    }

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

      cameraSettings.horizontalRotation -= deltaX * mouseControl.rotationSensitivity; // Inverted horizontal rotation
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
  lookAtPoint.y += movementParams.cameraHeight; // Use parameter for camera height

  const horizontalAngle = cameraSettings.horizontalRotation;
  const verticalAngle = cameraSettings.verticalRotation;
  const distance = cameraSettings.distance;

  const sinH = Math.sin(horizontalAngle);
  const cosH = Math.cos(horizontalAngle);
  const sinV = Math.sin(verticalAngle);
  const cosV = Math.cos(verticalAngle);

  const targetPosition = new THREE.Vector3(
    lookAtPoint.x + distance * sinH * cosV,
    lookAtPoint.y + distance * sinV,
    lookAtPoint.z + distance * cosH * cosV
  );

  // Use parameter for camera follow speed
  camera.position.lerp(targetPosition, movementParams.cameraFollowSpeed);
  camera.lookAt(lookAtPoint);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});