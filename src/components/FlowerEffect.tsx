import React, { useMemo } from 'react';
import '../styles/flower-effect.css';

export interface FlowerEffectProps {
  x: number;          // screen x percentage (0 - 100)
  y: number;          // screen y percentage (0 - 100)
  scale?: number;     // scale multiplier (default: 1)
  visible?: boolean;  // toggle visibility with transition
  variant?: 1 | 2 | 3; // flower type / color theme (1 = Sakura/Pink, 2 = Mystic/Teal, 3 = Sunset/Gold)
  intensity?: number; // brightness and glow intensity (default: 1)
}

export const FlowerEffect: React.FC<FlowerEffectProps> = ({
  x,
  y,
  scale = 1.0,
  visible = true,
  variant = 1,
  intensity = 1.0,
}) => {
  // Compute color theme CSS variables based on the variant prop
  const themeStyles = useMemo(() => {
    let primary = '#ff69b4';
    let secondary = '#fce700';
    let accent = '#a7ffee';
    let stemColor1 = 'rgba(20, 122, 20, 0.4)';
    let stemColor2 = '#1aaa15';
    let stemBase = '#064600';
    let lightColor = '#fffd75';

    if (variant === 2) {
      // Mystic blue/teal
      primary = '#00e5ff';
      secondary = '#2979ff';
      accent = '#d500f9';
      stemColor1 = 'rgba(0, 100, 120, 0.4)';
      stemColor2 = '#00acc1';
      stemBase = '#006064';
      lightColor = '#e0f7fa';
    } else if (variant === 3) {
      // Sunset orange/gold
      primary = '#ff3d00';
      secondary = '#ffea00';
      accent = '#ff9100';
      stemColor1 = 'rgba(120, 80, 0, 0.4)';
      stemColor2 = '#ffb300';
      stemBase = '#5d4037';
      lightColor = '#fffde7';
    }

    return {
      '--fl-primary-color': primary,
      '--fl-secondary-color': secondary,
      '--fl-accent-color': accent,
      '--fl-stem-color-1': stemColor1,
      '--fl-stem-color-2': stemColor2,
      '--fl-stem-base': stemBase,
      '--fl-light-color': lightColor,
      // Apply intensity prop to the brightness and opacity filters
      filter: `brightness(${0.8 + intensity * 0.4}) drop-shadow(0 0 ${intensity * 12}px ${primary})`,
    } as React.CSSProperties;
  }, [variant, intensity]);

  // Position style relative to parent container
  const positionStyle = useMemo(() => {
    return {
      left: `${x}%`,
      top: `${y}%`,
      transform: `translate(-50%, -100%) scale(${scale})`, // base is stem bottom
    } as React.CSSProperties;
  }, [x, y, scale]);

  const combinedStyles = useMemo(() => {
    return { ...themeStyles, ...positionStyle };
  }, [themeStyles, positionStyle]);

  // Render correct DOM layout based on variant mapping
  return (
    <div
      className={`flower-effect-container ${visible ? '' : 'hidden'}`}
      style={combinedStyles}
    >
      <div className="flowers-wrapper">
        {variant === 1 && (
          <div className="flower flower--1">
            <div className="flower__leafs flower__leafs--1">
              <div className="flower__leaf flower__leaf--1"></div>
              <div className="flower__leaf flower__leaf--2"></div>
              <div className="flower__leaf flower__leaf--3"></div>
              <div className="flower__leaf flower__leaf--4"></div>
              <div className="flower__white-circle"></div>

              <div className="flower__light flower__light--1"></div>
              <div className="flower__light flower__light--2"></div>
              <div className="flower__light flower__light--3"></div>
              <div className="flower__light flower__light--4"></div>
              <div className="flower__light flower__light--5"></div>
              <div className="flower__light flower__light--6"></div>
              <div className="flower__light flower__light--7"></div>
              <div className="flower__light flower__light--8"></div>
            </div>
            <div className="flower__line">
              <div className="flower__line__leaf flower__line__leaf--1"></div>
              <div className="flower__line__leaf flower__line__leaf--2"></div>
              <div className="flower__line__leaf flower__line__leaf--3"></div>
              <div className="flower__line__leaf flower__line__leaf--4"></div>
              <div className="flower__line__leaf flower__line__leaf--5"></div>
              <div className="flower__line__leaf flower__line__leaf--6"></div>
            </div>
          </div>
        )}

        {variant === 2 && (
          <div className="flower flower--2">
            <div className="flower__leafs flower__leafs--2">
              <div className="flower__leaf flower__leaf--1"></div>
              <div className="flower__leaf flower__leaf--2"></div>
              <div className="flower__leaf flower__leaf--3"></div>
              <div className="flower__leaf flower__leaf--4"></div>
              <div className="flower__white-circle"></div>

              <div className="flower__light flower__light--1"></div>
              <div className="flower__light flower__light--2"></div>
              <div className="flower__light flower__light--3"></div>
              <div className="flower__light flower__light--4"></div>
              <div className="flower__light flower__light--5"></div>
              <div className="flower__light flower__light--6"></div>
              <div className="flower__light flower__light--7"></div>
              <div className="flower__light flower__light--8"></div>
            </div>
            <div className="flower__line">
              <div className="flower__line__leaf flower__line__leaf--1"></div>
              <div className="flower__line__leaf flower__line__leaf--2"></div>
              <div className="flower__line__leaf flower__line__leaf--3"></div>
              <div className="flower__line__leaf flower__line__leaf--4"></div>
            </div>
          </div>
        )}

        {variant === 3 && (
          <div className="flower flower--3">
            <div className="flower__leafs flower__leafs--3">
              <div className="flower__leaf flower__leaf--1"></div>
              <div className="flower__leaf flower__leaf--2"></div>
              <div className="flower__leaf flower__leaf--3"></div>
              <div className="flower__leaf flower__leaf--4"></div>
              <div className="flower__white-circle"></div>

              <div className="flower__light flower__light--1"></div>
              <div className="flower__light flower__light--2"></div>
              <div className="flower__light flower__light--3"></div>
              <div className="flower__light flower__light--4"></div>
              <div className="flower__light flower__light--5"></div>
              <div className="flower__light flower__light--6"></div>
              <div className="flower__light flower__light--7"></div>
              <div className="flower__light flower__light--8"></div>
            </div>
            <div className="flower__line">
              <div className="flower__line__leaf flower__line__leaf--1"></div>
              <div className="flower__line__leaf flower__line__leaf--2"></div>
              <div className="flower__line__leaf flower__line__leaf--3"></div>
              <div className="flower__line__leaf flower__line__leaf--4"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowerEffect;
