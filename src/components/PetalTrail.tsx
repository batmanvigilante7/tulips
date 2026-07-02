import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TextureGenerator } from '../utils/textureGenerator';

interface PetalTrailProps {
  indexTipPosition: THREE.Vector3 | null;
  active: boolean; // Wave active
  opacity: number;
}

const TRAIL_LENGTH = 18;

export const PetalTrail: React.FC<PetalTrailProps> = ({
  indexTipPosition,
  active,
  opacity
}) => {
  const groupRef = useRef<THREE.Group | null>(null);

  // Load the transparent rose petal texture
  const petalTexture = useMemo(() => TextureGenerator.createPetalTexture(), []);

  // History buffer for trail positions and rotations
  const trailHistory = useMemo(() => {
    return Array.from({ length: TRAIL_LENGTH }).map(() => ({
      position: new THREE.Vector3(0, -999, 0), // hide initially
      rotation: Math.random() * Math.PI * 2,
      scale: 0.05 + Math.random() * 0.05
    }));
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(0.03, delta);
    const time = state.clock.getElapsedTime();

    if (groupRef.current) {
      // 1. Shift history and push new point
      if (active && indexTipPosition) {
        // Shift trail points
        for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
          trailHistory[i].position.copy(trailHistory[i - 1].position);
          trailHistory[i].rotation = trailHistory[i - 1].rotation;
          trailHistory[i].scale = trailHistory[i - 1].scale;
        }
        
        // Push new point with jitter
        trailHistory[0].position.copy(indexTipPosition);
        // Small organic drift offsets
        trailHistory[0].position.x += (Math.random() - 0.5) * 0.015;
        trailHistory[0].position.y += (Math.random() - 0.5) * 0.015;
        
        trailHistory[0].rotation = time * 2.5 + Math.random() * 0.5;
        trailHistory[0].scale = 0.08 + Math.random() * 0.04;
      } else {
        // If inactive, slowly fade coordinates out offscreen
        for (let i = 0; i < TRAIL_LENGTH; i++) {
          trailHistory[i].position.lerp(new THREE.Vector3(0, -999, 0), dt * 4.0);
        }
      }

      // 2. Update sprite instances
      groupRef.current.children.forEach((child, idx) => {
        const sprite = child as THREE.Sprite;
        const data = trailHistory[idx];

        sprite.position.copy(data.position);
        
        // Rotates the sprite on the screen plane
        sprite.material.rotation = data.rotation;

        // Scale and opacity fades along the tail of the trail
        const trailRatio = 1.0 - idx / TRAIL_LENGTH;
        const currentScale = data.scale * trailRatio;
        sprite.scale.set(currentScale, currentScale, 1.0);

        // Slow fade out curve
        sprite.material.opacity = opacity * trailRatio * 0.85;
      });
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: TRAIL_LENGTH }).map((_, idx) => (
        <sprite key={idx}>
          <spriteMaterial
            map={petalTexture}
            transparent
            depthWrite={false}
            blending={THREE.NormalBlending}
            opacity={0}
          />
        </sprite>
      ))}
    </group>
  );
};

export default PetalTrail;
