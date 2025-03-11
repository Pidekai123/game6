// public/src/scene/sky.js
import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

export function addSky(scene) {
  const loader = new EXRLoader();
  loader.load('../assets/skybox/autumn_field_puresky_1k.exr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping; // For equirectangular HDR
    scene.background = texture; // Set as the skybox
  });
}