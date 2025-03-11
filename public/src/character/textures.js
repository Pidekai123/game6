import * as THREE from 'three';

export function applyTexture(material) {
  const loader = new THREE.TextureLoader();
  loader.load(
    '../assets/textures/character.png',
    (texture) => {
      material.map = texture;
      material.needsUpdate = true;
    }
  );
}