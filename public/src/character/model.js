// public/src/character/model.js
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export function createCharacter(scene) {
  return new Promise((resolve, reject) => {
    console.log("Loading character model...");
    const loader = new FBXLoader();

    // Load the character model
    loader.load('../assets/models/character.fbx', (character) => {
      console.log("Character model loaded, processing...");

      // Scale and position the character
      character.scale.setScalar(0.01);
      character.position.set(0, 2, 0);
      character.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Add to scene
      scene.add(character);

      // Store animations
      character.animations = [];

      // Load animations
      const animationPaths = {
        idle: '../assets/models/standing idle.fbx',
        walkForward: '../assets/models/Standing Walk Forward.fbx',
        walkBack: '../assets/models/Standing Walk Back.fbx',
        walkLeft: '../assets/models/Standing Walk Left.fbx',
        walkRight: '../assets/models/Standing Walk Right.fbx',
        runForward: '../assets/models/Standing Run Forward.fbx',
        runBack: '../assets/models/Standing Run Back.fbx',
        runLeft: '../assets/models/Standing Run Left.fbx',
        runRight: '../assets/models/Standing Run Right.fbx',
        jump: '../assets/models/Standing Jump.fbx'
      };

      // Load each animation
      const animPromises = Object.entries(animationPaths).map(([name, path]) => {
        return new Promise((resolveAnim) => {
          loader.load(path, (animFBX) => {
            console.log(`Loaded animation: ${name}`);
            const anim = animFBX.animations[0];
            if (anim) {
              anim.name = name;
              character.animations.push(anim);
            } else {
              console.warn(`No animation found in ${path}`);
            }
            resolveAnim();
          }, undefined, (error) => {
            console.warn(`Failed to load animation ${name}:`, error);
            resolveAnim(); // Resolve anyway to continue loading others
          });
        });
      });

      // Wait for all animations to load, then process them
      Promise.all(animPromises).then(() => {
        console.log(`Loaded ${character.animations.length} animations`);

        // Find the root bone
        let rootBone;
        character.traverse(child => {
          if (child.isSkinnedMesh && child.skeleton) {
            rootBone = child.skeleton.bones[0]; // Typically the root bone is the first in the skeleton
          }
        });

        if (rootBone) {
          console.log(`Root bone found: ${rootBone.name}`);

          // Process each animation clip to remove position tracks for the root bone
          character.animations = character.animations.map(clip => {
            const newTracks = clip.tracks.filter(track => {
              const [targetName, property] = track.name.split('.');
              // Exclude position tracks for the root bone
              if (targetName === rootBone.name && property === 'position') {
                return false;
              }
              return true;
            });
            // Create a new animation clip with the filtered tracks
            return new THREE.AnimationClip(clip.name, clip.duration, newTracks);
          });
          console.log("Processed animations to remove root motion");
        } else {
          console.warn("No root bone found, cannot remove root motion");
        }

        resolve(character);
      });

    }, undefined, (error) => {
      console.error("Error loading character model:", error);
      reject(error);
    });
  });
}