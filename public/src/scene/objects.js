import * as THREE from 'three';

export function addObjects(scene) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(5, 0.5, 5);
  scene.add(cube);
  cube.castShadow = true;
  return cube;
}