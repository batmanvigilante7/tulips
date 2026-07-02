import * as THREE from 'three';

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type GestureType = 'open' | 'fist' | 'pinch' | 'victory' | 'point' | 'together' | 'apart' | 'thumbs_up' | 'none';

export interface HandData {
  landmarks: Landmark[];
  smoothedLandmarks: THREE.Vector3[];
  isLeft: boolean;
  gesture: GestureType;
  gestureConfidence: number;
  pinchStrength: number;
  pinchMidpoint: THREE.Vector3;
  indexFingertip: THREE.Vector3;
  thumbFingertip: THREE.Vector3;
  wrist: THREE.Vector3;
  fingerCurls: {
    thumb: number;
    index: number;
    middle: number;
    ring: number;
    pinky: number;
  };
}

export interface FloatingPetal {
  id: number;
  position: [number, number, number];
  velocity: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  color: string;
  age: number;
  maxAge: number;
}

// Procedural Flower Species definition
export interface FlowerSpecies {
  name: string;
  petalCount: number;
  petalShape: 'round' | 'pointed' | 'slender';
  color: string;
  secondaryColor: string;
  leafCount: number;
  stemCurvature: number; // Factor for bending curves
  scale: number;
}

export interface FlowerInstance {
  id: string;
  species: FlowerSpecies;
  growth: number; // 0 = Seed, 1.0 = Fully Open
  position: THREE.Vector3;
  normal: THREE.Vector3; // Direction pointing out of hand
}
