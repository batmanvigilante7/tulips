import * as THREE from 'three';
import { calculateFingerCurl } from '../utils/math';
import type { GestureType } from '../types';

const FINGER_JOINTS = {
  thumb: [0, 2, 3, 4],
  index: [0, 5, 6, 7, 8],
  middle: [0, 9, 10, 11, 12],
  ring: [0, 13, 14, 15, 16],
  pinky: [0, 17, 18, 19, 20]
};

export function classifyHand(landmarks3D: THREE.Vector3[]): {
  gesture: GestureType;
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
} {
  const wrist = landmarks3D[0] || new THREE.Vector3();
  const thumbFingertip = landmarks3D[4] || new THREE.Vector3();
  const indexFingertip = landmarks3D[8] || new THREE.Vector3();

  // Calculate curls for all 5 fingers
  const curls = {
    thumb: calculateFingerCurl(landmarks3D, FINGER_JOINTS.thumb),
    index: calculateFingerCurl(landmarks3D, FINGER_JOINTS.index),
    middle: calculateFingerCurl(landmarks3D, FINGER_JOINTS.middle),
    ring: calculateFingerCurl(landmarks3D, FINGER_JOINTS.ring),
    pinky: calculateFingerCurl(landmarks3D, FINGER_JOINTS.pinky)
  };

  // Pinch calculation: distance between thumb tip (4) and index tip (8)
  const pinchDist = thumbFingertip.distanceTo(indexFingertip);
  const minPinchDist = 0.05; // fully pinched
  const maxPinchDist = 0.20; // fully open
  // pinchStrength: 1 = fully pinched, 0 = open
  const pinchStrength = Math.max(0, Math.min(1, 1 - (pinchDist - minPinchDist) / (maxPinchDist - minPinchDist)));

  const pinchMidpoint = new THREE.Vector3().addVectors(thumbFingertip, indexFingertip).multiplyScalar(0.5);

  // Gesture classification
  let gesture: GestureType = 'none';

  // Average curl of other fingers: middle, ring, pinky
  const otherCurlsAvg = (curls.middle + curls.ring + curls.pinky) / 3;

  if (pinchStrength > 0.82) {
    gesture = 'pinch';
  } else if (curls.index < 0.25 && otherCurlsAvg < 0.25) {
    gesture = 'fist';
  } else if (curls.index > 0.7 && otherCurlsAvg > 0.7) {
    gesture = 'open';
  }

  return {
    gesture,
    pinchStrength,
    pinchMidpoint,
    indexFingertip,
    thumbFingertip,
    wrist,
    fingerCurls: curls
  };
}
