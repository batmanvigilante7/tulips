import * as THREE from 'three';

// Exponential Moving Average smoother for reducing hand jitter
export class EMASmoother {
  private history: Map<string, THREE.Vector3> = new Map();
  public alpha: number;

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

    prevVal.lerp(currentVal, this.alpha);
    return prevVal.clone();
  }

  reset() {
    this.history.clear();
  }
}
export default EMASmoother;
