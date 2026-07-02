import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TextureGenerator } from '../utils/textureGenerator';

interface FlowerSpriteProps {
  position: THREE.Vector3;
  scale: number; // growth scale (0 to 1)
  opacity: number; // tracking continuity opacity (0 to 1)
  timeOffset?: number;
}

export const FlowerSprite: React.FC<FlowerSpriteProps> = ({
  position,
  scale,
  opacity,
  timeOffset = 0
}) => {
  const spriteRef = useRef<THREE.Sprite | null>(null);

  // Load the procedural watercolor rose texture
  const roseTexture = React.useMemo(() => TextureGenerator.createRoseTexture(), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime() + timeOffset;

    if (spriteRef.current) {
      // 1. Position tracking
      spriteRef.current.position.copy(position);

      // 2. Breath and wiggle scale animations (Rule 5: soft organic waves)
      const baseScale = 0.16 * scale;
      const breathe = 1.0 + Math.sin(time * 2.5) * 0.06 + Math.cos(time * 1.1) * 0.02;
      const finalScale = baseScale * breathe;

      spriteRef.current.scale.set(finalScale, finalScale, 1.0);

      // 3. Update material properties
      const mat = spriteRef.current.material as THREE.SpriteMaterial;
      mat.opacity = opacity * Math.min(1.0, scale * 1.5);
    }
  });

  return (
    <sprite ref={spriteRef}>
      <spriteMaterial
        map={roseTexture}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </sprite>
  );
};

export default FlowerSprite;
