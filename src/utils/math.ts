import * as THREE from 'three';

/**
 * Exponential Moving Average (EMA) filter for 3D coordinates.
 * Helps reduce tracking jitter while maintaining responsiveness.
 */
export class EMASmoother {
  private history: Map<string, THREE.Vector3> = new Map();
  private alpha: number;

  constructor(alpha: number = 0.25) {
    this.alpha = alpha;
  }

  smooth(handId: string, landmarkIndex: number, currentVal: THREE.Vector3): THREE.Vector3 {
    const key = `${handId}_${landmarkIndex}`;
    const prevVal = this.history.get(key);

    if (!prevVal) {
      this.history.set(key, currentVal.clone());
      return currentVal;
    }

    // Exponential interpolation: smoothed = prev * (1 - alpha) + current * alpha
    prevVal.lerp(currentVal, this.alpha);
    return prevVal.clone();
  }

  reset() {
    this.history.clear();
  }
}

/**
 * Calculates the curl factor of a finger (0 = closed/curled, 1 = fully open/extended).
 * Compares the distance from fingertip to knuckle joint against straight joint segments.
 */
export function calculateFingerCurl(
  landmarks: THREE.Vector3[],
  jointIndices: number[] // e.g. [5, 6, 7, 8] for index finger
): number {
  if (landmarks.length < 21 || jointIndices.length < 3) return 1.0;

  const baseKnuckle = landmarks[jointIndices[0]];
  const fingertip = landmarks[jointIndices[jointIndices.length - 1]];
  const currentDistance = baseKnuckle.distanceTo(fingertip);

  let straightLength = 0;
  for (let i = 0; i < jointIndices.length - 1; i++) {
    const p1 = landmarks[jointIndices[i]];
    const p2 = landmarks[jointIndices[i + 1]];
    straightLength += p1.distanceTo(p2);
  }

  if (straightLength === 0) return 1.0;

  // Normalize curl between 0 and 1
  const ratio = currentDistance / straightLength;
  
  // Fit to comfortable min/max curl ranges (e.g. min 0.48 curled, max 0.92 straight)
  const minCurl = 0.48;
  const maxCurl = 0.92;
  const curlVal = (ratio - minCurl) / (maxCurl - minCurl);
  return Math.max(0, Math.min(1, curlVal));
}
