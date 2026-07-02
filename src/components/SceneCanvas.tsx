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
import { ButterflyMesh } from './ButterflyMesh';
import { PetalTrail } from './PetalTrail';
import { GPUParticleSystem } from '../particles/GPUParticleSystem';
import { useParticles } from '../particles/ParticleContext';
import { useCreativeEngineStore } from '../store/creativeEngineStore';
import type { HandData } from '../types';
import { ProceduralFlower } from '../flowers/ProceduralFlower';
import { useSettingsStore } from '../store/settingsStore';

interface SceneCanvasProps {
  video: HTMLVideoElement | null;
  detectHands: (video: HTMLVideoElement, timestamp: number) => HandLandmarkerResult | null;
  isModelLoaded: boolean;
}

interface SculptureState {

  hand: HandData;
  opacity: number;
  trackingActive: boolean;
  lastSeen: number;
}

const SceneContent: React.FC<SceneCanvasProps> = ({ video, detectHands, isModelLoaded }) => {
  const { processHands } = useSmoothedHandData();
  const { spawn, spawnBurst } = useParticles();
  const setGestures = useCreativeEngineStore((state) => state.setGestures);

  const {
    mirrorCamera,
    showSkeleton,
    particleDensity,
    colorTheme,
    flowerSpecies,
  } = useSettingsStore();


  // 3D Procedural Roses State & Refs
  const [rosesList, setRosesList] = useState<{
    id: string;
    position: THREE.Vector3;
    scale: number;
    bloomProgress: number;
    visible: boolean;
    color: string;
    handVelocity: THREE.Vector3;
  }[]>([]);

  const roseStatesRef = useRef<Map<string, {
    id: string;
    position: THREE.Vector3;
    scale: number;
    bloomProgress: number;
    visible: boolean;
    color: string;
    handVelocity: THREE.Vector3;
    lastActive: number;
  }>>(new Map());

  const prevWristPositionsRef = useRef<Map<string, { pos: THREE.Vector3; time: number }>>(new Map());
  const handVelocitiesRef = useRef<Map<string, THREE.Vector3>>(new Map());

  // Visual Continuity Hand Sculptures (Rule 2)
  const [sculptures, setSculptures] = useState<{ id: string; hand: HandData; opacity: number }[]>([]);
  const activeSculpturesRef = useRef<Map<string, SculptureState>>(new Map());

  // Active pinch energy orbs
  const [activeOrbs, setActiveOrbs] = useState<{ id: string; position: THREE.Vector3; color: THREE.Color }[]>([]);
  const fingerRbRefs = useRef<(any | null)[]>([]);

  // Dynamic focus & light refs
  const dofTarget = useRef(new THREE.Vector3(0, 0, 0));
  const sunlightRef = useRef<THREE.DirectionalLight | null>(null);

  // Victory orbit & point butterfly states
  const victoryOrbitAngle = useRef(0);
  const butterflyTargetPos = useRef(new THREE.Vector3(0, 5, 0));
  const [isButterflyActive, setIsButterflyActive] = useState(false);

  // Throttled gesture callbacks
  const lastEmittedGestures = useRef<Record<string, string>>({ left: 'none', right: 'none' });


  const themeColors = useMemo(() => {
    switch (colorTheme) {
      case 'Cosmo (Blue/Teal)':
        return {
          primary: new THREE.Color('#00e5ff'),
          secondary: new THREE.Color('#2979ff'),
          sparkle: new THREE.Color('#ffffff'),
          hexStr: '#00e5ff'
        };
      case 'Solar (Gold)':
        return {
          primary: new THREE.Color('#ffa500'),
          secondary: new THREE.Color('#ffd700'),
          sparkle: new THREE.Color('#fff8e7'),
          hexStr: '#ffa500'
        };
      case 'Aurora (Green)':
        return {
          primary: new THREE.Color('#3d8c53'),
          secondary: new THREE.Color('#1aaa15'),
          sparkle: new THREE.Color('#f0fdf4'),
          hexStr: '#3d8c53'
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
  }, [colorTheme]);


  useFrame((state, delta) => {
    const dt = Math.min(0.03, delta);
    const time = state.clock.getElapsedTime();
    let currentHands: HandData[] = [];

    // 1. Hand tracking unprojection
    if (video && isModelLoaded && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      const rawResults = detectHands(video, performance.now());
      currentHands = processHands(rawResults, video, mirrorCamera);
    }


    // Sunlight sways
    if (sunlightRef.current) {
      sunlightRef.current.position.x = 2 + Math.sin(time * 0.4) * 0.5;
      sunlightRef.current.position.y = 4 + Math.cos(time * 0.4) * 0.3;
    }

    // Dynamic autofocus lens tracking
    const targetZ = currentHands.length > 0 ? currentHands[0].wrist.z : 0.0;
    dofTarget.current.lerp(new THREE.Vector3(0, 0, targetZ), dt * 4.5);

    // Hide physics colliders by default
    fingerRbRefs.current.forEach(fingerRb => {
      if (fingerRb) {
        fingerRb.setNextKinematicTranslation({ x: 0, y: 0, z: -999 });
      }
    });

    // Visual Continuity fading buffer (Rule 2)
    const nextSculpturesMap = new Map(activeSculpturesRef.current);
    nextSculpturesMap.forEach(sculpt => {
      sculpt.trackingActive = false;
    });

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
        opacity: Math.min(1.0, (prev?.opacity ?? 0.0) + dt / 0.25),
        trackingActive: true,
        lastSeen: time
      });
    });

    nextSculpturesMap.forEach((sculpt, handId) => {
      if (!sculpt.trackingActive) {
        sculpt.opacity = Math.max(0.0, sculpt.opacity - dt / 0.85);
        if (sculpt.opacity <= 0.0) {
          nextSculpturesMap.delete(handId);
        }
      }
    });
    activeSculpturesRef.current = nextSculpturesMap;

    const list: { id: string; hand: HandData; opacity: number }[] = [];
    nextSculpturesMap.forEach((sculpt, handId) => {
      list.push({ id: handId, hand: sculpt.hand, opacity: sculpt.opacity });
    });
    setSculptures(list);

    // Compute hand velocities for physical sways
    list.forEach((sculpt) => {
      const hand = sculpt.hand;
      const handId = sculpt.id;
      const wristPos = hand.wrist;
      const prev = prevWristPositionsRef.current.get(handId);
      const vel = new THREE.Vector3(0, 0, 0);
      if (prev) {
        const dt = time - prev.time;
        if (dt > 0) {
          vel.subVectors(wristPos, prev.pos).divideScalar(dt);
          vel.clampLength(0, 2.0); // clamp velocity
        }
      }
      prevWristPositionsRef.current.set(handId, { pos: wristPos.clone(), time });
      handVelocitiesRef.current.set(handId, vel);
    });

    // 3D Procedural Rose tracking and lifecycle management
    const activeRoseIds = new Set<string>();
    list.forEach((sculpt) => {
      const hand = sculpt.hand;
      const handId = sculpt.id;
      const opacity = sculpt.opacity;

      if (opacity < 0.2) return;

      const handVelocity = handVelocitiesRef.current.get(handId) || new THREE.Vector3(0, 0, 0);

      // Pinch -> 1 larger rose between thumb and index
      if (hand.gesture === 'pinch') {
        const id = `${handId}-pinch`;
        const pos = hand.pinchMidpoint;
        if (pos) {
          const existing = roseStatesRef.current.get(id);
          roseStatesRef.current.set(id, {
            id,
            position: pos.clone(),
            scale: 0.16 * opacity,
            bloomProgress: Math.min(1.0, (existing?.bloomProgress ?? 0.0) + dt * 2.5),
            visible: true,
            color: '#ff1493',
            handVelocity: handVelocity.clone(),
            lastActive: time,
          });
          activeRoseIds.add(id);
        }
      }

      // Open Palm -> 5 smaller roses at fingertips
      if (hand.gesture === 'open') {
        const tips = [4, 8, 12, 16, 20];
        tips.forEach((tip) => {
          const id = `${handId}-fingertip-${tip}`;
          const pos = hand.smoothedLandmarks[tip];
          if (pos) {
            const existing = roseStatesRef.current.get(id);
            let colorStr = '#ff69b4';
            if (tip === 4) colorStr = '#ff3da0';
            else if (tip === 8) colorStr = '#e040fb';
            else if (tip === 12) colorStr = '#ff1744';
            else if (tip === 16) colorStr = '#ff9100';
            else if (tip === 20) colorStr = '#00e5ff';

            roseStatesRef.current.set(id, {
              id,
              position: pos.clone(),
              scale: 0.075 * opacity,
              bloomProgress: Math.min(1.0, (existing?.bloomProgress ?? 0.0) + dt * 3.0),
              visible: true,
              color: colorStr,
              handVelocity: handVelocity.clone(),
              lastActive: time,
            });
            activeRoseIds.add(id);
          }
        });
      }
    });

    // Animate and clean up fading roses
    roseStatesRef.current.forEach((rose, key) => {
      if (!activeRoseIds.has(key)) {
        rose.bloomProgress = Math.max(0.0, rose.bloomProgress - dt * 2.0);
        rose.scale = Math.max(0.0, rose.scale - dt * 0.4);
        rose.handVelocity.multiplyScalar(0.9);

        if (rose.scale <= 0.005 || rose.bloomProgress <= 0.005) {
          roseStatesRef.current.delete(key);
        }
      }
    });

    // Update state to trigger render
    if (roseStatesRef.current.size > 0 || rosesList.length > 0) {
      setRosesList(Array.from(roseStatesRef.current.values()));
    }

    // Throttled UI state updates to maintain 60FPS
    const nextGestures: Record<string, string> = { left: 'none', right: 'none' };
    list.forEach(sculpt => {
      nextGestures[sculpt.id] = sculpt.hand.gesture;
    });

    if (
      nextGestures.left !== lastEmittedGestures.current.left ||
      nextGestures.right !== lastEmittedGestures.current.right
    ) {
      lastEmittedGestures.current = nextGestures;
      // Run safely outside R3F draw call.
      setTimeout(() => setGestures(nextGestures), 0);
    }




    // 2. Spawn Gestures Spores
    const activePinchIds: string[] = [];
    const updatedOrbs: { id: string; position: THREE.Vector3; color: THREE.Color }[] = [];
    let pointTipPos: THREE.Vector3 | null = null;

    list.forEach((sculpt, hIdx) => {
      const hand = sculpt.hand;
      const handId = sculpt.id;
      const indexTipPos = hand.smoothedLandmarks[8];

      if (indexTipPos && sculpt.opacity > 0.5) {
        const fingerRb = fingerRbRefs.current[hIdx];
        if (fingerRb) {
          fingerRb.setNextKinematicTranslation(indexTipPos);
        }
      }

      // PINCH -> Drag Orb
      if (hand.gesture === 'pinch' && sculpt.opacity > 0.5) {
        activePinchIds.push(handId);
        updatedOrbs.push({
          id: handId,
          position: hand.pinchMidpoint.clone(),
          color: themeColors.primary
        });

        if (Math.random() < 0.3 * particleDensity) {
          spawn({
            position: hand.pinchMidpoint,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.15, -0.1 - Math.random() * 0.15, (Math.random() - 0.5) * 0.15),
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
      }

      // THUMBS UP -> Hearts
      if (hand.gesture === 'thumbs_up' && sculpt.opacity > 0.5 && Math.random() < 0.12 * particleDensity) {
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

    // Butterfly landing calculations
    if (pointTipPos) {
      butterflyTargetPos.current.copy(pointTipPos).add(new THREE.Vector3(0.04, 0.02, 0.02));
      setIsButterflyActive(true);
    } else {
      setIsButterflyActive(false);
    }

    // Pinch Releases -> soft particle explosions (Rule 4: satisfy ending)
    activeOrbs.forEach(orb => {
      if (!activePinchIds.includes(orb.id)) {
        spawnBurst(orb.position, Math.round(25 * particleDensity), 'petal', new THREE.Color(themeColors.primary));
        spawnBurst(orb.position, Math.round(15 * particleDensity), 'heart', new THREE.Color('#ff4d6d'));
        spawnBurst(orb.position, Math.round(20 * particleDensity), 'dust', new THREE.Color(themeColors.secondary));
        spawnBurst(orb.position, Math.round(10 * particleDensity), 'bubble', new THREE.Color('#ffffff'));
      }
    });
    setActiveOrbs(updatedOrbs);

    victoryOrbitAngle.current += dt * 3.2;

    // Ambient floating backdrop spores
    if (Math.random() < 0.04 * particleDensity) {
      const sporePos = new THREE.Vector3((Math.random() - 0.5) * 3, -3.0, (Math.random() - 0.5) * 0.8);
      const sporeVel = new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.3 + Math.random() * 0.15, (Math.random() - 0.5) * 0.08);
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

  // Dual Hand splits
  const dualHandBouquet = useMemo(() => {
    if (sculptures.length < 2) return null;
    const h1 = sculptures[0].hand;
    const h2 = sculptures[1].hand;
    const avgOpacity = (sculptures[0].opacity + sculptures[1].opacity) / 2;
    const dist = h1.wrist.distanceTo(h2.wrist);

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

  // Victory orbiters
  const victoryOrbiters = useMemo(() => {
    const orbiters: { position: THREE.Vector3; species: 'rose' | 'tulip' | 'daisy' | 'cherryblossom' | 'lavender' | 'hydrangea'; opacity: number }[] = [];
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
            { position: pos1, species: 'cherryblossom', opacity: sculpt.opacity },
            { position: pos2, species: 'tulip', opacity: sculpt.opacity }
          );
        }
      }
    });
    return orbiters;
  }, [sculptures]);


  // Thumbs up popups
  const thumbsUpBouquets = useMemo(() => {
    const bouquets: { position: THREE.Vector3; speciesList: ('rose' | 'tulip' | 'daisy' | 'cherryblossom' | 'lavender' | 'hydrangea')[]; opacity: number }[] = [];
    sculptures.forEach((sculpt) => {
      const hand = sculpt.hand;
      if (hand.gesture === 'thumbs_up') {
        const thumbTip = hand.smoothedLandmarks[4];
        if (thumbTip) {
          bouquets.push({
            position: thumbTip.clone().add(new THREE.Vector3(0, 0.08, 0)),
            speciesList: ['rose', 'tulip', 'hydrangea'],
            opacity: sculpt.opacity
          });
        }
      }
    });
    return bouquets;
  }, [sculptures]);


  // Wave gesture trail coordinates
  const waveTrailData = useMemo(() => {
    const leftModel = sculptures.find(s => s.id === 'left');
    if (leftModel && leftModel.hand.gesture === 'open') {
      return { position: leftModel.hand.smoothedLandmarks[8], opacity: leftModel.opacity };
    }
    const rightModel = sculptures.find(s => s.id === 'right');
    if (rightModel && rightModel.hand.gesture === 'open') {
      return { position: rightModel.hand.smoothedLandmarks[8], opacity: rightModel.opacity };
    }
    return null;
  }, [sculptures]);

  const gravityY = -0.3;

  return (
    <>
      <hemisphereLight color="#1e1b4b" groundColor="#09090b" intensity={2.0} />
      <directionalLight ref={sunlightRef} position={[2, 4, 3]} intensity={2.2} color="#fff8e7" />
      <pointLight position={[-3, -3, -2]} intensity={0.9} color="#bae6fd" />

      {/* Constellation Hands */}
      {showSkeleton && sculptures.map((sculpt) => (
        <HandSculpture
          key={sculpt.id}
          hand={sculpt.hand}
          color={themeColors.primary}
          opacity={sculpt.opacity}
        />
      ))}


      {/* 3D Procedural Flowers */}
      {rosesList.map((flower) => (
        <ProceduralFlower
          key={flower.id}
          position={flower.position}
          scale={flower.scale}
          bloomProgress={flower.bloomProgress}
          color={flower.color}
          species={flowerSpecies}
          handVelocity={flower.handVelocity}
        />
      ))}


      {/* Petal Ribbon Trail (Paint in air wave ribbon) */}
      <PetalTrail
        indexTipPosition={waveTrailData?.position ?? null}
        active={!!waveTrailData}
        opacity={waveTrailData?.opacity ?? 0}
      />

      {/* Kinematic Orbs */}
      {activeOrbs.map((orb) => (
        <mesh key={orb.id} position={orb.position}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshBasicMaterial color={orb.color} transparent opacity={0.85} />
        </mesh>
      ))}

      {/* Butterfly */}
      <ButterflyMesh
        targetPosition={butterflyTargetPos.current}
        active={isButterflyActive}
        colorTheme="#ffa6c9"
      />

      {/* Victory Orbiters */}
      {victoryOrbiters.map((orb, idx) => (
        <group key={`victory-orbit-${idx}`}>
          <ProceduralFlower
            species={orb.species}
            scale={0.065 * orb.opacity}
            bloomProgress={orb.opacity}
            color={themeColors.primary.getStyle()}
            position={orb.position}
          />
        </group>
      ))}

      {/* Thumbs Up Bouquets */}
      {thumbsUpBouquets.map((bq, idx) => (
        <group key={`thumbs-up-bq-${idx}`} position={bq.position}>
          <group position={[0, 0, 0]}>
            <ProceduralFlower species={bq.speciesList[0]} scale={0.075 * bq.opacity} bloomProgress={bq.opacity} color="#ff1493" />
          </group>
          <group position={[-0.04, 0.015, -0.015]}>
            <ProceduralFlower species={bq.speciesList[1]} scale={0.055 * bq.opacity} bloomProgress={bq.opacity} color="#da70d6" />
          </group>
          <group position={[0.04, 0.015, 0.015]}>
            <ProceduralFlower species={bq.speciesList[2]} scale={0.055 * bq.opacity} bloomProgress={bq.opacity} color="#40e0d0" />
          </group>
        </group>
      ))}

      {/* Dual Hand Floating Bouquet Interaction */}
      {dualHandBouquet && (
        <group>
          {dualHandBouquet.type === 'together' && (
            <group position={dualHandBouquet.position}>
              <group position={[0, 0, 0]}>
                <ProceduralFlower species="rose" scale={0.12 * dualHandBouquet.opacity} bloomProgress={dualHandBouquet.opacity} color="#ff1493" />
              </group>
              <group position={[-0.07, 0.03, -0.025]}>
                <ProceduralFlower species="tulip" scale={0.09 * dualHandBouquet.opacity} bloomProgress={dualHandBouquet.opacity} color="#ffd700" />
              </group>
              <group position={[0.07, 0.03, 0.025]}>
                <ProceduralFlower species="daisy" scale={0.09 * dualHandBouquet.opacity} bloomProgress={dualHandBouquet.opacity} color="#ffffff" />
              </group>
              <group position={[0.0, 0.06, 0.04]}>
                <ProceduralFlower species="cherryblossom" scale={0.08 * dualHandBouquet.opacity} bloomProgress={dualHandBouquet.opacity} color="#ffb7c5" />
              </group>
              <group position={[-0.04, -0.03, 0.03]}>
                <ProceduralFlower species="lavender" scale={0.085 * dualHandBouquet.opacity} bloomProgress={dualHandBouquet.opacity} color="#e040fb" />
              </group>
              <group position={[0.05, -0.03, -0.03]}>
                <ProceduralFlower species="hydrangea" scale={0.085 * dualHandBouquet.opacity} bloomProgress={dualHandBouquet.opacity} color="#00e5ff" />
              </group>
            </group>
          )}

          {dualHandBouquet.type === 'apart' && (
            <group>
              <group position={dualHandBouquet.p1}>
                <group position={[0, 0, 0]}>
                  <ProceduralFlower species="rose" scale={0.075 * dualHandBouquet.opacity} bloomProgress={dualHandBouquet.opacity} color="#ff1493" />
                </group>
                <group position={[-0.04, 0.015, -0.015]}>
                  <ProceduralFlower species="tulip" scale={0.055 * dualHandBouquet.opacity} bloomProgress={dualHandBouquet.opacity} color="#ffd700" />
                </group>
                <group position={[0.04, 0.015, 0.015]}>
                  <ProceduralFlower species="daisy" scale={0.055 * dualHandBouquet.opacity} bloomProgress={dualHandBouquet.opacity} color="#ffffff" />
                </group>
              </group>

              <group position={dualHandBouquet.p2}>
                <group position={[0, 0, 0]}>
                  <ProceduralFlower species="cherryblossom" scale={0.075 * dualHandBouquet.opacity} bloomProgress={dualHandBouquet.opacity} color="#ffb7c5" />
                </group>
                <group position={[-0.04, 0.015, -0.015]}>
                  <ProceduralFlower species="lavender" scale={0.055 * dualHandBouquet.opacity} bloomProgress={dualHandBouquet.opacity} color="#e040fb" />
                </group>
                <group position={[0.04, 0.015, 0.015]}>
                  <ProceduralFlower species="hydrangea" scale={0.055 * dualHandBouquet.opacity} bloomProgress={dualHandBouquet.opacity} color="#00e5ff" />
                </group>
              </group>


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

        <RigidBody ref={(el) => { fingerRbRefs.current[0] = el; }} type="kinematicPosition" colliders={false}>
          <BallCollider args={[0.14]} />
        </RigidBody>
        <RigidBody ref={(el) => { fingerRbRefs.current[1] = el; }} type="kinematicPosition" colliders={false}>
          <BallCollider args={[0.14]} />
        </RigidBody>
      </Physics>

      <EffectComposer>
        <Bloom intensity={0.95} luminanceThreshold={0.18} luminanceSmoothing={0.9} blendFunction={BlendFunction.ADD} />
        <DepthOfField target={dofTarget.current} focalLength={0.018} bokehScale={1.8} />
        <ChromaticAberration offset={new THREE.Vector2(0.001, 0.001)} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>
    </>
  );
};

export const SceneCanvas: React.FC<SceneCanvasProps> = (props) => {
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

export default SceneCanvas;
