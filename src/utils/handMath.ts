import * as THREE from 'three';

// Calculates curl ratios (0 = closed/fist, 1 = fully open/palm)
export function getFingerCurl(landmarks: THREE.Vector3[], joints: number[]): number {
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
export default getFingerCurl;
