import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FlowerType } from '../store/settingsStore';

interface ProceduralFlowerProps {
  position?: [number, number, number] | THREE.Vector3;
  rotation?: [number, number, number] | THREE.Euler;
  scale?: number;
  color?: string;
  species: FlowerType;
  bloomProgress: number; // 0.0 = bud/seed, 1.0 = fully open
  opacity?: number;
  handVelocity?: THREE.Vector3;
  gestureState?: string;
  idleAnimation?: boolean;
}

// Helper to construct vertex-colored gradients procedurally on geometries
function applyVertexColors(geometry: THREE.BufferGeometry, baseColorStr: string, tipColorStr: string, length: number) {
  const position = geometry.attributes.position;
  if (!position) return;
  const count = position.count;
  const colors = new Float32Array(count * 3);
  const base = new THREE.Color(baseColorStr);
  const tip = new THREE.Color(tipColorStr);

  for (let i = 0; i < count; i++) {
    const y = position.getY(i);
    const ratio = Math.max(0, Math.min(1, y / length));
    const mixed = base.clone().lerp(tip, ratio);
    colors[i * 3] = mixed.r;
    colors[i * 3 + 1] = mixed.g;
    colors[i * 3 + 2] = mixed.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// 1. ROSE GEOMETRY BUILDER
function createRosePetalGeometry(width: number, length: number, curl: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(width * 0.45, length * 0.05, width * 0.6, length * 0.4, width * 0.5, length * 0.95);
  shape.bezierCurveTo(width * 0.45, length * 1.05, -width * 0.45, length * 1.05, -width * 0.5, length * 0.95);
  shape.bezierCurveTo(-width * 0.6, length * 0.4, -width * 0.45, length * 0.05, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
  });

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ny = pos.getY(i) / length;
    const nx = pos.getX(i) / (width * 0.5);
    // Curl backwards on Z axis at the outer tip
    pos.setZ(i, pos.getZ(i) - ny * ny * curl - (1 - nx * nx) * ny * 0.02);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.translate(0, 0, -0.003); // center the extrusion
  return geo;
}

// 2. TULIP GEOMETRY BUILDER
function createTulipPetalGeometry(width: number, length: number, curl: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(width * 0.4, length * 0.1, width * 0.5, length * 0.6, width * 0.1, length * 0.98);
  shape.bezierCurveTo(0, length * 1.02, 0, length * 1.02, -width * 0.1, length * 0.98);
  shape.bezierCurveTo(-width * 0.5, length * 0.6, -width * 0.4, length * 0.1, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.005,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.002,
    bevelSegments: 2,
  });

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ny = pos.getY(i) / length;
    const nx = Math.abs(pos.getX(i)) / (width * 0.5);
    // Curl inwards on Z axis to form a cup shape
    pos.setZ(i, pos.getZ(i) + ny * (1 - nx) * curl);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.translate(0, 0, -0.0025);
  return geo;
}

// 3. DAISY PETAL GEOMETRY BUILDER
function createDaisyPetalGeometry(width: number, length: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(width * 0.4, length * 0.05, width * 0.45, length * 0.5, width * 0.35, length * 0.95);
  shape.bezierCurveTo(width * 0.2, length * 1.01, -width * 0.2, length * 1.01, -width * 0.35, length * 0.95);
  shape.bezierCurveTo(-width * 0.45, length * 0.5, -width * 0.4, length * 0.05, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
  });

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ny = pos.getY(i) / length;
    // Keep daisy petals flat with just a subtle upward Z curve
    pos.setZ(i, pos.getZ(i) + ny * ny * 0.005);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.translate(0, 0, -0.002);
  return geo;
}

// 4. CHERRY BLOSSOM GEOMETRY BUILDER
function createCherryBlossomPetalGeometry(width: number, length: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(width * 0.5, length * 0.1, width * 0.65, length * 0.6, width * 0.35, length * 0.95);
  shape.bezierCurveTo(width * 0.2, length * 1.01, width * 0.08, length * 0.94, 0, length * 0.88); // notched tip center
  shape.bezierCurveTo(-width * 0.08, length * 0.94, -width * 0.2, length * 1.01, -width * 0.35, length * 0.95);
  shape.bezierCurveTo(-width * 0.65, length * 0.6, -width * 0.5, length * 0.1, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
  });

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ny = pos.getY(i) / length;
    // Soft bowl curve
    pos.setZ(i, pos.getZ(i) - ny * ny * 0.015);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.translate(0, 0, -0.002);
  return geo;
}

export const ProceduralFlower: React.FC<ProceduralFlowerProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  color = '#ff69b4',
  species,
  bloomProgress,
  opacity = 1.0,
  handVelocity = new THREE.Vector3(0, 0, 0),
  idleAnimation = true,
}) => {
  const rootRef = useRef<THREE.Group | null>(null);
  const headRef = useRef<THREE.Group | null>(null);
  const stemRef = useRef<THREE.Mesh | null>(null);
  const leavesRef = useRef<THREE.Group | null>(null);

  // Physical inertia bending vectors
  const elasticBend = useRef(new THREE.Vector3());

  // Set secondary/tip colors based on species and theme
  const colors = useMemo(() => {
    const primary = new THREE.Color(color);
    let secondary = primary.clone().lerp(new THREE.Color('#ffffff'), 0.35);
    let stem = '#3d8c53'; // soft green

    if (species === 'lavender') {
      secondary = new THREE.Color('#e040fb');
    } else if (species === 'daisy') {
      secondary = new THREE.Color('#ffffff'); // white outer petals, gold core
    } else if (species === 'tulip') {
      secondary = primary.clone().multiplyScalar(0.7); // darker base gradient
    } else if (species === 'cherryblossom') {
      secondary = primary.clone().multiplyScalar(0.5); // deep pink base gradient
    }

    return {
      primary,
      secondary,
      stem: new THREE.Color(stem),
    };
  }, [color, species]);

  // Height definitions
  const stemHeight = useMemo(() => {
    switch (species) {
      case 'lavender': return 0.5;
      case 'tulip': return 0.45;
      case 'hydrangea': return 0.35;
      default: return 0.4;
    }
  }, [species]);

  // Geometries generator
  const geometries = useMemo(() => {
    // 1. Petals
    let petalGeo: THREE.BufferGeometry;
    switch (species) {
      case 'rose':
        petalGeo = createRosePetalGeometry(0.13, 0.16, 0.05);
        applyVertexColors(petalGeo, colors.secondary.getStyle(), colors.primary.getStyle(), 0.16);
        break;
      case 'tulip':
        petalGeo = createTulipPetalGeometry(0.12, 0.22, 0.06);
        applyVertexColors(petalGeo, colors.secondary.getStyle(), colors.primary.getStyle(), 0.22);
        break;
      case 'daisy':
        petalGeo = createDaisyPetalGeometry(0.026, 0.16);
        applyVertexColors(petalGeo, '#ffa500', colors.secondary.getStyle(), 0.16);
        break;
      case 'cherryblossom':
        petalGeo = createCherryBlossomPetalGeometry(0.08, 0.12);
        applyVertexColors(petalGeo, colors.secondary.getStyle(), colors.primary.getStyle(), 0.12);
        break;
      case 'lavender':
        petalGeo = createDaisyPetalGeometry(0.012, 0.04);
        applyVertexColors(petalGeo, colors.primary.getStyle(), colors.secondary.getStyle(), 0.04);
        break;
      case 'hydrangea':
      default:
        petalGeo = createCherryBlossomPetalGeometry(0.04, 0.05);
        applyVertexColors(petalGeo, colors.secondary.getStyle(), colors.primary.getStyle(), 0.05);
        break;
    }

    // 2. Central Core
    let coreGeo: THREE.BufferGeometry;
    if (species === 'daisy') {
      coreGeo = new THREE.SphereGeometry(0.038, 16, 16);
      coreGeo.scale(1, 0.4, 1); // flattened core disc
    } else {
      coreGeo = new THREE.SphereGeometry(0.015, 12, 12);
    }

    // 3. Leaf
    const leafGeo = new THREE.ConeGeometry(0.025, 0.12, 4);
    leafGeo.rotateX(Math.PI / 2);
    leafGeo.translate(0, 0.06, 0);

    // 4. Stem
    const stemGeo = new THREE.CylinderGeometry(0.007, 0.01, 1, 8, 1);
    stemGeo.translate(0, 0.5, 0); // center base pivot

    return {
      petal: petalGeo,
      core: coreGeo,
      leaf: leafGeo,
      stem: stemGeo,
    };
  }, [species, colors]);

  // Materials generator
  const materials = useMemo(() => {
    // Glassmorphic translucent physical material
    const petalMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      transmission: 0.72,
      thickness: 0.12,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: opacity,
      emissive: colors.primary.clone().multiplyScalar(0.3),
      emissiveIntensity: 0.7,
    });

    const stemMat = new THREE.MeshPhysicalMaterial({
      color: colors.stem,
      transmission: 0.5,
      thickness: 0.08,
      roughness: 0.45,
      metalness: 0.05,
      transparent: true,
      opacity: opacity,
    });

    const leafMat = new THREE.MeshStandardMaterial({
      color: colors.stem.clone().multiplyScalar(0.85),
      roughness: 0.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: opacity,
    });

    const coreMat = new THREE.MeshBasicMaterial({
      color: species === 'daisy' ? new THREE.Color('#ffa500') : colors.secondary,
      transparent: true,
      opacity: opacity,
    });

    return {
      petal: petalMat,
      stem: stemMat,
      leaf: leafMat,
      core: coreMat,
    };
  }, [colors, opacity, species]);

  // GPU disposal hook
  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [geometries, materials]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const dt = Math.min(0.03, delta);

    // 1. Cubic ease-out growth curve
    const easedGrowth = 1.0 - Math.pow(1.0 - bloomProgress, 3.0);
    const stemProgress = Math.min(1.0, Math.max(0.0, easedGrowth / 0.4));
    const flowerHeadProgress = Math.min(1.0, Math.max(0.0, (easedGrowth - 0.4) / 0.6));

    // Elastic inertia bending calculation (spring mechanics)
    const targetBend = handVelocity.clone().multiplyScalar(-0.06);
    elasticBend.current.lerp(targetBend, dt * 7.0);

    // 2. Animate entire root (position & rotation & scale)
    if (rootRef.current) {
      const posVec = position instanceof THREE.Vector3 ? position : new THREE.Vector3(...position);
      rootRef.current.position.copy(posVec);

      // Rotate group in response to hand motion
      rootRef.current.rotation.z = elasticBend.current.x;
      rootRef.current.rotation.x = -elasticBend.current.y;

      // Add rotation prop values
      if (rotation instanceof THREE.Euler) {
        rootRef.current.rotation.x += rotation.x;
        rootRef.current.rotation.y += rotation.y;
        rootRef.current.rotation.z += rotation.z;
      } else {
        rootRef.current.rotation.x += rotation[0];
        rootRef.current.rotation.y += rotation[1];
        rootRef.current.rotation.z += rotation[2];
      }
    }

    // 3. Stem Scaling
    if (stemRef.current) {
      stemRef.current.scale.set(1.0, stemHeight * stemProgress, 1.0);
    }

    // 4. Animate Leaves
    if (leavesRef.current) {
      leavesRef.current.scale.setScalar(stemProgress);
      leavesRef.current.children.forEach((leaf, idx) => {
        leaf.position.y = stemHeight * stemProgress * (0.3 + idx * 0.3);
        if (idleAnimation) {
          leaf.rotation.z = (idx === 0 ? 1 : -1) * (0.4 + Math.sin(time * 1.5 + idx) * 0.05);
        }
      });
    }

    // 5. Animate Flower Head
    if (headRef.current) {
      headRef.current.position.set(0, stemHeight * stemProgress, 0);
      headRef.current.scale.setScalar(flowerHeadProgress);

      if (idleAnimation && flowerHeadProgress > 0.01) {
        // Multi-frequency organic breathing
        const breathe = 1.0 + (Math.sin(time * 2.0) * 0.02 + Math.cos(time * 0.8) * 0.008) * flowerHeadProgress;
        headRef.current.scale.multiplyScalar(breathe);

        // Add a gentle floating wave sway
        headRef.current.rotation.y = time * 0.15;
        headRef.current.rotation.x = Math.sin(time * 1.2) * 0.035 * flowerHeadProgress;
        headRef.current.rotation.z = Math.cos(time * 1.0) * 0.03 * flowerHeadProgress;
      }

      // Animate child petals unfolding
      headRef.current.children.forEach((child) => {
        if (child.name.startsWith('petal-group')) {
          const depth = child.userData.depth || 0; // outer: 0, middle: 1, inner: 2
          let startAngle = 1.3; // closed bud angle
          let endAngle = 0.25; // fully open angle

          if (species === 'tulip') {
            startAngle = 0.8;
            endAngle = 0.18;
          } else if (species === 'daisy') {
            startAngle = 1.4;
            endAngle = 1.57; // flat horizontal
          } else if (species === 'cherryblossom') {
            startAngle = 1.1;
            endAngle = 1.4;
          }

          // Inner petals open less, outer petals open more
          const targetAngle = THREE.MathUtils.lerp(startAngle, endAngle - depth * 0.12, flowerHeadProgress);
          const petalMesh = child.children[0];
          if (petalMesh) {
            petalMesh.rotation.x = targetAngle;
            // Scale petal width dynamically based on growth
            petalMesh.scale.setScalar(flowerHeadProgress * (1.0 - depth * 0.15));
          }
        }
      });
    }
  });

  // Render individual flower structure components
  const renderFlowerHead = () => {
    switch (species) {
      case 'rose':
        return (
          <>
            <mesh geometry={geometries.core} material={materials.core} />
            {/* Outer Petal Ring (8) */}
            {Array.from({ length: 8 }).map((_, i) => {
              const rotZ = (i * Math.PI * 2) / 8;
              return (
                <group key={`outer-${i}`} name="petal-group-outer" rotation={[0, 0, rotZ]} userData={{ depth: 0 }}>
                  <mesh geometry={geometries.petal} material={materials.petal} position={[0, 0.01, 0]} />
                </group>
              );
            })}
            {/* Middle Petal Ring (5) */}
            {Array.from({ length: 5 }).map((_, i) => {
              const rotZ = (i * Math.PI * 2) / 5 + Math.PI / 5;
              return (
                <group key={`mid-${i}`} name="petal-group-mid" rotation={[0, 0, rotZ]} userData={{ depth: 1 }}>
                  <mesh geometry={geometries.petal} material={materials.petal} position={[0, 0.015, 0.015]} />
                </group>
              );
            })}
            {/* Inner Petal Ring (3) */}
            {Array.from({ length: 3 }).map((_, i) => {
              const rotZ = (i * Math.PI * 2) / 3 + Math.PI / 3;
              return (
                <group key={`inner-${i}`} name="petal-group-inner" rotation={[0, 0, rotZ]} userData={{ depth: 2 }}>
                  <mesh geometry={geometries.petal} material={materials.petal} position={[0, 0.02, 0.025]} />
                </group>
              );
            })}
          </>
        );

      case 'tulip':
        return (
          <>
            <mesh geometry={geometries.core} material={materials.core} />
            {/* 3 Inner Petals */}
            {Array.from({ length: 3 }).map((_, i) => {
              const rotZ = (i * Math.PI * 2) / 3;
              return (
                <group key={`inner-${i}`} name="petal-group-inner" rotation={[0, 0, rotZ]} userData={{ depth: 1 }}>
                  <mesh geometry={geometries.petal} material={materials.petal} position={[0, 0.01, 0.005]} />
                </group>
              );
            })}
            {/* 3 Outer Petals */}
            {Array.from({ length: 3 }).map((_, i) => {
              const rotZ = (i * Math.PI * 2) / 3 + Math.PI / 3;
              return (
                <group key={`outer-${i}`} name="petal-group-outer" rotation={[0, 0, rotZ]} userData={{ depth: 0 }}>
                  <mesh geometry={geometries.petal} material={materials.petal} position={[0, 0.005, 0.018]} />
                </group>
              );
            })}
          </>
        );

      case 'daisy':
        return (
          <>
            {/* Rich gold central pistil core */}
            <mesh geometry={geometries.core} material={materials.core} />
            {/* 24 flat narrow white petals */}
            {Array.from({ length: 24 }).map((_, i) => {
              const rotZ = (i * Math.PI * 2) / 24;
              return (
                <group key={`daisy-${i}`} name="petal-group-outer" rotation={[0, 0, rotZ]} userData={{ depth: 0 }}>
                  <mesh geometry={geometries.petal} material={materials.petal} position={[0, 0.02, 0.005]} />
                </group>
              );
            })}
          </>
        );

      case 'cherryblossom':
        return (
          <>
            {/* Small yellow pistil core */}
            <mesh geometry={geometries.core} material={materials.core} />
            {/* 5 notched pink petals */}
            {Array.from({ length: 5 }).map((_, i) => {
              const rotZ = (i * Math.PI * 2) / 5;
              return (
                <group key={`cherry-${i}`} name="petal-group-outer" rotation={[0, 0, rotZ]} userData={{ depth: 0 }}>
                  <mesh geometry={geometries.petal} material={materials.petal} position={[0, 0.01, 0.008]} />
                </group>
              );
            })}
            {/* Small golden stamens */}
            {Array.from({ length: 10 }).map((_, i) => {
              const angle = (i * Math.PI * 2) / 10;
              return (
                <group key={`stamen-${i}`} rotation={[0, 0, angle]}>
                  <mesh position={[0, 0.022, 0]}>
                    <cylinderGeometry args={[0.001, 0.001, 0.024]} />
                    <meshBasicMaterial color="#ffd700" transparent opacity={opacity} />
                  </mesh>
                  <mesh position={[0, 0.034, 0]}>
                    <sphereGeometry args={[0.0028]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={opacity} />
                  </mesh>
                </group>
              );
            })}
          </>
        );

      case 'lavender':
        return (
          <>
            {/* Lavender renders whorls of tiny purple florets vertically along the upper stem */}
            {Array.from({ length: 6 }).map((_, whorlIdx) => {
              const yOffset = (whorlIdx - 2.5) * 0.06;
              return (
                <group key={`whorl-${whorlIdx}`} position={[0, yOffset, 0]}>
                  {Array.from({ length: 6 }).map((_, floretIdx) => {
                    const rotZ = (floretIdx * Math.PI * 2) / 6 + (whorlIdx * Math.PI) / 3;
                    return (
                      <group key={`floret-${floretIdx}`} rotation={[0.4, 0, rotZ]}>
                        <mesh geometry={geometries.petal} material={materials.petal} position={[0, 0.015, 0]} />
                      </group>
                    );
                  })}
                </group>
              );
            })}
          </>
        );

      case 'hydrangea':
        return (
          <>
            {/* Hydrangea dome: mapping 18 tiny 4-petaled florets on the upper hemisphere */}
            {Array.from({ length: 18 }).map((_, floretIdx) => {
              // Distribute points evenly on hemisphere
              const u = Math.random();
              const v = Math.random();
              const theta = u * 2.0 * Math.PI;
              const phi = Math.acos(2.0 * v - 1.0) * 0.5; // limit to upper hemisphere

              const fx = Math.sin(phi) * Math.cos(theta) * 0.062;
              const fy = Math.cos(phi) * 0.062;
              const fz = Math.sin(phi) * Math.sin(theta) * 0.062;

              return (
                <group key={`floret-${floretIdx}`} position={[fx, fy, fz]} rotation={[phi, theta, 0]}>
                  {/* Each floret has 4 heart-shaped petals in a cross */}
                  {Array.from({ length: 4 }).map((_, pIdx) => {
                    const rotZ = (pIdx * Math.PI) / 2;
                    return (
                      <group key={`petal-${pIdx}`} rotation={[0, 0, rotZ]}>
                        <mesh geometry={geometries.petal} material={materials.petal} position={[0, 0.01, 0]} />
                      </group>
                    );
                  })}
                  {/* Central dot */}
                  <mesh position={[0, 0, 0.002]}>
                    <sphereGeometry args={[0.003]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={opacity} />
                  </mesh>
                </group>
              );
            })}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <group ref={rootRef} scale={[scale, scale, scale]}>
      {/* 1. Stem */}
      {bloomProgress > 0.02 && (
        <mesh ref={stemRef} geometry={geometries.stem} material={materials.stem} />
      )}

      {/* 2. Leaves */}
      {bloomProgress > 0.1 && (
        <group ref={leavesRef}>
          <mesh geometry={geometries.leaf} material={materials.leaf} rotation={[0.4, Math.PI / 4, 0]} />
          <mesh geometry={geometries.leaf} material={materials.leaf} rotation={[0.4, -Math.PI / 4, 0]} />
        </group>
      )}

      {/* 3. Flower Head */}
      <group ref={headRef}>
        {renderFlowerHead()}
        {/* Glowing holographic point light inside the bloom */}
        {bloomProgress > 0.4 && (
          <pointLight
            color={colors.primary}
            intensity={1.2 * bloomProgress}
            distance={0.6}
            decay={2.0}
          />
        )}
      </group>
    </group>
  );
};

export default ProceduralFlower;
