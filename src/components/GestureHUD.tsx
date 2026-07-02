import React from 'react';

interface GestureHUDProps {
  gestures: Record<string, string>; // e.g. { left: 'open', right: 'none' }
}

const GESTURE_INFO: Record<string, { emoji: string; title: string; desc: string }> = {
  open: {
    emoji: '🖐️',
    title: 'Floating Bouquet',
    desc: 'Crystal roses gently materializing above every fingertip.'
  },
  pinch: {
    emoji: '🤏',
    title: 'Glowing Rose',
    desc: 'A tiny glowing rose forms between your fingers.'
  },
  point: {
    emoji: '☝️',
    title: 'Butterfly Landed',
    desc: 'A tiny flappable butterfly resting beside your fingertip.'
  },
  thumbs_up: {
    emoji: '👍',
    title: 'Hearts Bouquet',
    desc: 'A cluster of roses releasing a stream of floating hearts.'
  },
  victory: {
    emoji: '✌️',
    title: 'Orbiting Twins',
    desc: 'Two playful crystal flowers orbiting your fingers.'
  },
  together: {
    emoji: '🤲',
    title: 'Impossible Bouquet',
    desc: 'An enormous floating bouquet suspended between your palms.'
  },
  apart: {
    emoji: '👐',
    title: 'Bouquet Split',
    desc: "The bouquet separates: 'One for me, one for you.'"
  },
  none: {
    emoji: '✨',
    title: 'Stardust Aura',
    desc: 'Hands empty but alive, surrounded by faint fingertip sparkles.'
  }
};

export const GestureHUD: React.FC<GestureHUDProps> = ({ gestures }) => {
  const activeEntries = Object.entries(gestures).filter(([_, gesture]) => gesture !== 'none');

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none flex flex-col gap-3 items-center">
      {activeEntries.length === 0 ? (
        // Render Faint Idle State Indicator
        <div className="glass-panel px-6 py-3 flex items-center gap-3 animate-fade-in" style={{ backgroundColor: 'rgba(46, 26, 71, 0.25)', border: '1px solid rgba(251, 180, 217, 0.2)' }}>
          <span style={{ fontSize: '1.2rem' }}>✨</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#ffe4e6', fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.05em' }}>Stardust Aura Active</span>
            <span style={{ color: '#fbcfe8', fontSize: '0.7rem', opacity: 0.85 }}>Faint sparkles orbiting fingertips. Perform gestures to bloom!</span>
          </div>
        </div>
      ) : (
        // Render Active Gesture Cards
        activeEntries.map(([handId, gesture]) => {
          const info = GESTURE_INFO[gesture] || GESTURE_INFO.none;
          return (
            <div
              key={handId}
              className="glass-panel px-6 py-4 flex items-center gap-4 animate-scale-up"
              style={{
                backgroundColor: 'rgba(46, 26, 71, 0.35)',
                border: '1px solid rgba(251, 180, 217, 0.3)',
                boxShadow: '0 8px 32px 0 rgba(218, 27, 117, 0.15)',
                width: 'min(320px, calc(100vw - 32px))'
              }}
            >
              <div style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {info.emoji}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ textTransform: 'uppercase', fontSize: '0.6rem', color: '#ff8da1', fontWeight: '700', letterSpacing: '0.1em' }}>
                    {handId} Hand
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem' }}>•</span>
                  <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '700' }}>
                    {info.title}
                  </span>
                </div>
                <span style={{ color: '#fbcfe8', fontSize: '0.75rem', opacity: 0.9 }}>
                  {info.desc}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default GestureHUD;
