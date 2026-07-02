import React, { useEffect, useRef, useState } from 'react';

interface WebcamFeedProps {
  onVideoReady: (video: HTMLVideoElement) => void;
  onVideoError: (error: string) => void;
}

export const WebcamFeed: React.FC<WebcamFeedProps> = ({ onVideoReady, onVideoError }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamActive, setStreamActive] = useState(false);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;

    async function setupCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        onVideoError("Browser does not support webcam access.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user', // Selfie camera
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (active && videoRef.current) {
          videoRef.current.srcObject = stream;
          // Use loadeddata instead of loadedmetadata to make sure frames are ready
          const handleLoadedData = () => {
            if (videoRef.current && active) {
              videoRef.current.play()
                .then(() => {
                  if (active && videoRef.current) {
                    onVideoReady(videoRef.current);
                    setStreamActive(true);
                  }
                })
                .catch(err => {
                  console.error("Video play failed:", err);
                  onVideoError("Failed to start video playback. Please tap the screen to allow.");
                });
            }
          };

          videoRef.current.addEventListener('loadeddata', handleLoadedData);
        }
      } catch (err) {
        console.error("Camera access error:", err);
        if (active) {
          onVideoError("Failed to access camera. Please grant camera permissions.");
        }
      }
    }

    setupCamera();

    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onVideoReady, onVideoError]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        playsInline
        muted
        className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-700 ease-in-out ${
          streamActive ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {!streamActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white z-10">
          <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium tracking-wide text-zinc-400 animate-pulse">Initializing camera feed...</p>
        </div>
      )}
    </div>
  );
};
