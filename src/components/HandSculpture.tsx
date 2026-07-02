import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { HandData } from '../types';
import { HolographicFlower, generateCrystalSpecies } from '../flowers/HolographicFlower';
import { useParticles } from '../particles/ParticleContext';

interface HandSculptureProps {
  hand: HandData;
  color: THREE.Color;
  opacity?: number; // Visual continuity fade
}

// Hand skeleton segments
const SKELETON_SEGMENTS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm base connection
  [5, 9], [9, 13], [13, 17]
];

const FINGERTIPS = [4, 8, 12, 16, 20];
const FINGER_NAMES: ('thumb' | 'index' | 'middle' | 'ring' | 'pinky')[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

export const HandSculpture: React.FC<HandSculptureProps> = ({ hand, color, opacity = 1.0 }) => {
  const { spawn } = useParticles();
  const jointRefs = useRef<(THREE.Mesh | null)[]>([]);
  const segmentRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Smooth growths of flowers (Seed -> Fully Open, 800ms)
  const flowerGrowths = useRef<number[]>([0, 0, 0, 0, 0]);

  // Track wrist velocity for sways
  const lastWristPos = useRef(new THREE.Vector3());
  const handVelocity = useRef(new THREE.Vector3());

  // Generate 5 unique randomized crystal species for this hand
  const fingerSpecies = useMemo(() => {
    return [
      generateCrystalSpecies(hand.isLeft ? 'L-Thumb Crystal' : 'R-Thumb Crystal'),
      generateCrystalSpecies(hand.isLeft ? 'L-Index Crystal' : 'R-Index Crystal'),
      generateCrystalSpecies(hand.isLeft ? 'L-Middle Crystal' : 'R-Middle Crystal'),
      generateCrystalSpecies(hand.isLeft ? 'L-Ring Crystal' : 'R-Ring Crystal'),
      generateCrystalSpecies(hand.isLeft ? 'L-Pinky Crystal' : 'R-Pinky Crystal')
    ];
  }, [hand.isLeft]);

  // Reusable skeletal geometries (extremely thin constellation threads)
  const stemGeometry = useMemo(() => new THREE.CylinderGeometry(0.002, 0.004, 1, 6, 1), []);
  const jointGeometry = useMemo(() => new THREE.SphereGeometry(0.007, 8, 8), []);

  const glassMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: color,
      emissive: color.clone().multiplyScalar(0.4),
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.05,
      transmission: 0.9, // extremely thin glassy threads
      thickness: 0.05,
      transparent: true,
      opacity: 0.5 * opacity
    });
  }, [color, opacity]);

  // Cleanup WebGL resources
  useEffect(() => {
    return () => {
      stemGeometry.dispose();
      jointGeometry.dispose();
      glassMaterial.dispose();
    };
  }, [stemGeometry, jointGeometry, glassMaterial]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const dt = Math.min(0.03, delta);
    const landmarks = hand.smoothedLandmarks;

    if (landmarks.length < 21) return;

    // 1. Calculate Hand velocity vector
    const currentWrist = landmarks[0];
    if (lastWristPos.current.lengthSq() > 0) {
      const instantVelocity = new THREE.Vector3()
        .subVectors(currentWrist, lastWristPos.current)
        .multiplyScalar(1 / (dt || 0.016));
      
      handVelocity.current.lerp(instantVelocity, dt * 6.0);
    }
    lastWristPos.current.copy(currentWrist);

    // Update material opacity
    glassMaterial.opacity = 0.5 * opacity;

    // 2. Update Skeletal Joint Positions
    landmarks.forEach((pos, idx) => {
      const mesh = jointRefs.current[idx];
      if (mesh) {
        mesh.position.copy(pos);
      }
    });

    // 3. Update Thin Constellation Stems
    SKELETON_SEGMENTS.forEach((seg, idx) => {
      const mesh = segmentRefs.current[idx];
      if (mesh) {
        const A = landmarks[seg[0]];
        const B = landmarks[seg[1]];
        if (A && B) {
          const direction = new THREE.Vector3().subVectors(B, A);
          const length = direction.length();
          const midpoint = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);

          mesh.position.copy(midpoint);
          mesh.scale.set(1, length, 1);

          const quaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.clone().normalize()
          );
          mesh.quaternion.copy(quaternion);
        }
      }
    });

    // 4. Update Flower Growth Rates & Spawning Particles
    FINGERTIPS.forEach((tipIdx, fIdx) => {
      const tipPos = landmarks[tipIdx];
      const fingerName = FINGER_NAMES[fIdx];
      
      // Determine target growth based on hand state
      // Fists curl flowers down; open palms extend them fully
      let targetGrowth = hand.fingerCurls[fingerName];
      if (hand.gesture === 'fist') targetGrowth = 0.0;
      else if (hand.gesture === 'open') targetGrowth = 1.0;

      // Increment growth over exactly 800ms
      const growthRate = dt / 0.8;
      const diff = targetGrowth - flowerGrowths.current[fIdx];
      if (Math.abs(diff) < growthRate) {
        flowerGrowths.current[fIdx] = targetGrowth;
      } else {
        flowerGrowths.current[fIdx] += Math.sign(diff) * growthRate;
      }

      const growth = flowerGrowths.current[fIdx];

      // Magic Energy System: Faint sparkles orbiting fingertips at all times (Rule 5: Idle state)
      if (opacity > 0.1 && Math.random() < 0.22) {
        const orbitSpeed = 5.0;
        const orbitRadius = 0.032;
        const orbitAngle = time * orbitSpeed + fIdx * 1.3;
        const orbitOffset = new THREE.Vector3(
          Math.sin(orbitAngle) * orbitRadius,
          0.04 + Math.cos(orbitAngle) * 0.012,
          Math.cos(orbitAngle) * orbitRadius
        );

        spawn({
          position: tipPos.clone().add(orbitOffset),
          velocity: new THREE.Vector3((Math.random() - 0.5) * 0.03, 0.06 + Math.random() * 0.08, (Math.random() - 0.5) * 0.03),
          color: new THREE.Color(fingerSpecies[fIdx].color),
          size: 4 + Math.random() * 5,
          lifetime: 0.5 + Math.random() * 0.3,
          type: 'trail'
        });
      }

      // Spawn bubbles and pollen around floating crystal flowers
      if (opacity > 0.5 && growth > 0.45 && Math.random() < 0.07) {
        const radius = 0.08 * growth;
        const angle = Math.random() * Math.PI * 2;
        const offset = new THREE.Vector3(
          Math.cos(angle) * radius,
          0.05 + (Math.random() - 0.5) * 0.04, // spawn above tip
          Math.sin(angle) * radius
        );
        
        // Spawn a floating bubble
        if (Math.random() < 0.3) {
          spawn({
            position: tipPos.clone().add(offset),
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.4, (Math.random() - 0.5) * 0.1),
            color: new THREE.Color('#ffffff'),
            size: 14 + Math.random() * 8,
            lifetime: 2.2 + Math.random() * 0.8,
            type: 'bubble'
          });
        }

        // Spawn golden pollen
        spawn({
          position: tipPos.clone().add(offset),
          velocity: new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.2 + Math.random() * 0.15, (Math.random() - 0.5) * 0.08),
          color: new THREE.Color(fingerSpecies[fIdx].color),
          size: 6 + Math.random() * 6,
          lifetime: 1.2 + Math.random() * 0.8,
          type: 'pollen'
        });
      }
    });

    // WAVE GESTURE / SPEED TRAILS -> Spawns petal trailing ribbons in air
    const isWaving = hand.gesture === 'open' && handVelocity.current.length() > 2.0;
    if (opacity > 0.5 && isWaving && Math.random() < 0.35) {
      const tipPos = landmarks[8]; // Index tip
      if (tipPos) {
        spawn({
          position: tipPos.clone(),
          velocity: new THREE.Vector3((Math.random() - 0.5) * 0.3, -0.4, (Math.random() - 0.5) * 0.3),
          color: new THREE.Color(fingerSpecies[1].color),
          size: 26 + Math.random() * 12,
          lifetime: 1.8 + Math.random() * 0.8,
          type: 'petal'
        });
      }
    }
  });

  return (
    <group>
      {/* 1. Constellation Joint Nodes */}
      {hand.smoothedLandmarks.map((_, idx) => (
        <mesh
          key={`joint-${idx}`}
          ref={(el) => { jointRefs.current[idx] = el; }}
          geometry={jointGeometry}
          material={glassMaterial}
        />
      ))}

      {/* 2. Thin Glass Thread Segments */}
      {SKELETON_SEGMENTS.map((_, idx) => (
        <mesh
          key={`segment-${idx}`}
          ref={(el) => { segmentRefs.current[idx] = el; }}
          geometry={stemGeometry}
          material={glassMaterial}
        />
      ))}

      {/* 3. Reusable Floating Crystal Flowers */}
      {FINGERTIPS.map((tipIdx, fIdx) => {
        const growth = flowerGrowths.current[fIdx];
        const hoverOffset = new THREE.Vector3(0, 0.045, 0);

        return (
          <group key={`flower-${fIdx}`} position={hand.smoothedLandmarks[tipIdx] || new THREE.Vector3()}>
            {growth > 0.01 && (
              <HolographicFlower
                species={fingerSpecies[fIdx]}
                scale={growth * opacity}
                timeOffset={fIdx * 1.5}
                hoverOffset={hoverOffset}
              />
            )}
          </group>
        );
      })}
    </group>
  );
};
export default HandSculpture;
