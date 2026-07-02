import React, { useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics, RigidBody, CuboidCollider, BallCollider } from '@react-three/rapier';
import { Line } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { useSmoothedHandData } from '../hooks/useSmoothedHandData';
import { HandSculpture } from './HandSculpture';
import { HolographicFlower, generateCrystalSpecies } from '../flowers/HolographicFlower';
import { ButterflyMesh } from './ButterflyMesh';
import { GPUParticleSystem } from '../particles/GPUParticleSystem';
import { useParticles } from '../particles/ParticleContext';
import type { HandData, FlowerSpecies } from '../types';

interface ThreeARSceneProps {
  video: HTMLVideoElement | null;
  detectHands: (video: HTMLVideoElement, timestamp: number) => HandLandmarkerResult | null;
  isModelLoaded: boolean;
}

// Static configuration for premium visual art installation
const CONFIG = {
  colorTheme: 'Sakura (Pink)' as 'Sakura (Pink)' | 'Gold Sparkles' | 'Emerald Forest' | 'Celestial Blue',
  glowIntensity: 1.25,
  bloomSize: 0.64,
  particleSpeed: 0.8,
  pinchThreshold: 0.08,
  mirrorX: true, // Mirrors horizontally to match CSS-mirrored webcam
  showDebugHelpers: false
};

interface SculptureState {
  hand: HandData;
  opacity: number;
  trackingActive: boolean;
  lastSeen: number;
}

// Scene Content Coordinator (must sit inside GPUParticleSystem context)
const SceneContent: React.FC<ThreeARSceneProps> = ({ video, detectHands, isModelLoaded }) => {
  const { processHands } = useSmoothedHandData();
  const { spawn, spawnBurst } = useParticles();

  // Visual Continuity Hand Sculptures state (Rule 2: Never lose visual continuity)
  const [sculptures, setSculptures] = useState<{ id: string; hand: HandData; opacity: number }[]>([]);
  const activeSculpturesRef = useRef<Map<string, SculptureState>>(new Map());

  // Active orbs
  const [activeOrbs, setActiveOrbs] = useState<{ id: string; position: THREE.Vector3; color: THREE.Color }[]>([]);

  // Kinematic joint colliders for hand velocity transfer
  const fingerRbRefs = useRef<(any | null)[]>([]);

  // Dynamic Depth of Field focus plane target & Sunlight sways
  const dofTarget = useRef(new THREE.Vector3(0, 0, 0));
  const sunlightRef = useRef<THREE.DirectionalLight | null>(null);

  // Victory orbiting flowers relative offset tracking
  const victoryOrbitAngle = useRef(0);

  // Landed butterfly tracking target
  const butterflyTargetPos = useRef(new THREE.Vector3(0, 5, 0));
  const [isButterflyActive, setIsButterflyActive] = useState(false);

  // Bouquet species definitions
  const bouquetSpeciesList = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => generateCrystalSpecies(`Bouquet-${idx}`));
  }, []);

  // Theme configuration values
  const themeColors = useMemo(() => {
    switch (CONFIG.colorTheme) {
      case 'Gold Sparkles':
        return {
          primary: new THREE.Color('#ffd700'),
          secondary: new THREE.Color('#ff7700'),
          sparkle: new THREE.Color('#ffffff'),
          hexStr: '#ffd700'
        };
      case 'Emerald Forest':
        return {
          primary: new THREE.Color('#10b981'),
          secondary: new THREE.Color('#059669'),
          sparkle: new THREE.Color('#d1fae5'),
          hexStr: '#10b981'
        };
      case 'Celestial Blue':
        return {
          primary: new THREE.Color('#3b82f6'),
          secondary: new THREE.Color('#8b5cf6'),
          sparkle: new THREE.Color('#eff6ff'),
          hexStr: '#3b82f6'
        };
      case 'Sakura (Pink)':
      default:
        return {
          primary: new THREE.Color('#ff69b4'),
          secondary: new THREE.Color('#da1b75'),
          sparkle: new THREE.Color('#ffffff'),
          hexStr: '#ff69b4'
        };
    }
  }, []);

  // Frame Render Loop
  useFrame((state, delta) => {
    const dt = Math.min(0.03, delta);
    const time = state.clock.getElapsedTime();
    let currentHands: HandData[] = [];

    // 1. Process Hand Landmarker & Gesture Engine
    if (video && isModelLoaded && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      const rawResults = detectHands(video, performance.now());
      currentHands = processHands(rawResults, video, CONFIG.mirrorX);
    }

    // Shifting sunlight coordinates for cinematic breeze patterns
    if (sunlightRef.current) {
      sunlightRef.current.position.x = 2 + Math.sin(time * 0.4) * 0.5;
      sunlightRef.current.position.y = 4 + Math.cos(time * 0.4) * 0.3;
    }

    // Dynamic autofocus target: lens follows the average hand depth Z coordinate
    const targetZ = currentHands.length > 0 ? currentHands[0].wrist.z : 0.0;
    dofTarget.current.lerp(new THREE.Vector3(0, 0, targetZ), dt * 4.5);

    // Hide kinematic fingertip colliders by default
    fingerRbRefs.current.forEach(fingerRb => {
      if (fingerRb) {
        fingerRb.setNextKinematicTranslation({ x: 0, y: 0, z: -999 });
      }
    });

    // Update active hand sculpture list with tracking loss fading (Rule 2)
    const nextSculpturesMap = new Map(activeSculpturesRef.current);
    
    // Set all existing models to inactive first
    nextSculpturesMap.forEach(sculpt => {
      sculpt.trackingActive = false;
    });

    // Add / Update currently tracked hands
    currentHands.forEach(hand => {
      const handId = hand.isLeft ? 'left' : 'right';
      const prev = nextSculpturesMap.get(handId);

      const deepCopyHand: HandData = {
        ...hand,
        smoothedLandmarks: hand.smoothedLandmarks.map(v => v.clone()),
        wrist: hand.wrist.clone(),
        thumbFingertip: hand.thumbFingertip.clone(),
        indexFingertip: hand.indexFingertip.clone(),
        pinchMidpoint: hand.pinchMidpoint.clone(),
        fingerCurls: { ...hand.fingerCurls }
      };

      nextSculpturesMap.set(handId, {
        hand: deepCopyHand,
        opacity: Math.min(1.0, (prev?.opacity ?? 0.0) + dt / 0.25), // fast fade-in (250ms)
        trackingActive: true,
        lastSeen: time
      });
    });

    // Fade out and delete untracked hands
    nextSculpturesMap.forEach((sculpt, handId) => {
      if (!sculpt.trackingActive) {
        sculpt.opacity = Math.max(0.0, sculpt.opacity - dt / 0.85); // slow fade-out (850ms)
        if (sculpt.opacity <= 0.0) {
          nextSculpturesMap.delete(handId);
        }
      }
    });
    activeSculpturesRef.current = nextSculpturesMap;

    // Convert Map back to state array for visual rendering
    const list: { id: string; hand: HandData; opacity: number }[] = [];
    nextSculpturesMap.forEach((sculpt, handId) => {
      list.push({ id: handId, hand: sculpt.hand, opacity: sculpt.opacity });
    });
    setSculptures(list);

    // 2. Gesture Interactions & Particle Emissions
    const activePinchIds: string[] = [];
    const updatedOrbs: { id: string; position: THREE.Vector3; color: THREE.Color }[] = [];
    let pointTipPos: THREE.Vector3 | null = null;

    list.forEach((sculpt, hIdx) => {
      const hand = sculpt.hand;
      const handId = sculpt.id;
      const indexTipPos = hand.smoothedLandmarks[8];

      // Move kinematic physics colliders
      if (indexTipPos && sculpt.opacity > 0.5) {
        const fingerRb = fingerRbRefs.current[hIdx];
        if (fingerRb) {
          fingerRb.setNextKinematicTranslation(indexTipPos);
        }
      }

      // PINCH -> Spawn / Drag Orb
      if (hand.gesture === 'pinch' && sculpt.opacity > 0.5) {
        activePinchIds.push(handId);
        updatedOrbs.push({
          id: handId,
          position: hand.pinchMidpoint.clone(),
          color: themeColors.primary
        });

        // Spawn dragging trail sparkles
        if (Math.random() < 0.4) {
          const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.15,
            -0.1 - Math.random() * 0.15,
            (Math.random() - 0.5) * 0.15
          );
          spawn({
            position: hand.pinchMidpoint,
            velocity,
            color: themeColors.primary,
            size: 8 + Math.random() * 8,
            lifetime: 0.6 + Math.random() * 0.4,
            type: 'trail'
          });
        }
      }

      // POINT -> Butterfly landing target
      if (hand.gesture === 'point' && indexTipPos && sculpt.opacity > 0.5) {
        pointTipPos = indexTipPos;
        if (Math.random() < 0.2) {
          const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.15,
            0.1 + Math.random() * 0.1,
            (Math.random() - 0.5) * 0.15
          );
          spawn({
            position: indexTipPos,
            velocity,
            color: themeColors.secondary,
            size: 10 + Math.random() * 8,
            lifetime: 0.8 + Math.random() * 0.4,
            type: 'dust'
          });
        }
      }

      // THUMBS UP -> Rising hearts
      if (hand.gesture === 'thumbs_up' && sculpt.opacity > 0.5 && Math.random() < 0.12) {
        const thumbTip = hand.smoothedLandmarks[4];
        if (thumbTip) {
          spawn({
            position: thumbTip.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.04, 0.06, 0)),
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.04, 0.28, (Math.random() - 0.5) * 0.04),
            color: new THREE.Color('#ff4d6d'),
            size: 14 + Math.random() * 6,
            lifetime: 1.5 + Math.random() * 0.5,
            type: 'heart'
          });
        }
      }
    });

    // Handle butterfly target locks
    if (pointTipPos) {
      butterflyTargetPos.current.copy(pointTipPos).add(new THREE.Vector3(0.04, 0.02, 0.02));
      setIsButterflyActive(true);
    } else {
      setIsButterflyActive(false);
    }

    // Detect pinch releases -> soft particle bursts
    activeOrbs.forEach(orb => {
      if (!activePinchIds.includes(orb.id)) {
        spawnBurst(orb.position, 25, 'petal', new THREE.Color(themeColors.primary));
        spawnBurst(orb.position, 15, 'heart', new THREE.Color('#ff4d6d'));
        spawnBurst(orb.position, 20, 'dust', new THREE.Color(themeColors.secondary));
        spawnBurst(orb.position, 10, 'bubble', new THREE.Color('#ffffff'));
      }
    });
    setActiveOrbs(updatedOrbs);

    // Increment orbit sways
    victoryOrbitAngle.current += dt * 3.2;

    // Ambient floating background spores
    if (Math.random() < 0.04) {
      const sporePos = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        -3.0,
        (Math.random() - 0.5) * 0.8
      );
      const sporeVel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.08,
        0.3 + Math.random() * 0.15,
        (Math.random() - 0.5) * 0.08
      );
      spawn({
        position: sporePos,
        velocity: sporeVel,
        color: themeColors.secondary,
        size: 5 + Math.random() * 5,
        lifetime: 2.5 + Math.random() * 1.5,
        type: 'spore'
      });
    }
  });

  // Calculate Two-Hand Split Bouquet systems (based on visual continuity hand list)
  const dualHandBouquet = useMemo(() => {
    if (sculptures.length < 2) return null;
    const h1 = sculptures[0].hand;
    const h2 = sculptures[1].hand;

    // Unified average opacity of the two hands
    const avgOpacity = (sculptures[0].opacity + sculptures[1].opacity) / 2;

    // Collision Avoidance Distance offsets (Rule 3)
    const dist = h1.wrist.distanceTo(h2.wrist);

    // 1. Hands Together -> Shared central bouquet
    if (dist < 0.45) {
      const midpoint = new THREE.Vector3().addVectors(h1.wrist, h2.wrist).multiplyScalar(0.5);
      midpoint.y += 0.12;
      return {
        type: 'together' as const,
        position: midpoint,
        sizeScale: 1.6 * avgOpacity,
        opacity: avgOpacity
      };
    }

    // 2. Hands Apart -> Splits into matching bouquets linked by a light ribbon
    const p1 = h1.wrist.clone().add(new THREE.Vector3(0, 0.1, 0));
    const p2 = h2.wrist.clone().add(new THREE.Vector3(0, 0.1, 0));

    const ctrl = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    ctrl.y -= dist * 0.15;

    const curve = new THREE.QuadraticBezierCurve3(p1, ctrl, p2);
    const ribbonPoints = curve.getPoints(24);

    return {
      type: 'apart' as const,
      p1,
      p2,
      ribbonPoints,
      sizeScale: 0.95 * avgOpacity,
      opacity: avgOpacity
    };
  }, [sculptures]);

  // Orbiting flowers for Victory gesture (includes visual opacity checks)
  const victoryOrbiters = useMemo(() => {
    const orbiters: { position: THREE.Vector3; species: FlowerSpecies; opacity: number }[] = [];
    sculptures.forEach((sculpt, hIdx) => {
      const hand = sculpt.hand;
      if (hand.gesture === 'victory') {
        const indexTip = hand.smoothedLandmarks[8];
        const middleTip = hand.smoothedLandmarks[12];
        if (indexTip && middleTip) {
          const midpoint = new THREE.Vector3().addVectors(indexTip, middleTip).multiplyScalar(0.5);
          
          const angle1 = victoryOrbitAngle.current + hIdx * Math.PI;
          const angle2 = victoryOrbitAngle.current + Math.PI + hIdx * Math.PI;

          const radius = 0.08;
          const pos1 = midpoint.clone().add(new THREE.Vector3(Math.cos(angle1) * radius, Math.sin(angle1) * radius, 0));
          const pos2 = midpoint.clone().add(new THREE.Vector3(Math.cos(angle2) * radius, Math.sin(angle2) * radius, 0));

          orbiters.push(
            { position: pos1, species: bouquetSpeciesList[0], opacity: sculpt.opacity },
            { position: pos2, species: bouquetSpeciesList[1], opacity: sculpt.opacity }
          );
        }
      }
    });
    return orbiters;
  }, [sculptures, bouquetSpeciesList]);

  // Thumbs up pop-up bouquets
  const thumbsUpBouquets = useMemo(() => {
    const bouquets: { position: THREE.Vector3; speciesList: FlowerSpecies[]; opacity: number }[] = [];
    sculptures.forEach((sculpt) => {
      const hand = sculpt.hand;
      if (hand.gesture === 'thumbs_up') {
        const thumbTip = hand.smoothedLandmarks[4];
        if (thumbTip) {
          bouquets.push({
            position: thumbTip.clone().add(new THREE.Vector3(0, 0.08, 0)),
            speciesList: [bouquetSpeciesList[2], bouquetSpeciesList[3], bouquetSpeciesList[4]],
            opacity: sculpt.opacity
          });
        }
      }
    });
    return bouquets;
  }, [sculptures, bouquetSpeciesList]);

  const gravityY = -0.3; // slow float physics drift

  return (
    <>
      {/* Lights - Hemisphere light creates deep cool backing tones, warm sunlight sways */}
      <hemisphereLight color="#1e1b4b" groundColor="#09090b" intensity={2.0} />
      <directionalLight ref={sunlightRef} position={[2, 4, 3]} intensity={2.2} color="#fff8e7" />
      <pointLight position={[-3, -3, -2]} intensity={0.9} color="#bae6fd" />

      {/* Constellation Hand Sculptures (Visual Continuity Linked) */}
      {sculptures.map((sculpt) => (
        <HandSculpture
          key={sculpt.id}
          hand={sculpt.hand}
          color={themeColors.primary}
          opacity={sculpt.opacity}
        />
      ))}

      {/* Active Pinch kinematic energy orbs */}
      {activeOrbs.map((orb) => (
        <mesh key={orb.id} position={orb.position}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshBasicMaterial
            color={orb.color}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}

      {/* Procedurally Hovering Butterfly */}
      <ButterflyMesh
        targetPosition={butterflyTargetPos.current}
        active={isButterflyActive}
        colorTheme={CONFIG.colorTheme === 'Gold Sparkles' ? '#fed7aa' : '#ffa6c9'}
      />

      {/* Victory Gesture Orbiting Playful Flowers */}
      {victoryOrbiters.map((orb, idx) => (
        <group key={`victory-orbit-${idx}`} position={orb.position}>
          <HolographicFlower
            species={orb.species}
            scale={0.8 * orb.opacity}
            timeOffset={idx * 2.0}
          />
        </group>
      ))}

      {/* Thumbs Up Bouquet Pop-ups */}
      {thumbsUpBouquets.map((bq, idx) => (
        <group key={`thumbs-up-bq-${idx}`} position={bq.position}>
          <group position={[0, 0, 0]}>
            <HolographicFlower species={bq.speciesList[0]} scale={0.95 * bq.opacity} />
          </group>
          <group position={[-0.05, 0.02, -0.02]}>
            <HolographicFlower species={bq.speciesList[1]} scale={0.75 * bq.opacity} />
          </group>
          <group position={[0.05, 0.02, 0.02]}>
            <HolographicFlower species={bq.speciesList[2]} scale={0.75 * bq.opacity} />
          </group>
        </group>
      ))}

      {/* Dual Hand Floating Bouquet Interaction (Together vs Apart Split) */}
      {dualHandBouquet && (
        <group>
          {dualHandBouquet.type === 'together' && (
            <group position={dualHandBouquet.position}>
              <group position={[0, 0, 0]}>
                <HolographicFlower species={bouquetSpeciesList[0]} scale={dualHandBouquet.sizeScale} />
              </group>
              <group position={[-0.08, 0.04, -0.03]}>
                <HolographicFlower species={bouquetSpeciesList[1]} scale={dualHandBouquet.sizeScale * 0.75} />
              </group>
              <group position={[0.08, 0.04, 0.03]}>
                <HolographicFlower species={bouquetSpeciesList[2]} scale={dualHandBouquet.sizeScale * 0.75} />
              </group>
              <group position={[0.0, 0.08, 0.05]}>
                <HolographicFlower species={bouquetSpeciesList[3]} scale={dualHandBouquet.sizeScale * 0.65} />
              </group>
              <group position={[-0.05, -0.04, 0.04]}>
                <HolographicFlower species={bouquetSpeciesList[4]} scale={dualHandBouquet.sizeScale * 0.7} />
              </group>
              <group position={[0.05, -0.04, -0.04]}>
                <HolographicFlower species={bouquetSpeciesList[5]} scale={dualHandBouquet.sizeScale * 0.7} />
              </group>
            </group>
          )}

          {dualHandBouquet.type === 'apart' && (
            <group>
              {/* Left hand bouquet (3 flowers) */}
              <group position={dualHandBouquet.p1}>
                <group position={[0, 0, 0]}>
                  <HolographicFlower species={bouquetSpeciesList[0]} scale={dualHandBouquet.sizeScale} />
                </group>
                <group position={[-0.05, 0.02, -0.02]}>
                  <HolographicFlower species={bouquetSpeciesList[1]} scale={dualHandBouquet.sizeScale * 0.75} />
                </group>
                <group position={[0.05, 0.02, 0.02]}>
                  <HolographicFlower species={bouquetSpeciesList[2]} scale={dualHandBouquet.sizeScale * 0.75} />
                </group>
              </group>

              {/* Right hand bouquet (3 matching flowers) */}
              <group position={dualHandBouquet.p2}>
                <group position={[0, 0, 0]}>
                  <HolographicFlower species={bouquetSpeciesList[0]} scale={dualHandBouquet.sizeScale} />
                </group>
                <group position={[-0.05, 0.02, -0.02]}>
                  <HolographicFlower species={bouquetSpeciesList[1]} scale={dualHandBouquet.sizeScale * 0.75} />
                </group>
                <group position={[0.05, 0.02, 0.02]}>
                  <HolographicFlower species={bouquetSpeciesList[2]} scale={dualHandBouquet.sizeScale * 0.75} />
                </group>
              </group>

              {/* Light ribbon connecting both matching bouquets */}
              <Line
                points={dualHandBouquet.ribbonPoints}
                color="#fbcfe8"
                lineWidth={3}
                transparent
                opacity={0.65 * dualHandBouquet.opacity}
              />
            </group>
          )}
        </group>
      )}

      {/* Physics World Boundaries */}
      <Physics gravity={[0, gravityY, 0]}>
        <CuboidCollider position={[0, -3.2, 0]} args={[4, 0.1, 2]} restitution={0.7} />
        <CuboidCollider position={[0, 3.2, 0]} args={[4, 0.1, 2]} restitution={0.7} />
        <CuboidCollider position={[-2.4, 0, 0]} args={[0.1, 4, 2]} restitution={0.7} />
        <CuboidCollider position={[2.4, 0, 0]} args={[0.1, 4, 2]} restitution={0.7} />
        <CuboidCollider position={[0, 0, -1.2]} args={[4, 4, 0.1]} restitution={0.7} />
        <CuboidCollider position={[0, 0, 1.2]} args={[4, 4, 0.1]} restitution={0.7} />

        {/* Kinematic Hand Fingertip Colliders to swat particles */}
        <RigidBody ref={(el) => { fingerRbRefs.current[0] = el; }} type="kinematicPosition" colliders={false}>
          <BallCollider args={[0.14]} />
        </RigidBody>

        <RigidBody ref={(el) => { fingerRbRefs.current[1] = el; }} type="kinematicPosition" colliders={false}>
          <BallCollider args={[0.14]} />
        </RigidBody>
      </Physics>

      {/* Postprocessing VFX Composers - DepthOfField linked to dofTarget autofocus ref */}
      <EffectComposer>
        <Bloom
          intensity={0.95}
          luminanceThreshold={0.18}
          luminanceSmoothing={0.9}
          blendFunction={BlendFunction.ADD}
        />
        <DepthOfField
          target={dofTarget.current}
          focalLength={0.018}
          bokehScale={1.8}
        />
        <ChromaticAberration
          offset={new THREE.Vector2(0.001, 0.001)}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>
    </>
  );
};

// Canvas wrapper component
export const ThreeARScene: React.FC<ThreeARSceneProps> = (props) => {
  return (
    <div className="absolute inset-0 w-full h-full z-20 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ pointerEvents: 'none' }}
      >
        <GPUParticleSystem>
          <SceneContent {...props} />
        </GPUParticleSystem>
      </Canvas>
    </div>
  );
};

export default ThreeARScene;
