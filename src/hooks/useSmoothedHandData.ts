import { useMemo, useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { EMASmoother } from '../utils/smoothing';
import { getFingerCurl } from '../utils/handMath';
import { GestureEngine } from '../gestures/GestureEngine';
import { getNDCFromNormalized, get3DPosition } from '../utils/coordinateMapping';
import type { HandData, GestureType } from '../types';
import { useSettingsStore } from '../store/settingsStore';

// Gesture Priority Weight Rules (Rule 5: One primary interaction at a time)
const GESTURE_PRIORITIES: Record<string, number> = {
  hands_together: 10,
  hands_apart: 9,
  pinch: 8,
  thumbs_up: 7,
  victory: 6,
  point: 5,
  open_palm: 4,
  closed_fist: 3
};

export function useSmoothedHandData() {
  const { camera, size: canvasSize } = useThree();
  const smoothingAlpha = useSettingsStore((state) => state.smoothingAlpha);

  // Smoothers for up to 2 hands (left and right)
  const smootherLeft = useMemo(() => new EMASmoother(smoothingAlpha), []);
  const smootherRight = useMemo(() => new EMASmoother(smoothingAlpha), []);

  // Update smoother alpha when settings change
  useEffect(() => {
    smootherLeft.alpha = smoothingAlpha;
    smootherRight.alpha = smoothingAlpha;
  }, [smoothingAlpha, smootherLeft, smootherRight]);

  // Gesture Engine instantiation
  const gestureEngine = useMemo(() => new GestureEngine(), []);


  // Hysteresis temporal hold filters (Rule 1: hold gesture for 150-250ms before active)
  const lastDetectedGesture = useRef<Record<string, string>>({});
  const gestureHoldTime = useRef<Record<string, number>>({});
  const currentStableGesture = useRef<Record<string, string>>({});

  const processHands = (
    results: HandLandmarkerResult | null,
    video: HTMLVideoElement | null,
    mirrorX: boolean
  ): HandData[] => {
    if (!results || !results.landmarks || !video || video.readyState < 2) {
      return [];
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const containerWidth = canvasSize.width;
    const containerHeight = canvasSize.height;

    if (videoWidth <= 0 || videoHeight <= 0) return [];

    // Pass 1: Project coordinates and smooth landmarks
    const handModels = results.landmarks.map((landmarks, index) => {
      const isLeft = results.handednesses?.[index]?.[0]?.categoryName === 'Left';
      const smoother = isLeft ? smootherLeft : smootherRight;
      const handId = isLeft ? 'left' : 'right';

      const smoothedLandmarks = landmarks.map((lm, lmIdx) => {
        const ndc = getNDCFromNormalized(
          lm.x,
          lm.y,
          videoWidth,
          videoHeight,
          containerWidth,
          containerHeight,
          mirrorX
        );

        const basePlaneZ = 0;
        const handZOffset = -landmarks[0].z * 1.5;
        const rawWorldPos = get3DPosition(ndc, camera, basePlaneZ + handZOffset);

        return smoother.smooth(handId, lmIdx, rawWorldPos);
      });

      const wrist = smoothedLandmarks[0] || new THREE.Vector3();
      const thumbFingertip = smoothedLandmarks[4] || new THREE.Vector3();
      const indexFingertip = smoothedLandmarks[8] || new THREE.Vector3();
      const pinchMidpoint = new THREE.Vector3().addVectors(thumbFingertip, indexFingertip).multiplyScalar(0.5);

      const fingerCurls = {
        thumb: getFingerCurl(smoothedLandmarks, [0, 2, 3, 4]),
        index: getFingerCurl(smoothedLandmarks, [0, 5, 6, 7, 8]),
        middle: getFingerCurl(smoothedLandmarks, [0, 9, 10, 11, 12]),
        ring: getFingerCurl(smoothedLandmarks, [0, 13, 14, 15, 16]),
        pinky: getFingerCurl(smoothedLandmarks, [0, 17, 18, 19, 20])
      };

      const pinchDist = thumbFingertip.distanceTo(indexFingertip);
      const pinchStrength = Math.max(0, Math.min(1.0, 1.0 - (pinchDist - 0.04) / 0.14));

      return {
        landmarks,
        smoothedLandmarks,
        isLeft,
        handId,
        wrist,
        thumbFingertip,
        indexFingertip,
        pinchMidpoint,
        fingerCurls,
        pinchStrength
      };
    });

    // Pass 2: Apply Priority filter & Temporal holding (Rule 1 & Rule 5)
    return handModels.map((model, idx) => {
      const otherModel = handModels[idx === 0 ? 1 : 0];
      const otherLandmarks = otherModel ? otherModel.smoothedLandmarks : undefined;

      const recognized = gestureEngine.recognize(model.handId, model.smoothedLandmarks, otherLandmarks);
      
      // Filter out low confidence matches (strict intentionality >= 0.9)
      const validMatches = recognized.filter(m => m.confidence >= 0.9);

      // Sort by priority weights defined in GESTURE_PRIORITIES
      const sortedMatches = validMatches.sort((a, b) => {
        const prioA = GESTURE_PRIORITIES[a.name] || 0;
        const prioB = GESTURE_PRIORITIES[b.name] || 0;
        return prioB - prioA;
      });

      // Raw candidate for this frame
      const candidateName = sortedMatches.length > 0 ? sortedMatches[0].name : 'none';
      const confidence = sortedMatches.length > 0 ? sortedMatches[0].confidence : 0.0;

      // Temporal hold Hysteresis Filter (Rule 1: hold for 200ms)
      const handId = model.handId;
      const now = performance.now();

      if (candidateName !== lastDetectedGesture.current[handId]) {
        // Candidate changed -> Start hold timer
        lastDetectedGesture.current[handId] = candidateName;
        gestureHoldTime.current[handId] = now;
      } else {
        // Candidate remains stable -> Check timer
        const elapsed = now - (gestureHoldTime.current[handId] || now);
        if (elapsed >= 200) { // 200ms temporal filter
          currentStableGesture.current[handId] = candidateName;
        }
      }

      // Default stable gesture if none set yet
      if (!currentStableGesture.current[handId]) {
        currentStableGesture.current[handId] = 'none';
      }

      // Map string stable gesture to GestureType Enum
      let gesture: GestureType = 'none';
      const stableName = currentStableGesture.current[handId];
      if (stableName === 'pinch') gesture = 'pinch';
      else if (stableName === 'open_palm') gesture = 'open';
      else if (stableName === 'closed_fist') gesture = 'fist';
      else if (stableName === 'victory') gesture = 'victory';
      else if (stableName === 'point') gesture = 'point';
      else if (stableName === 'thumbs_up') gesture = 'thumbs_up';
      else if (stableName === 'hands_together') gesture = 'together';
      else if (stableName === 'hands_apart') gesture = 'apart';

      return {
        landmarks: model.landmarks,
        smoothedLandmarks: model.smoothedLandmarks,
        isLeft: model.isLeft,
        gesture,
        gestureConfidence: confidence,
        pinchStrength: model.pinchStrength,
        pinchMidpoint: model.pinchMidpoint,
        indexFingertip: model.indexFingertip,
        thumbFingertip: model.thumbFingertip,
        wrist: model.wrist,
        fingerCurls: model.fingerCurls
      };
    });
  };

  return { processHands };
}
export default useSmoothedHandData;
