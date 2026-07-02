import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FlowerSpecies } from '../types';

interface HolographicFlowerProps {
  species: FlowerSpecies;
  scale: number; // growth/appearance scale (0 to 1)
  timeOffset?: number;
  hoverOffset?: THREE.Vector3;
}

// Curated pastel crystal color themes
export function generateCrystalSpecies(name: string): FlowerSpecies {
  const shapes: ('round' | 'pointed' | 'slender')[] = ['round', 'pointed', 'slender'];
  
  const themes = [
    { primary: '#ffc0cb', secondary: '#ffeef4' }, // Pearlescent Rose Pink
    { primary: '#a5f3fc', secondary: '#eff6ff' }, // Iridescent Ice Blue
    { primary: '#e9d5ff', secondary: '#faf5ff' }, // Glowing Amethyst Purple
    { primary: '#fef08a', secondary: '#fffbeb' }, // Radiant Solar Gold
    { primary: '#a7f3d0', secondary: '#f0fdf4' }  // Ethereal Aurora Green
  ];

  const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

  return {
    name,
    petalCount: 6 + Math.floor(Math.random() * 4), // 6 to 9 petals
    petalShape: shapes[Math.floor(Math.random() * shapes.length)],
    color: selectedTheme.primary,
    secondaryColor: selectedTheme.secondary,
    leafCount: 0, // No leaves for holographic/impossible flowers
    stemCurvature: 0,
    scale: 0.75 + Math.random() * 0.25
  };
}

export const HolographicFlower: React.FC<HolographicFlowerProps> = ({
  species,
  scale,
  timeOffset = 0,
  hoverOffset = new THREE.Vector3()
}) => {
  const petalsRef = useRef<THREE.Group | null>(null);
  const coreRef = useRef<THREE.Mesh | null>(null);

  // Petal geometries
  const coreGeometry = useMemo(() => new THREE.SphereGeometry(0.02, 12, 12), []);
  const petalGeometry = useMemo(() => {
    let w = 0.05;
    let h = 0.12;
    if (species.petalShape === 'round') {
      w = 0.08;
      h = 0.12;
    } else if (species.petalShape === 'slender') {
      w = 0.035;
      h = 0.15;
    }
    const geom = new THREE.PlaneGeometry(w, h);
    geom.translate(0, h / 2, 0); // anchor at base to unfold properly
    return geom;
  }, [species.petalShape]);

  // Translucent crystal materials
  const themeColor = useMemo(() => new THREE.Color(species.color), [species.color]);

  const crystalMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: themeColor,
      emissive: themeColor.clone().multiplyScalar(0.4),
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.05,
      transmission: 0.85, // glass-like transparency
      thickness: 0.25,
      ior: 1.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
  }, [themeColor]);

  const coreMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(species.secondaryColor)
    });
  }, [species.secondaryColor]);

  useEffect(() => {
    return () => {
      coreGeometry.dispose();
      petalGeometry.dispose();
      crystalMaterial.dispose();
      coreMaterial.dispose();
    };
  }, [coreGeometry, petalGeometry, crystalMaterial, coreMaterial]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime() + timeOffset;

    // Organic non-repetitive wiggle / flutter
    const wiggleScale = scale * (1.0 + (Math.sin(time * 2.8) * 0.04 + Math.cos(time * 1.3) * 0.02));

    if (petalsRef.current) {
      petalsRef.current.scale.set(wiggleScale, wiggleScale, wiggleScale);
      
      // Individual petal flutter
      petalsRef.current.children.forEach((child, idx) => {
        // Base fold opening based on scale (materializing animation)
        const baseAngle = THREE.MathUtils.lerp(1.3, 0.28, scale);
        
        // Sinusoidal petal breathing wiggles
        const wiggle = (Math.sin(time * 1.8 + idx * 1.1) * 0.04 + Math.cos(time * 0.8 + idx * 1.5) * 0.02) * scale;
        
        child.rotation.x = baseAngle + wiggle;
      });
    }

    if (coreRef.current) {
      coreRef.current.scale.set(wiggleScale, wiggleScale, wiggleScale);
    }
  });

  return (
    <group position={hoverOffset}>
      {/* Glowing core stamen */}
      <mesh ref={coreRef} geometry={coreGeometry} material={coreMaterial} />

      {/* Layer of wiggling crystal petals */}
      <group ref={petalsRef}>
        {Array.from({ length: species.petalCount }).map((_, idx) => {
          const rotationZ = (idx * Math.PI * 2) / species.petalCount;
          return (
            <group key={idx} rotation={[0, 0, rotationZ]}>
              <mesh position={[0, 0.04, 0]} geometry={petalGeometry} material={crystalMaterial} />
            </group>
          );
        })}

        {scale > 0.4 && (
          <pointLight
            color={themeColor}
            intensity={1.5 * scale}
            distance={0.6}
            decay={2.0}
          />
        )}
      </group>
    </group>
  );
};
export default HolographicFlower;
