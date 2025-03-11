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
  height: 1,
  distance: 2,
  smoothing: 0.1,
  lookAtHeight: 0.5
};

createCharacter(scene).then((character) => {
  // Make character smaller
  character.scale.setScalar(0.005);

  // Position character higher to avoid terrain clipping
  character.position.y = 2;

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
    updateCamera(character, cameraTarget, delta);

    // Update lighting
    if (lights.animate) lights.animate(clock.elapsedTime);

    // Render scene
    renderer.render(scene, camera);
  }

  animate();
}).catch(error => {
  console.error("Failed to load character:", error);
});

function updateCamera(character, target, delta) {
  const characterDirection = new THREE.Vector3(0, 0, 1);
  characterDirection.applyQuaternion(character.quaternion);

  const targetPosition = target.position.clone();
  targetPosition.y += cameraSettings.height;
  targetPosition.sub(characterDirection.multiplyScalar(cameraSettings.distance));

  camera.position.lerp(targetPosition, cameraSettings.smoothing);

  const lookAtPoint = target.position.clone();
  lookAtPoint.y += cameraSettings.lookAtHeight;
  camera.lookAt(lookAtPoint);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add LOD (Level of Detail) system for distant objects
function setupLOD() {
  scene.traverse(object => {
    if (object.isMesh && object !== ground && object.name !== 'character') {
      // Create simple LOD for scene objects
      const geometry = object.geometry;
      const material = object.material;

      const lod = new THREE.LOD();

      // Original high detail
      lod.addLevel(object, 0);

      // Medium detail
      const mediumGeo = geometry.clone().toNonIndexed();
      const mediumMesh = new THREE.Mesh(mediumGeo, material);
      lod.addLevel(mediumMesh, 50);

      // Low detail
      const lowGeo = new THREE.BoxGeometry(
        object.scale.x,
        object.scale.y,
        object.scale.z
      );
      const lowMesh = new THREE.Mesh(lowGeo, material);
      lod.addLevel(lowMesh, 100);

      // Replace original object with LOD
      object.parent.add(lod);
      lod.position.copy(object.position);
      lod.rotation.copy(object.rotation);
      lod.scale.copy(object.scale);
      object.parent.remove(object);
    }
  });
}

// Call this after loading the scene
setupLOD();