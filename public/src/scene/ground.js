// public/src/scene/ground.js
import * as THREE from 'three';

export function addGround(scene) {
  console.log("Creating ground...");

  // Create a default flat ground first (fallback)
  const defaultGeometry = new THREE.PlaneGeometry(200, 200, 32, 32);
  const defaultMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b7d4e,  // Dark green fallback color
    roughness: 0.8,
    metalness: 0.2
  });

  const defaultGround = new THREE.Mesh(defaultGeometry, defaultMaterial);
  defaultGround.rotation.x = -Math.PI / 2; // Rotate to lie flat
  defaultGround.receiveShadow = true;
  defaultGround.name = 'ground';
  scene.add(defaultGround);

  // Settings for the heightmap terrain
  const terrainSettings = {
    width: 1000,
    height: 1000,
    segmentsW: 512,      // Increased segments for more detail
    segmentsH: 512,      // Increased segments for more detail
    maxHeight: 50,       // Increased maximum height for more dramatic terrain
    heightScale: 15.0,    // Increased height scale
    textureRepeat: 25,
    smoothingPasses: 3,   // Number of smoothing passes
    smoothingFactor: 0.5  // Smoothing intensity (0-1)
  };

  // Load texture and heightmap
  const textureLoader = new THREE.TextureLoader();

  // Debug message
  console.log("Loading heightmap texture...");

  // Load the heightmap - simplified approach
  textureLoader.load(
    '../assets/terrain/heightmap.png',
    (heightmapTexture) => {
      console.log("Heightmap loaded, processing...");

      // Simple safeguard to check if the texture loaded correctly
      if (!heightmapTexture.image || !heightmapTexture.image.width) {
        console.error("Heightmap image is invalid or empty");
        return; // Keep the default ground
      }

      try {
        // Create temporary canvas to extract pixel data
        const canvas = document.createElement('canvas');
        canvas.width = heightmapTexture.image.width;
        canvas.height = heightmapTexture.image.height;
        const ctx = canvas.getContext('2d');

        // Draw the image to canvas
        ctx.drawImage(heightmapTexture.image, 0, 0);

        try {
          // Get pixel data - this might fail if the image is from another domain
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = imageData.data;

          // Debug dimensions
          console.log(`Heightmap dimensions: ${canvas.width}x${canvas.height}`);
          console.log(`Pixel array length: ${pixels.length}`);

          // Create geometry with specified segments
          const geometry = new THREE.PlaneGeometry(
            terrainSettings.width,
            terrainSettings.height,
            terrainSettings.segmentsW,
            terrainSettings.segmentsH
          );

          // Get position attribute
          const positions = geometry.attributes.position.array;

          // Debug info
          console.log(`Geometry vertices: ${positions.length / 3}`);
          console.log(`Grid dimensions: ${terrainSettings.segmentsW + 1}x${terrainSettings.segmentsH + 1}`);

          // Create heightmap array for processing
          const gridSize = (terrainSettings.segmentsW + 1) * (terrainSettings.segmentsH + 1);
          const heightMap = new Float32Array(gridSize);

          // First pass: Sample heightmap and apply bicubic interpolation
          for (let i = 0; i < positions.length; i += 3) {
            const vertexIndex = i / 3;

            // Calculate grid coordinates (x, y) for this vertex
            const gridX = vertexIndex % (terrainSettings.segmentsW + 1);
            const gridY = Math.floor(vertexIndex / (terrainSettings.segmentsW + 1));

            // Normalize grid coordinates to 0-1 range
            const u = gridX / terrainSettings.segmentsW;
            const v = gridY / terrainSettings.segmentsH;

            // Bicubic interpolation for smoother sampling
            const height = bicubicInterpolation(u, v, canvas.width, canvas.height, pixels);

            // Store in heightmap array
            heightMap[vertexIndex] = height;
          }

          // Apply multiple smoothing passes
          let smoothedHeightMap = [...heightMap];
          for (let pass = 0; pass < terrainSettings.smoothingPasses; pass++) {
            smoothedHeightMap = smoothHeightmap(
              smoothedHeightMap,
              terrainSettings.segmentsW + 1,
              terrainSettings.segmentsH + 1,
              terrainSettings.smoothingFactor
            );
          }

          // Apply smoothed heights to geometry
          for (let i = 0; i < positions.length; i += 3) {
            const vertexIndex = i / 3;
            const height = smoothedHeightMap[vertexIndex];

            // Apply height to vertex Z coordinate (check for NaN)
            const newZ = height * terrainSettings.maxHeight * terrainSettings.heightScale;
            positions[i + 2] = isNaN(newZ) ? 0 : newZ;
          }

          // Update geometry
          geometry.attributes.position.needsUpdate = true;

          // Prevent NaN in bounding sphere
          for (let i = 0; i < positions.length; i++) {
            if (isNaN(positions[i])) {
              positions[i] = 0;
              console.warn(`Fixed NaN at position index ${i}`);
            }
          }

          // Update normals after position changes
          geometry.computeVertexNormals();

          // Success message
          console.log("Heightmap applied successfully");

          // Load diffuse texture
          textureLoader.load(
            '../assets/textures/heightmap_diffuse.png',
            (diffuseTexture) => {
              console.log("Diffuse texture loaded");

              // Configure texture - use only 1 repeat instead of 25
              diffuseTexture.wrapS = diffuseTexture.wrapT = THREE.RepeatWrapping;
              diffuseTexture.repeat.set(1, 1); // Changed from 25 to 1
              diffuseTexture.anisotropy = 16;

              // Create material with texture
              const material = new THREE.MeshStandardMaterial({
                map: diffuseTexture,
                roughness: 0.6,
                metalness: 0.1,
                displacementMap: null, // Optional: could add bump mapping for extra detail
                normalScale: new THREE.Vector2(1, 1)
              });

              // Create and add terrain
              const terrainMesh = new THREE.Mesh(geometry, material);
              terrainMesh.rotation.x = -Math.PI / 2;
              terrainMesh.receiveShadow = true;
              terrainMesh.name = 'terrain';

              // Replace default ground
              scene.remove(defaultGround);
              scene.add(terrainMesh);

              console.log("Terrain with texture created successfully");
            },
            undefined, // Progress callback
            (error) => {
              // Error handling for texture loading
              console.error("Failed to load diffuse texture:", error);

              // Create material without texture
              const material = new THREE.MeshStandardMaterial({
                color: 0x3b7d4e,
                roughness: 0.8,
                metalness: 0.2
              });

              // Create and add terrain without texture
              const terrainMesh = new THREE.Mesh(geometry, material);
              terrainMesh.rotation.x = -Math.PI / 2;
              terrainMesh.receiveShadow = true;
              terrainMesh.name = 'terrain';

              // Replace default ground
              scene.remove(defaultGround);
              scene.add(terrainMesh);

              console.log("Terrain without texture created successfully");
            }
          );
        } catch (pixelError) {
          console.error("Error accessing pixel data:", pixelError);
          // Keep default ground
        }
      } catch (error) {
        console.error("Error processing heightmap:", error);
        // Keep default ground
      }
    },
    undefined, // Progress callback
    (error) => {
      console.error("Failed to load heightmap:", error);
      // Keep default ground
    }
  );

  // Bicubic interpolation for smoother height sampling
  function bicubicInterpolation(u, v, width, height, pixels) {
    // Convert to pixel coordinates
    const x = u * (width - 1);
    const y = v * (height - 1);

    // Get integer and fractional parts
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;

    // Sample 16 surrounding points (4x4 grid)
    const values = [];
    for (let dy = -1; dy <= 2; dy++) {
      for (let dx = -1; dx <= 2; dx++) {
        const px = Math.min(Math.max(x0 + dx, 0), width - 1);
        const py = Math.min(Math.max(y0 + dy, 0), height - 1);
        const pixelIndex = (py * width + px) * 4;

        // Use red channel for height (assuming grayscale image)
        values.push(pixels[pixelIndex] / 255.0);
      }
    }

    // Apply bicubic interpolation weights
    let result = 0;
    const weights = getBicubicWeights(fx, fy);
    for (let i = 0; i < 16; i++) {
      result += values[i] * weights[i];
    }

    return Math.max(0, Math.min(1, result)); // Clamp to 0-1 range
  }

  // Calculate bicubic interpolation weights
  function getBicubicWeights(fx, fy) {
    const weights = [];
    for (let y = -1; y <= 2; y++) {
      for (let x = -1; x <= 2; x++) {
        weights.push(cubicPolynomial(fx - x) * cubicPolynomial(fy - y));
      }
    }
    return weights;
  }

  // Cubic polynomial for interpolation
  function cubicPolynomial(x) {
    x = Math.abs(x);
    if (x <= 1) {
      return (1.5 * x - 2.5) * x * x + 1;
    } else if (x < 2) {
      return ((-0.5 * x + 2.5) * x - 4) * x + 2;
    }
    return 0;
  }

  // Smooth heightmap using neighboring values
  function smoothHeightmap(heightMap, width, height, factor) {
    const result = new Float32Array(heightMap.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        let sum = 0;
        let count = 0;

        // Sample 3x3 neighborhood
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nidx = ny * width + nx;
              sum += heightMap[nidx];
              count++;
            }
          }
        }

        // Weighted average between original and smoothed value
        const average = sum / count;
        result[idx] = heightMap[idx] * (1 - factor) + average * factor;
      }
    }

    return result;
  }

  // Return the default ground
  return defaultGround;
}