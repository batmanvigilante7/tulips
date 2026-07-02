import * as THREE from 'three';

export interface GestureResult {
  name: string;
  confidence: number;
}

export interface GestureDefinition {
  name: string;
  detect: (
    landmarks: THREE.Vector3[],
    otherHandLandmarks?: THREE.Vector3[]
  ) => { isMatch: boolean; confidence: number };
}

// Finger joint mapping
const FINGER_JOINTS = {
  thumb: [0, 2, 3, 4],
  index: [0, 5, 6, 7, 8],
  middle: [0, 9, 10, 11, 12],
  ring: [0, 13, 14, 15, 16],
  pinky: [0, 17, 18, 19, 20]
};

// Calculate finger curl factor (0 = closed, 1 = fully open)
function getCurl(landmarks: THREE.Vector3[], joints: number[]): number {
  if (landmarks.length < 21) return 0;
  const base = landmarks[joints[0]];
  const tip = landmarks[joints[joints.length - 1]];
  const currentDist = base.distanceTo(tip);

  let straightLen = 0;
  for (let i = 0; i < joints.length - 1; i++) {
    straightLen += landmarks[joints[i]].distanceTo(landmarks[joints[i + 1]]);
  }
  if (straightLen === 0) return 0;
  
  const ratio = currentDist / straightLen;
  const minCurl = 0.48;
  const maxCurl = 0.92;
  return Math.max(0, Math.min(1, (ratio - minCurl) / (maxCurl - minCurl)));
}

export class GestureEngine {
  private gestures: Map<string, GestureDefinition> = new Map();
  private history: Map<string, Map<string, number[]>> = new Map();
  private bufferSize: number = 8; // Frame smoothing buffer

  constructor() {
    this.registerDefaultGestures();
  }

  registerGesture(definition: GestureDefinition) {
    this.gestures.set(definition.name, definition);
  }

  private getSmoothedConfidence(handId: string, name: string, rawConfidence: number): number {
    if (!this.history.has(handId)) {
      this.history.set(handId, new Map());
    }
    const handMap = this.history.get(handId)!;
    if (!handMap.has(name)) {
      handMap.set(name, []);
    }
    const list = handMap.get(name)!;
    list.push(rawConfidence);
    if (list.length > this.bufferSize) {
      list.shift();
    }
    const sum = list.reduce((a, b) => a + b, 0);
    return sum / list.length;
  }

  recognize(
    handId: string,
    landmarks: THREE.Vector3[],
    otherHandLandmarks?: THREE.Vector3[]
  ): GestureResult[] {
    if (landmarks.length < 21) return [];

    const results: GestureResult[] = [];
    this.gestures.forEach((def, name) => {
      const match = def.detect(landmarks, otherHandLandmarks);
      const smoothedConf = this.getSmoothedConfidence(handId, name, match.isMatch ? match.confidence : 0);
      
      if (smoothedConf > 0.45) {
        results.push({ name, confidence: smoothedConf });
      }
    });

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private registerDefaultGestures() {
    // 1. PINCH
    this.registerGesture({
      name: 'pinch',
      detect: (landmarks) => {
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const dist = thumbTip.distanceTo(indexTip);
        const isMatch = dist < 0.082;
        const confidence = isMatch ? Math.max(0, Math.min(1.0, 1.0 - (dist / 0.082))) : 0;
        return { isMatch, confidence };
      }
    });

    // 2. OPEN PALM
    this.registerGesture({
      name: 'open_palm',
      detect: (landmarks) => {
        const curls = [
          getCurl(landmarks, FINGER_JOINTS.thumb),
          getCurl(landmarks, FINGER_JOINTS.index),
          getCurl(landmarks, FINGER_JOINTS.middle),
          getCurl(landmarks, FINGER_JOINTS.ring),
          getCurl(landmarks, FINGER_JOINTS.pinky)
        ];
        const avgCurl = curls.reduce((a, b) => a + b, 0) / 5;
        const isMatch = avgCurl > 0.72;
        return { isMatch, confidence: isMatch ? avgCurl : 0 };
      }
    });

    // 3. CLOSED FIST
    this.registerGesture({
      name: 'closed_fist',
      detect: (landmarks) => {
        const curls = [
          getCurl(landmarks, FINGER_JOINTS.index),
          getCurl(landmarks, FINGER_JOINTS.middle),
          getCurl(landmarks, FINGER_JOINTS.ring),
          getCurl(landmarks, FINGER_JOINTS.pinky)
        ];
        const avgCurl = curls.reduce((a, b) => a + b, 0) / 4;
        const isMatch = avgCurl < 0.22;
        const confidence = isMatch ? 1.0 - avgCurl : 0;
        return { isMatch, confidence };
      }
    });

    // 4. VICTORY
    this.registerGesture({
      name: 'victory',
      detect: (landmarks) => {
        const indexCurl = getCurl(landmarks, FINGER_JOINTS.index);
        const middleCurl = getCurl(landmarks, FINGER_JOINTS.middle);
        const ringCurl = getCurl(landmarks, FINGER_JOINTS.ring);
        const pinkyCurl = getCurl(landmarks, FINGER_JOINTS.pinky);

        const isMatch = indexCurl > 0.7 && middleCurl > 0.7 && ringCurl < 0.3 && pinkyCurl < 0.3;
        const confidence = isMatch ? (indexCurl + middleCurl + (1.0 - ringCurl) + (1.0 - pinkyCurl)) / 4 : 0;
        return { isMatch, confidence };
      }
    });

    // 5. POINT
    this.registerGesture({
      name: 'point',
      detect: (landmarks) => {
        const indexCurl = getCurl(landmarks, FINGER_JOINTS.index);
        const middleCurl = getCurl(landmarks, FINGER_JOINTS.middle);
        const ringCurl = getCurl(landmarks, FINGER_JOINTS.ring);
        const pinkyCurl = getCurl(landmarks, FINGER_JOINTS.pinky);

        const isMatch = indexCurl > 0.75 && middleCurl < 0.3 && ringCurl < 0.3 && pinkyCurl < 0.3;
        const confidence = isMatch ? (indexCurl + (1.0 - middleCurl) + (1.0 - ringCurl) + (1.0 - pinkyCurl)) / 4 : 0;
        return { isMatch, confidence };
      }
    });

    // 6. THUMBS UP
    this.registerGesture({
      name: 'thumbs_up',
      detect: (landmarks) => {
        const curls = {
          thumb: getCurl(landmarks, FINGER_JOINTS.thumb),
          index: getCurl(landmarks, FINGER_JOINTS.index),
          middle: getCurl(landmarks, FINGER_JOINTS.middle),
          ring: getCurl(landmarks, FINGER_JOINTS.ring),
          pinky: getCurl(landmarks, FINGER_JOINTS.pinky)
        };
        const thumbTip = landmarks[4];
        const thumbKnuckle = landmarks[2];

        // Thumb pointing upwards, others curled
        const thumbUp = thumbTip.y > thumbKnuckle.y + 0.05;
        const othersCurled = curls.index < 0.28 && curls.middle < 0.28 && curls.ring < 0.28 && curls.pinky < 0.28;

        const isMatch = thumbUp && othersCurled;
        const confidence = isMatch ? curls.thumb : 0;
        return { isMatch, confidence };
      }
    });

    // 7. HANDS TOGETHER (Two hands)
    this.registerGesture({
      name: 'hands_together',
      detect: (landmarks, otherHandLandmarks) => {
        if (!otherHandLandmarks || otherHandLandmarks.length < 21) {
          return { isMatch: false, confidence: 0 };
        }
        const w1 = landmarks[0];
        const w2 = otherHandLandmarks[0];
        const dist = w1.distanceTo(w2);
        
        const isMatch = dist < 0.42;
        const confidence = isMatch ? Math.max(0, Math.min(1.0, 1.0 - (dist / 0.42))) : 0;
        return { isMatch, confidence };
      }
    });

    // 8. HANDS APART (Two hands)
    this.registerGesture({
      name: 'hands_apart',
      detect: (landmarks, otherHandLandmarks) => {
        if (!otherHandLandmarks || otherHandLandmarks.length < 21) {
          return { isMatch: false, confidence: 0 };
        }
        const w1 = landmarks[0];
        const w2 = otherHandLandmarks[0];
        const dist = w1.distanceTo(w2);
        
        const isMatch = dist > 1.35;
        const confidence = isMatch ? Math.min(1.0, (dist - 1.35) / 1.0) : 0;
        return { isMatch, confidence };
      }
    });
  }
}
export default GestureEngine;
