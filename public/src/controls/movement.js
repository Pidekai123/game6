// public/src/controls/movement.js
import * as THREE from 'three';

const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  rotateLeft: false,
  rotateRight: false,
  run: false,
  jump: false,
  grounded: true
};

// Reduced speeds for more natural movement
const walkSpeed = 0.15; // Reduced from 0.3
const runSpeed = 0.3;   // Reduced from 0.6
const rotationSpeed = 0.05;
const jumpHeight = 3;
const gravity = -9.8;
const GROUND_OFFSET = 1.0;

let isJumping = false;
let jumpStartTime = 0;
let initialY = 0;
let currentAction = null;
let lastAnimationName = 'idle';

// Improved animation transition
function playAnimation(actions, name, fadeTime = 0.2) {
  if (!actions[name]) {
    console.warn(`Animation "${name}" not found`);
    return;
  }

  if (lastAnimationName === name) return;

  const current = actions[lastAnimationName];
  const next = actions[name];

  if (current) {
    current.fadeOut(fadeTime);
  }

  next.reset().fadeIn(fadeTime).play();
  lastAnimationName = name;
  console.log(`Playing animation: ${name}`);
}

// Improved terrain height detection
function getTerrainHeight(character, scene) {
  const raycaster = new THREE.Raycaster();
  const rayStart = new THREE.Vector3(
    character.position.x,
    character.position.y + 5000, // Start from a reasonable height
    character.position.z
  );
  const rayDir = new THREE.Vector3(0, -1, 0);
  raycaster.set(rayStart, rayDir);

  // Find terrain or ground
  const terrain = scene.getObjectByName('terrain') || scene.getObjectByName('ground');
  if (!terrain) return 0;

  const intersects = raycaster.intersectObject(terrain, true);
  if (intersects.length > 0) {
    return intersects[0].point.y + GROUND_OFFSET;
  }

  return 0;
}

export function setupControls() {
  document.addEventListener('keydown', (event) => {
    switch (event.code) {
      case 'KeyW': keys.forward = true; break;
      case 'KeyS': keys.backward = true; break;
      case 'KeyA': keys.left = true; break;
      case 'KeyD': keys.right = true; break;
      case 'ArrowLeft': keys.rotateLeft = true; break;
      case 'ArrowRight': keys.rotateRight = true; break;
      case 'ShiftLeft':
      case 'ShiftRight': keys.run = true; break;
      case 'Space': if (!isJumping) keys.jump = true; break;
    }
  });

  document.addEventListener('keyup', (event) => {
    switch (event.code) {
      case 'KeyW': keys.forward = false; break;
      case 'KeyS': keys.backward = false; break;
      case 'KeyA': keys.left = false; break;
      case 'KeyD': keys.right = false; break;
      case 'ArrowLeft': keys.rotateLeft = false; break;
      case 'ArrowRight': keys.rotateRight = false; break;
      case 'ShiftLeft':
      case 'ShiftRight': keys.run = false; break;
      case 'Space': keys.jump = false; break;
    }
  });
}

export function updateMovement(character, actions, delta, camera, scene) {
  // Camera-relative directions
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  cameraDirection.y = 0;
  cameraDirection.normalize();

  const cameraRight = new THREE.Vector3(1, 0, 0);
  cameraRight.applyQuaternion(camera.quaternion);
  cameraRight.y = 0;
  cameraRight.normalize();

  const speed = keys.run ? runSpeed : walkSpeed;
  const movement = new THREE.Vector3(0, 0, 0);

  // Calculate movement vector
  if (keys.forward) movement.add(cameraDirection);
  if (keys.backward) movement.sub(cameraDirection);
  if (keys.left) movement.sub(cameraRight);
  if (keys.right) movement.add(cameraRight);

  // Handle jumping
  if (keys.jump && keys.grounded && !isJumping) {
    isJumping = true;
    jumpStartTime = Date.now();
    initialY = character.position.y;
    playAnimation(actions, 'jump');
  }

  // Apply movement
  if (movement.length() > 0) {
    movement.normalize().multiplyScalar(speed);

    // Update horizontal position
    character.position.x += movement.x;
    character.position.z += movement.z;

    // Update rotation to face movement direction
    const angle = Math.atan2(movement.x, movement.z);
    character.quaternion.slerp(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle),
      0.1 // Smoother rotation
    );

    // Select appropriate animation
    if (isJumping) {
      playAnimation(actions, 'jump');
    } else if (keys.forward) {
      playAnimation(actions, keys.run ? 'runForward' : 'walkForward');
    } else if (keys.backward) {
      playAnimation(actions, keys.run ? 'runBack' : 'walkBack');
    } else if (keys.left) {
      playAnimation(actions, keys.run ? 'runLeft' : 'walkLeft');
    } else if (keys.right) {
      playAnimation(actions, keys.run ? 'runRight' : 'walkRight');
    }
  } else if (!isJumping) {
    playAnimation(actions, 'idle');
  }

  // Manual rotation
  if (keys.rotateLeft) character.rotation.y += rotationSpeed;
  if (keys.rotateRight) character.rotation.y -= rotationSpeed;

  // Handle vertical movement (jumping or terrain following)
  if (isJumping) {
    const timeInAir = (Date.now() - jumpStartTime) / 1000;
    const jumpVelocity = jumpHeight * 2;
    const newHeight = initialY + (jumpVelocity * timeInAir) + (0.5 * gravity * timeInAir * timeInAir);
    const terrainHeight = getTerrainHeight(character, scene);

    // Set height to max of jump height or terrain height
    character.position.y = Math.max(newHeight, terrainHeight);

    // Check if landed
    if (character.position.y <= terrainHeight) {
      character.position.y = terrainHeight;
      isJumping = false;
      keys.grounded = true;
      playAnimation(actions, 'idle');
    } else {
      keys.grounded = false;
    }
  } else {
    // Follow terrain when not jumping
    const terrainHeight = getTerrainHeight(character, scene);
    character.position.y = terrainHeight;
    keys.grounded = true;
  }
}