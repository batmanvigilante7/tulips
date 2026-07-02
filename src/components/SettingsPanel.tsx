import React, { useEffect, useRef } from 'react';
import { useSettingsStore, type ColorTheme, type FlowerType } from '../store/settingsStore';

import '../styles/settings-panel.css';

export const SettingsPanel: React.FC = () => {
  const {
    isOpen,
    mirrorCamera,
    showSkeleton,
    particleDensity,
    colorTheme,
    flowerSpecies,
    smoothingAlpha,
    setOpen,
    toggleOpen,
    updateSettings,
  } = useSettingsStore();

  const panelRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !(e.target as Element).closest('.settings-gear-btn')
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setOpen]);

  const themes: ColorTheme[] = [
    'Sakura (Pink)',
    'Cosmo (Blue/Teal)',
    'Solar (Gold)',
    'Aurora (Green)',
  ];

  return (
    <>
      {/* Floating Gear Trigger Button */}
      <button
        className="settings-gear-btn glass-panel"
        onClick={toggleOpen}
        aria-label="Open settings"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`gear-icon ${isOpen ? 'rotate' : ''}`}
        >
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      {/* Backdrop overlay */}
      <div className={`settings-backdrop ${isOpen ? 'active' : ''}`} />

      {/* Settings Drawer / Bottom Sheet */}
      <div
        ref={panelRef}
        className={`settings-panel glass-panel ${isOpen ? 'open' : ''}`}
        style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
      >
        <div className="settings-header">
          <h2 className="settings-title">Engine Config</h2>
          <button className="settings-close-btn" onClick={() => setOpen(false)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="settings-body">
          {/* Theme Selector */}
          <div className="setting-item">
            <label className="setting-label">Aesthetic Palette</label>
            <div className="theme-grid">
              {themes.map((theme) => (
                <button
                  key={theme}
                  className={`theme-chip-btn ${
                    colorTheme === theme ? 'active' : ''
                  }`}
                  onClick={() => updateSettings({ colorTheme: theme })}
                >
                  <span className={`theme-indicator ${theme.toLowerCase().replace(/[\s()/]/g, '')}`} />
                  <span className="theme-name">{theme.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Flower Species Selector */}
          <div className="setting-item">
            <label className="setting-label">Gifting Flower Species</label>
            <div className="species-grid">
              {(['rose', 'tulip', 'daisy', 'cherryblossom', 'lavender', 'hydrangea'] as FlowerType[]).map((species) => (
                <button
                  key={species}
                  className={`species-chip-btn ${
                    flowerSpecies === species ? 'active' : ''
                  }`}
                  onClick={() => updateSettings({ flowerSpecies: species })}
                >
                  <span className="species-name">
                    {species === 'cherryblossom' ? 'Cherry Blossom' : species.charAt(0).toUpperCase() + species.slice(1)}
                  </span>
                </button>
              ))}
            </div>
          </div>


          {/* Toggle Switches */}
          <div className="setting-item flex-row">
            <div className="setting-info">
              <span className="setting-name">Mirror Camera</span>
              <span className="setting-desc">Flip horizontal tracking</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={mirrorCamera}
                onChange={(e) => updateSettings({ mirrorCamera: e.target.checked })}
              />
              <span className="slider-round"></span>
            </label>
          </div>

          <div className="setting-item flex-row">
            <div className="setting-info">
              <span className="setting-name">Show Hand Skeleton</span>
              <span className="setting-desc">Render constellation dots</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={showSkeleton}
                onChange={(e) => updateSettings({ showSkeleton: e.target.checked })}
              />
              <span className="slider-round"></span>
            </label>
          </div>

          {/* Sliders */}
          <div className="setting-item">
            <div className="setting-slider-header">
              <span className="setting-name">Temporal Smoothing</span>
              <span className="setting-val">{smoothingAlpha.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.80"
              step="0.01"
              value={smoothingAlpha}
              onChange={(e) => updateSettings({ smoothingAlpha: parseFloat(e.target.value) })}
              className="settings-slider"
            />
            <div className="slider-labels">
              <span>Stable (Slow)</span>
              <span>Raw (Fast)</span>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-slider-header">
              <span className="setting-name">Particle Density</span>
              <span className="setting-val">{particleDensity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="2.0"
              step="0.1"
              value={particleDensity}
              onChange={(e) => updateSettings({ particleDensity: parseFloat(e.target.value) })}
              className="settings-slider"
            />
            <div className="slider-labels">
              <span>Performance</span>
              <span>Lush</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
