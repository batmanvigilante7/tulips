import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ButterflyMeshProps {
  targetPosition: THREE.Vector3;
  active: boolean; // if false, flutters away offscreen
  colorTheme?: string;
}

export const ButterflyMesh: React.FC<ButterflyMeshProps> = ({
  targetPosition,
  active,
  colorTheme = '#fbcfe8'
}) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const leftWingRef = useRef<THREE.Mesh | null>(null);
  const rightWingRef = useRef<THREE.Mesh | null>(null);

  // Hovering offset vectors
  const currentPos = useRef(new THREE.Vector3(0, 5, 0)); // Spawn offscreen top initially

  // Wing and body geometries
  const bodyGeometry = useMemo(() => new THREE.CylinderGeometry(0.004, 0.004, 0.05, 6), []);
  const wingGeometry = useMemo(() => {
    // Elegant butterfly wing shape (triangular tapered plane)
    const geom = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0.0, 0.0, 0.0,    // base joint
      0.06, 0.05, 0.01,  // top tip
      0.05, -0.04, 0.0, // bottom tip
    ]);
    const uvs = new Float32Array([
      0.0, 0.5,
      1.0, 1.0,
      1.0, 0.0
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.computeVertexNormals();
    return geom;
  }, []);

  const wingColor = useMemo(() => new THREE.Color(colorTheme), [colorTheme]);
  const butterflyMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: wingColor,
      emissive: wingColor.clone().multiplyScalar(0.35),
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.75, // glowing glass wings
      thickness: 0.05,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
  }, [wingColor]);

  const bodyMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0x2e1a47 // deep violet body
    });
  }, []);

  useEffect(() => {
    return () => {
      bodyGeometry.dispose();
      wingGeometry.dispose();
      butterflyMaterial.dispose();
      bodyMaterial.dispose();
    };
  }, [bodyGeometry, wingGeometry, butterflyMaterial, bodyMaterial]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const dt = Math.min(0.03, delta);

    // 1. Hover Offset Calculation
    // Fluttering hover offset
    const hoverOffset = new THREE.Vector3(
      Math.sin(time * 3.2) * 0.04,
      Math.cos(time * 2.8) * 0.03,
      Math.sin(time * 1.5) * 0.03
    );

    // Determine target location: if inactive, fly offscreen top-right
    const destination = active
      ? targetPosition.clone().add(hoverOffset)
      : new THREE.Vector3(2.5, 4.0, 0.5);

    const dist = currentPos.current.distanceTo(destination);

    // 2. Fly Path Animation (Spring-lerp velocity)
    const lerpSpeed = dist < 0.15 ? 3.0 : 5.0; // slow down when landing
    currentPos.current.lerp(destination, dt * lerpSpeed);

    if (groupRef.current) {
      groupRef.current.position.copy(currentPos.current);

      // Rotate butterfly to face flight direction
      const diff = new THREE.Vector3().subVectors(destination, currentPos.current);
      if (diff.lengthSq() > 0.0001) {
        const targetAngleY = Math.atan2(diff.x, diff.z) + Math.PI;
        // Dampen Y rotation
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetAngleY, dt * 6.0);
      }

      // Rotate slightly on Z based on lateral velocity (bank curves)
      const bankAngle = (destination.x - currentPos.current.x) * -2.0;
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, bankAngle, dt * 5.0);
    }

    // 3. Wing Flapping Animation
    // If landed (close to fingertip), slow flap to a breathing ripple
    const isLanded = active && dist < 0.08;
    const flapFreq = isLanded ? 2.5 : 22.0;
    const flapAmp = isLanded ? 0.18 : 0.65;
    const baseAngle = isLanded ? 0.22 : 0.0; // slightly open when rested

    const flap = baseAngle + Math.sin(time * flapFreq) * flapAmp;

    if (leftWingRef.current && rightWingRef.current) {
      leftWingRef.current.rotation.y = flap;
      rightWingRef.current.rotation.y = -flap;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Butterfly body cylinder */}
      <mesh geometry={bodyGeometry} material={bodyMaterial} rotation={[Math.PI / 2, 0, 0]} />

      {/* Left Wing */}
      <mesh
        ref={leftWingRef}
        geometry={wingGeometry}
        material={butterflyMaterial}
        position={[-0.001, 0, 0]}
        rotation={[0.1, 0, 0]}
      />

      {/* Right Wing (mirrored Y rotation) */}
      <mesh
        ref={rightWingRef}
        geometry={wingGeometry}
        material={butterflyMaterial}
        position={[0.001, 0, 0]}
        rotation={[0.1, Math.PI, 0]}
      />
    </group>
  );
};
export default ButterflyMesh;
