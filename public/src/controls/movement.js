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

// Export parameters for GUI adjustment
export const movementParams = {
  walkSpeed: 0.03,
  runSpeed: 0.06,
  rotationSpeed: 0.05,
  rotationSmoothness: 0.05,
  animationSyncFactor: 15,
  walkAnimationSpeed: 1.0,
  runAnimationSpeed: 1.5,
  idleAnimationSpeed: 1.0,
  jumpAnimationSpeed: 1.0,
  idleFadeTime: 0.5,
  walkFadeTime: 0.3,
  runFadeTime: 0.2,
  jumpFadeTime: 0.1,
  jumpHeight: 3,
  gravity: -9.8,
  groundOffset: 1.0,
  jumpCooldown: 0.5,
  cameraFollowSpeed: 0.1,
  cameraHeight: 1.5
};

let isJumping = false;
let jumpStartTime = 0;
let initialY = 0;
let currentAction = null;
let lastAnimationName = 'idle';

// Improved animation transition with crossfading
function playAnimation(actions, name, fadeTime = 0.2) {
  if (!actions[name]) {
    console.warn(`Animation "${name}" not found`);
    return;
  }

  // If the same animation is already playing, no need to transition
  if (lastAnimationName === name) return;

  const current = actions[lastAnimationName];
  const next = actions[name];

  // Ensure the next animation is properly configured
  next.enabled = true;
  next.setEffectiveWeight(1);
  next.setLoop(name === 'jump' ? THREE.LoopOnce : THREE.LoopRepeat);
  next.clampWhenFinished = (name === 'jump');

  // Don't reset animations for walking/running to keep them smooth
  if (name === 'jump' || lastAnimationName === 'idle' || name === 'idle') {
    next.reset();
  }

  if (current && current.isRunning()) {
    // Crossfade from the current animation to the new one
    current.crossFadeTo(next, fadeTime, true); // 'true' enables warping for smoother transitions
    next.play();
  } else {
    // If no current animation is playing, just start the new one
    next.play();
  }

  lastAnimationName = name;
  console.log(`Playing animation: ${name}`);

  // Use custom fade times from parameters
  if (name === 'idle') fadeTime = movementParams.idleFadeTime;
  else if (name === 'jump') fadeTime = movementParams.jumpFadeTime;
  else if (name.includes('run')) fadeTime = movementParams.runFadeTime;
  else if (name.includes('walk')) fadeTime = movementParams.walkFadeTime;
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
    return intersects[0].point.y + movementParams.groundOffset;
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

  const speed = keys.run ? movementParams.runSpeed : movementParams.walkSpeed;
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

  // Determine animation priority
  let animationToPlay = 'idle';

  if (isJumping) {
    // Jump has highest priority
    animationToPlay = 'jump';
  } else if (movement.length() > 0) {
    // Movement animations
    if (keys.forward) {
      animationToPlay = keys.run ? 'runForward' : 'walkForward';
    } else if (keys.backward) {
      animationToPlay = keys.run ? 'runBack' : 'walkBack';
    } else if (keys.left) {
      animationToPlay = keys.run ? 'runLeft' : 'walkLeft';
    } else if (keys.right) {
      animationToPlay = keys.run ? 'runRight' : 'walkRight';
    }
  }

  // Apply movement with animation speed sync
  if (movement.length() > 0) {
    movement.normalize().multiplyScalar(speed * delta * 60);

    // Update horizontal position
    character.position.x += movement.x;
    character.position.z += movement.z;

    // Update rotation to face movement direction more smoothly
    const angle = Math.atan2(movement.x, movement.z);
    character.quaternion.slerp(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle),
      movementParams.rotationSmoothness
    );

    // Sync animation playback rate with movement speed
    if (animationToPlay.includes('walk') || animationToPlay.includes('run')) {
      const currentAction = actions[animationToPlay];
      if (currentAction) {
        // Use custom animation speeds from parameters
        const speedFactor = animationToPlay.includes('run')
          ? movementParams.runAnimationSpeed
          : movementParams.walkAnimationSpeed;

        // Smooth animation speed adjustment
        const targetTimeScale = movement.length() * movementParams.animationSyncFactor * speedFactor;
        const currentTimeScale = currentAction.getEffectiveTimeScale();
        const newTimeScale = THREE.MathUtils.lerp(currentTimeScale, targetTimeScale, 0.1);
        currentAction.setEffectiveTimeScale(newTimeScale);

        // Preserve animation time when switching between similar animations
        if (lastAnimationName !== animationToPlay &&
            (lastAnimationName?.includes('walk') || lastAnimationName?.includes('run')) &&
            actions[lastAnimationName]) {
          // Transfer animation time for smoother transitions
          currentAction.time = actions[lastAnimationName].time % currentAction._clip.duration;
        }
      }
    } else if (animationToPlay === 'idle' && actions['idle']) {
      actions['idle'].setEffectiveTimeScale(movementParams.idleAnimationSpeed);
    } else if (animationToPlay === 'jump' && actions['jump']) {
      actions['jump'].setEffectiveTimeScale(movementParams.jumpAnimationSpeed);
    }
  }

  // Play the determined animation with appropriate fade time
  const fadeTimes = {
    idle: 0.5,     // Slower fade to idle for smoothness
    jump: 0.1,     // Quick transition for jump
    default: 0.3   // Default fade time for other animations
  };

  const fadeTime = fadeTimes[animationToPlay] || fadeTimes.default;
  playAnimation(actions, animationToPlay, fadeTime);

  // Handle vertical movement (jumping or terrain following)
  if (isJumping) {
    const timeInAir = (Date.now() - jumpStartTime) / 1000;
    const jumpVelocity = movementParams.jumpHeight * 2;
    const newHeight = initialY + (jumpVelocity * timeInAir) + (0.5 * movementParams.gravity * timeInAir * timeInAir);
    const terrainHeight = getTerrainHeight(character, scene);

    // Set height to max of jump height or terrain height
    character.position.y = Math.max(newHeight, terrainHeight);

    // Check if landed
    if (character.position.y <= terrainHeight) {
      character.position.y = terrainHeight;
      isJumping = false;
      keys.grounded = true;
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