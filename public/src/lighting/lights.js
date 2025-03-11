// public/src/scene/lighting/lights.js
import * as THREE from 'three';

export function addLights(scene) {
  // Create a lighting container
  const lights = {};

  // Add ambient light (soft overall illumination)
  lights.ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(lights.ambient);

  // Add main directional light (sun)
  lights.directional = new THREE.DirectionalLight(0xffffff, 0.8);
  lights.directional.position.set(50, 200, 100);
  lights.directional.castShadow = true;

  // Configure shadow properties for better performance and quality
  const shadowSize = 200;
  lights.directional.shadow.camera.left = -shadowSize / 2;
  lights.directional.shadow.camera.right = shadowSize / 2;
  lights.directional.shadow.camera.top = shadowSize / 2;
  lights.directional.shadow.camera.bottom = -shadowSize / 2;
  lights.directional.shadow.camera.near = 0.5;
  lights.directional.shadow.camera.far = 500;
  lights.directional.shadow.mapSize.width = 2048;
  lights.directional.shadow.mapSize.height = 2048;

  // Add directional light to scene
  scene.add(lights.directional);

  // Add hemisphere light (sky and ground colors)
  lights.hemisphere = new THREE.HemisphereLight(0x87ceeb, 0x3b7d4e, 0.4);
  scene.add(lights.hemisphere);

  // Create a subtle fill light from the opposite side
  lights.fill = new THREE.DirectionalLight(0xffa95c, 0.3); // Warm fill light
  lights.fill.position.set(-50, 50, -100);
  scene.add(lights.fill);

  // Helper function to update sun position
  function updateSunPosition(time) {
    const radius = 200;
    const angle = time * 0.05; // Speed of sun movement

    lights.directional.position.x = Math.sin(angle) * radius;
    lights.directional.position.z = Math.cos(angle) * radius;

    // Adjust intensity based on height (simulate day/night)
    const height = Math.sin(angle) * 0.4 + 0.6; // Range from 0.2 to 1.0
    lights.directional.intensity = Math.max(0.1, height);

    // Adjust hemisphere light based on sun position
    lights.hemisphere.intensity = Math.max(0.2, height * 0.8);
  }

  // Expose animation function
  lights.animate = updateSunPosition;

  return lights;
}