import { createContext, useContext } from 'react';
import * as THREE from 'three';

export type ParticleType = 'pollen' | 'petal' | 'spore' | 'dust' | 'trail' | 'heart' | 'bubble';

export interface ParticleSpawnParams {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  lifetime: number;
  type: ParticleType;
}

interface ParticleContextType {
  spawn: (params: ParticleSpawnParams) => void;
  spawnBurst: (position: THREE.Vector3, count: number, type: ParticleType, color: THREE.Color) => void;
}

export const ParticleContext = createContext<ParticleContextType | null>(null);

export function useParticles() {
  const ctx = useContext(ParticleContext);
  if (!ctx) {
    throw new Error("useParticles must be used within a ParticleProvider");
  }
  return ctx;
}
