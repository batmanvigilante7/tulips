import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParticleContext } from './ParticleContext';
import type { ParticleSpawnParams, ParticleType } from './ParticleContext';

const MAX_PARTICLES = 3000;

export const GPUParticleSystem: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pointsRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);

  // Pre-allocated Particle Properties
  const state = useMemo(() => {
    return {
      positions: new Float32Array(MAX_PARTICLES * 3),
      velocities: new Float32Array(MAX_PARTICLES * 3),
      colors: new Float32Array(MAX_PARTICLES * 3),
      sizes: new Float32Array(MAX_PARTICLES),
      alphas: new Float32Array(MAX_PARTICLES),
      ages: new Float32Array(MAX_PARTICLES),
      lifetimes: new Float32Array(MAX_PARTICLES),
      types: new Float32Array(MAX_PARTICLES), // 0=pollen, 1=petal, 2=spore, 3=dust, 4=trail, 5=heart, 6=bubble
      active: new Uint8Array(MAX_PARTICLES),
      nextIndex: 0
    };
  }, []);

  // 1. Procedural Glow Texture
  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.85)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  // 2. Custom Shader Material (Renders hearts & bubbles directly on GPU)
  const particleMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        pointTexture: { value: glowTexture }
      },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute float typeIndex;
        attribute vec3 customColor;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vTypeIndex;
        void main() {
          vColor = customColor;
          vAlpha = alpha;
          vTypeIndex = typeIndex;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (5.5 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D pointTexture;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vTypeIndex;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float r = length(uv);

          if (vTypeIndex > 0.5 && vTypeIndex < 1.5) {
            // 1. PETAL SHAPE (Elongate on Y axis)
            float xDist = uv.x * 2.0;
            float yDist = uv.y * 1.0;
            if (sqrt(xDist * xDist + yDist * yDist) > 0.45) discard;
          }
          else if (vTypeIndex > 4.5 && vTypeIndex < 5.5) {
            // 5. HEART SHAPE (Cubic heart math curve)
            vec2 p = uv * 2.0;
            p.y += 0.22; // shift center down
            float heart = p.x * p.x + pow(p.y - sqrt(abs(p.x)), 2.0);
            if (heart > 0.18) discard;
          }
          else if (vTypeIndex > 5.5 && vTypeIndex < 6.5) {
            // 6. BUBBLE SHAPE (Hollow glowing glass ring)
            float bubbleRing = smoothstep(0.48, 0.42, r) * smoothstep(0.32, 0.44, r);
            if (r > 0.48 || bubbleRing < 0.05) discard;
          }
          else {
            // Standard soft glow point
            if (r > 0.5) discard;
          }

          vec4 tex = texture2D(pointTexture, gl_PointCoord);
          gl_FragColor = vec4(vColor * tex.rgb, vAlpha * tex.a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }, [glowTexture]);

  useEffect(() => {
    return () => {
      glowTexture.dispose();
      particleMaterial.dispose();
    };
  }, [glowTexture, particleMaterial]);

  const spawn = useCallback((params: ParticleSpawnParams) => {
    let index = state.nextIndex;
    let attempts = 0;
    
    while (state.active[index] && attempts < MAX_PARTICLES) {
      index = (index + 1) % MAX_PARTICLES;
      attempts++;
    }

    state.active[index] = 1;
    state.ages[index] = 0;
    state.lifetimes[index] = params.lifetime;
    state.sizes[index] = params.size;
    state.alphas[index] = 1.0;

    const i3 = index * 3;
    state.positions[i3] = params.position.x;
    state.positions[i3 + 1] = params.position.y;
    state.positions[i3 + 2] = params.position.z;

    state.velocities[i3] = params.velocity.x;
    state.velocities[i3 + 1] = params.velocity.y;
    state.velocities[i3 + 2] = params.velocity.z;

    state.colors[i3] = params.color.r;
    state.colors[i3 + 1] = params.color.g;
    state.colors[i3 + 2] = params.color.b;

    // Type Index mapping
    let typeIdx = 0;
    if (params.type === 'petal') typeIdx = 1;
    else if (params.type === 'spore') typeIdx = 2;
    else if (params.type === 'dust') typeIdx = 3;
    else if (params.type === 'trail') typeIdx = 4;
    else if (params.type === 'heart') typeIdx = 5;
    else if (params.type === 'bubble') typeIdx = 6;
    state.types[index] = typeIdx;

    state.nextIndex = (index + 1) % MAX_PARTICLES;
  }, [state]);

  const spawnBurst = useCallback((position: THREE.Vector3, count: number, type: ParticleType, color: THREE.Color) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 0.4 + Math.random() * 1.2;
      
      const velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(angle) * speed,
        Math.sin(phi) * Math.sin(angle) * speed,
        Math.cos(phi) * speed
      );
      
      const size = type === 'petal' ? 24 + Math.random() * 12
                 : type === 'bubble' ? 18 + Math.random() * 10
                 : type === 'heart' ? 16 + Math.random() * 8
                 : 8 + Math.random() * 8;

      const lifetime = type === 'spore' ? 2.2 + Math.random() * 1.4
                     : type === 'bubble' ? 2.5 + Math.random() * 1.5
                     : 0.6 + Math.random() * 0.7;

      spawn({
        position,
        velocity,
        color,
        size,
        lifetime,
        type
      });
    }
  }, [spawn]);

  const providerValue = useMemo(() => ({ spawn, spawnBurst }), [spawn, spawnBurst]);

  useFrame((stateObj, delta) => {
    const time = stateObj.clock.getElapsedTime();
    const dt = Math.min(0.03, delta);

    if (!pointsRef.current || !geometryRef.current) return;

    let activeCount = 0;
    const posAttr = geometryRef.current.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometryRef.current.getAttribute('customColor') as THREE.BufferAttribute;
    const sizeAttr = geometryRef.current.getAttribute('size') as THREE.BufferAttribute;
    const alphaAttr = geometryRef.current.getAttribute('alpha') as THREE.BufferAttribute;
    const typeAttr = geometryRef.current.getAttribute('typeIndex') as THREE.BufferAttribute;

    const pArr = posAttr.array as Float32Array;
    const vArr = state.velocities;
    const cArr = colAttr.array as Float32Array;
    const sArr = sizeAttr.array as Float32Array;
    const aArr = alphaAttr.array as Float32Array;
    const tArr = typeAttr.array as Float32Array;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (state.active[i]) {
        state.ages[i] += dt;
        const lifeRatio = state.ages[i] / state.lifetimes[i];

        if (lifeRatio >= 1.0) {
          state.active[i] = 0;
          continue;
        }

        const idx3 = i * 3;
        const type = state.types[i];

        // Decoupled physics drag and turbulence based on particle class
        let drag = 0.12;
        let turbulence = 0.08;

        if (type === 1) { // petal
          drag = 0.22;
          turbulence = 0.15;
          // Slowly flutter/fall downwards under gentle gravity
          vArr[idx3 + 1] -= 0.18 * dt;
        } 
        else if (type === 6) { // bubble
          drag = 0.05;
          turbulence = 0.25;
          // Buoyant upward drift
          vArr[idx3 + 1] += 0.35 * dt;
          // Side-to-side lazy sway
          vArr[idx3] += Math.sin(time * 3.0 + i) * 0.12 * dt;
        }
        else if (type === 5) { // heart
          drag = 0.1;
          turbulence = 0.12;
          // Soft upward drift
          vArr[idx3 + 1] += 0.22 * dt;
          vArr[idx3] += Math.sin(time * 2.0 + i) * 0.06 * dt;
        }
        else if (type === 4) { // trail
          drag = 0.45;
          turbulence = 0.04;
        }

        // Apply turbulence wave fields
        const waveX = Math.sin(pArr[idx3 + 1] * 3.5 + time * 1.8) * turbulence;
        const waveY = Math.cos(pArr[idx3] * 3.5 + time * 1.8) * turbulence;
        
        vArr[idx3] += waveX * dt;
        vArr[idx3 + 1] += waveY * dt;

        // Apply drag deceleration
        vArr[idx3] *= (1.0 - drag * dt);
        vArr[idx3 + 1] *= (1.0 - drag * dt);
        vArr[idx3 + 2] *= (1.0 - drag * dt);

        // Update coordinates
        pArr[idx3] += vArr[idx3] * dt;
        pArr[idx3 + 1] += vArr[idx3 + 1] * dt;
        pArr[idx3 + 2] += vArr[idx3 + 2] * dt;

        // 2. Opacity Curve (Soft sine curve peaks at 50% lifetime, no popping)
        let alpha = Math.sin(lifeRatio * Math.PI);
        state.alphas[i] = alpha;

        // Size curve: start small, peak, shrink to 0
        let sizeMultiplier = 1.0;
        if (lifeRatio < 0.15) {
          sizeMultiplier = lifeRatio / 0.15;
        } else {
          sizeMultiplier = 1.0 - (lifeRatio - 0.15) / 0.85;
        }

        // Write properties
        const outIdx3 = activeCount * 3;
        pArr[outIdx3] = pArr[idx3];
        pArr[outIdx3 + 1] = pArr[idx3 + 1];
        pArr[outIdx3 + 2] = pArr[idx3 + 2];

        cArr[outIdx3] = state.colors[idx3];
        cArr[outIdx3 + 1] = state.colors[idx3 + 1];
        cArr[outIdx3 + 2] = state.colors[idx3 + 2];

        sArr[activeCount] = state.sizes[i] * sizeMultiplier;
        aArr[activeCount] = state.alphas[i];
        tArr[activeCount] = type;

        activeCount++;
      }
    }

    geometryRef.current.setDrawRange(0, activeCount);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    typeAttr.needsUpdate = true;
  });

  return (
    <ParticleContext.Provider value={providerValue}>
      {children}
      
      <points ref={pointsRef}>
        <bufferGeometry ref={geometryRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(MAX_PARTICLES * 3), 3]}
          />
          <bufferAttribute
            attach="attributes-customColor"
            args={[new Float32Array(MAX_PARTICLES * 3), 3]}
          />
          <bufferAttribute
            attach="attributes-size"
            args={[new Float32Array(MAX_PARTICLES), 1]}
          />
          <bufferAttribute
            attach="attributes-alpha"
            args={[new Float32Array(MAX_PARTICLES), 1]}
          />
          <bufferAttribute
            attach="attributes-typeIndex"
            args={[new Float32Array(MAX_PARTICLES), 1]}
          />
        </bufferGeometry>
        <primitive object={particleMaterial} attach="material" />
      </points>
    </ParticleContext.Provider>
  );
};
export default GPUParticleSystem;
