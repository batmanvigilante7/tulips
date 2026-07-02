import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface FlowerMeshProps {
  scale: number; // 0 (closed) to 1 (bloomed)
  curl: number;  // 0 (curled finger -> closed petals) to 1 (extended -> open petals)
  color: THREE.Color;
}

export const FlowerMesh: React.FC<FlowerMeshProps> = ({ scale, curl, color }) => {
  const petalsRef = useRef<THREE.Group | null>(null);
  const coreRef = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Subtle breathing animation for petals and stamen core
    const breatheFactor = 1.0 + Math.sin(time * 2.8) * 0.05 * (0.3 + 0.7 * curl);
    const targetScale = scale * breatheFactor;

    if (petalsRef.current) {
      petalsRef.current.scale.set(targetScale, targetScale, targetScale);
      
      // Individual petal sways (breathing rotation)
      petalsRef.current.children.forEach((petal, idx) => {
        // Base fold angle: folds inward as curl decreases (closer to 0)
        // 0.25 is open rotation, 1.25 is closed bud rotation
        const baseFold = THREE.MathUtils.lerp(1.22, 0.25, curl);
        
        // Dynamic wind sway (sinusoidal offset per petal)
        const sway = Math.sin(time * 2.2 + idx * 1.2) * 0.04 * curl;
        
        petal.rotation.x = baseFold + sway;
      });
    }

    if (coreRef.current) {
      coreRef.current.scale.set(targetScale, targetScale, targetScale);
    }
  });

  // Material settings for high-end glowing translucency
  const petalMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: color,
      emissive: color.clone().multiplyScalar(0.4),
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.1,
      transmission: 0.75, // glowing glass-like look
      thickness: 0.2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
  }, [color]);

  const coreMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0xffdf00, // Golden core stamen
    });
  }, []);

  return (
    <group>
      {/* Flower core stamen */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <primitive object={coreMaterial} attach="material" />
      </mesh>

      {/* Petals group */}
      <group ref={petalsRef}>
        {Array.from({ length: 5 }).map((_, i) => {
          const rotationZ = (i * Math.PI * 2) / 5;
          return (
            <group key={i} rotation={[0, 0, rotationZ]}>
              <mesh position={[0, 0.08, 0]}>
                {/* Curved petal geometry */}
                <planeGeometry args={[0.075, 0.15]} />
                <primitive object={petalMaterial} attach="material" />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
};

// Memoize helpers to prevent memory leaks in R3F
import { useMemo } from 'react';
export default FlowerMesh;
