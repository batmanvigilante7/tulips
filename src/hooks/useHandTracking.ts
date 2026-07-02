import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';

export function useHandTracking() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  useEffect(() => {
    let active = true;

    async function initHandLandmarker() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );
        
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });

        if (active) {
          landmarkerRef.current = landmarker;
          setIsLoaded(true);
        } else {
          landmarker.close();
        }
      } catch (err) {
        console.error("Failed to initialize MediaPipe Hand Landmarker:", err);
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    initHandLandmarker();

    return () => {
      active = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  const detectHands = (videoElement: HTMLVideoElement, timestamp: number): HandLandmarkerResult | null => {
    if (!landmarkerRef.current || !isLoaded) return null;
    
    // Ensure video is ready to be processed
    if (videoElement.readyState < 2) return null;

    try {
      return landmarkerRef.current.detectForVideo(videoElement, timestamp);
    } catch (e) {
      console.error("Error in HandLandmarker.detectForVideo:", e);
      return null;
    }
  };

  return { isLoaded, error, detectHands };
}
