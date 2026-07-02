import { useState, useCallback } from 'react';
import { useHandTracking } from './hooks/useHandTracking';
import { WebcamFeed } from './components/WebcamFeed';
import { SceneCanvas } from './components/SceneCanvas';
import { GestureHUD } from './components/GestureHUD';
import { useCreativeEngineStore } from './store/creativeEngineStore';
import { SettingsPanel } from './components/SettingsPanel';



function App() {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const { isLoaded: isModelLoaded, error: modelError, detectHands } = useHandTracking();
  const activeGestures = useCreativeEngineStore((state) => state.gestures);


  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    setVideoElement(video);
  }, []);

  const handleVideoError = useCallback((errorMsg: string) => {
    setCameraError(errorMsg);
  }, []);

  const hasError = cameraError || modelError;
  const errorMessage = cameraError || modelError;

  return (
    <div className="app-container">
      {/* Background Webcam Feed */}
      {!hasError && (
        <WebcamFeed 
          onVideoReady={handleVideoReady} 
          onVideoError={handleVideoError} 
        />
      )}

      {/* R3F WebGL Overlay Canvas (Rule 2 & Rule 5 Compliance) */}
      {!hasError && isModelLoaded && videoElement && (
        <SceneCanvas
          video={videoElement}
          detectHands={detectHands}
          isModelLoaded={isModelLoaded}
        />
      )}

      {/* Settings Panel Overlay */}
      {!hasError && isModelLoaded && videoElement && (
        <SettingsPanel />
      )}




      {/* --- OVERLAY UI --- */}

      {/* App Header */}
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="glow-text app-title" style={{ letterSpacing: '0.08em' }}>
            Bloom AR
          </h1>
          <p className="app-subtitle" style={{ color: '#fbcfe8', opacity: 0.85 }}>
            Magical Holographic Florist
          </p>
        </div>

        {/* Status panel */}
        <div className="mode-selector" style={{ pointerEvents: 'none', padding: '6px 16px', fontSize: '0.75rem', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
            <span style={{ color: '#a1a1aa', fontWeight: '500' }}>MediaPipe:</span>
            <span style={{ color: '#f4f4f5', fontWeight: '600' }}>Active</span>
          </div>
          <div style={{ width: '1px', height: '12px', backgroundColor: 'rgba(255,255,255,0.15)' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#a1a1aa', fontWeight: '500' }}>Engine:</span>
            <span style={{ color: '#ffd700', fontWeight: '600' }}>R3F + Billboard Sprites</span>
          </div>
        </div>
      </header>

      {/* Glassmorphic Interaction HUD Overlay */}
      {!hasError && isModelLoaded && videoElement && (
        <GestureHUD gestures={activeGestures} />
      )}

      {/* Loader Overlays */}
      <div className="overlay-container">
        {!isModelLoaded && !hasError && (
          <div className="loader-card glass-panel">
            <div className="loader-ring" />
            <div>
              <p className="loader-title">Loading Hand Landmarker</p>
              <p className="loader-desc">Initializing neural tracking networks...</p>
            </div>
          </div>
        )}

        {isModelLoaded && !videoElement && !hasError && (
          <div className="loader-card glass-panel">
            <p className="loader-title">Accessing Webcam...</p>
            <p className="loader-desc">Please grant camera access when prompted.</p>
          </div>
        )}

        {isModelLoaded && videoElement && !hasError && !activeGestures.left && !activeGestures.right && (
          <div className="pulse-prompt">
            Raise hands in front of webcam to begin
          </div>
        )}

        {hasError && (
          <div className="error-card glass-panel">
            <span style={{ fontSize: '2.5rem', marginBottom: '8px', display: 'block' }}>⚠️</span>
            <h3 className="error-title">Initialization Failed</h3>
            <p className="error-desc">
              {errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="glow-btn"
              style={{ marginTop: '20px', fontSize: '0.8rem', padding: '10px 24px' }}
            >
              Reload Application
            </button>
          </div>
        )}
      </div>

      {/* Wholesome Ghibli Gesture Lexicon */}
      <footer className="app-footer">
        <div className="info-card glass-panel" style={{ maxWidth: '820px', width: '92%', backgroundColor: 'rgba(46, 26, 71, 0.2)' }}>
          <p className="card-title" style={{ letterSpacing: '0.15em', fontSize: '0.8rem', color: '#ff8da1' }}>
            🌸 Holographic Florist Lexicon 🌸
          </p>
          
          <div className="interaction-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            <div className="interaction-item">
              <span className="interaction-icon">✋</span>
              <div className="interaction-details">
                <span className="interaction-title">Open Palm</span>
                <span className="interaction-desc">Finger Crystal Roses</span>
              </div>
            </div>
            
            <div className="interaction-item">
              <span className="interaction-icon">🤏</span>
              <div className="interaction-details">
                <span className="interaction-title">Pinch & Drag</span>
                <span className="interaction-desc">Drag rose & flower ribbon</span>
              </div>
            </div>

            <div className="interaction-item">
              <span className="interaction-icon">✨</span>
              <div className="interaction-details">
                <span className="interaction-title">Release</span>
                <span className="interaction-desc">Petals, bubbles & hearts burst</span>
              </div>
            </div>

            <div className="interaction-item">
              <span className="interaction-icon">✌️</span>
              <div className="interaction-details">
                <span className="interaction-title">Victory</span>
                <span className="interaction-desc">Twin flowers orbit fingers</span>
              </div>
            </div>

            <div className="interaction-item">
              <span className="interaction-icon">☝️</span>
              <div className="interaction-details">
                <span className="interaction-title">Point</span>
                <span className="interaction-desc">Butterfly lands on fingertip</span>
              </div>
            </div>

            <div className="interaction-item">
              <span className="interaction-icon">👍</span>
              <div className="interaction-details">
                <span className="interaction-title">Thumbs Up</span>
                <span className="interaction-desc">Bouquet pops up with hearts</span>
              </div>
            </div>

            <div className="interaction-item">
              <span className="interaction-icon">🤲</span>
              <div className="interaction-details">
                <span className="interaction-title">Hands Together</span>
                <span className="interaction-desc">Bouquet merges & grows large</span>
              </div>
            </div>

            <div className="interaction-item">
              <span className="interaction-icon">👐</span>
              <div className="interaction-details">
                <span className="interaction-title">Hands Apart</span>
                <span className="interaction-desc">Bouquet splits: 'One for you'</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
