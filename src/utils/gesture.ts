export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/**
 * Calculates the Euclidean distance between two 3D landmarks.
 */
export function calculateDistance(p1: Landmark, p2: Landmark): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Detects if the hand is performing a pinch gesture (thumb tip and index tip close together).
 * Default threshold is 0.08.
 */
export function detectPinch(
  landmarks: Landmark[],
  threshold: number = 0.08
): { isPinching: boolean; distance: number } {
  // Landmark 4 is Thumb Tip, Landmark 8 is Index Finger Tip
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];

  if (!thumbTip || !indexTip) {
    return { isPinching: false, distance: 999 };
  }

  const distance = calculateDistance(thumbTip, indexTip);
  return {
    isPinching: distance < threshold,
    distance
  };
}

/**
 * Checks if the hand is fully open (palm gesture).
 * We can verify this by checking if the tips of the fingers are further from the wrist (landmark 0)
 * than the joint/knuckle landmarks (landmarks 5, 9, 13, 17).
 */
export function isHandOpen(landmarks: Landmark[]): boolean {
  if (landmarks.length < 21) return false;
  
  const wrist = landmarks[0];
  
  // Finger tip indices: 8 (index), 12 (middle), 16 (ring), 20 (pinky)
  // Finger base indices: 5 (index base), 9 (middle base), 13 (ring base), 17 (pinky base)
  const tipIndices = [8, 12, 16, 20];
  const baseIndices = [5, 9, 13, 17];
  
  let extendedFingers = 0;
  for (let i = 0; i < tipIndices.length; i++) {
    const tipDist = calculateDistance(landmarks[tipIndices[i]], wrist);
    const baseDist = calculateDistance(landmarks[baseIndices[i]], wrist);
    if (tipDist > baseDist) {
      extendedFingers++;
    }
  }
  
  return extendedFingers >= 3;
}
