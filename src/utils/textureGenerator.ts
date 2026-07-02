import * as THREE from 'three';

// Procedural Canvas Texture Generator (Rule-compliant, no disk asset dependencies)
export class TextureGenerator {
  static createRoseTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // 1. Draw outer glowing drop shadow
    ctx.shadowColor = 'rgba(251, 113, 133, 0.5)';
    ctx.shadowBlur = 12;

    // 2. Draw outer petals (watercolor layers)
    ctx.fillStyle = '#ff8da1';
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const x = 64 + Math.cos(angle) * 24;
      const y = 64 + Math.sin(angle) * 24;
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Draw middle layer petals
    ctx.shadowBlur = 0; // reset shadow
    ctx.fillStyle = '#f43f5e';
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI * 2) / 4 + Math.PI / 4;
      const x = 64 + Math.cos(angle) * 14;
      const y = 64 + Math.sin(angle) * 14;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw inner spiral center (Ghibli rose style)
    ctx.fillStyle = '#be123c';
    ctx.beginPath();
    ctx.arc(64, 64, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffe4e6';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Inner spiral swirl
    ctx.arc(64, 64, 8, 0, Math.PI * 1.5);
    ctx.stroke();

    // Small golden center stamen dots
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(62, 62, 2.5, 0, Math.PI * 2);
    ctx.arc(67, 65, 2.0, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  static createPetalTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Draw soft pink rose petal
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.moveTo(32, 8);
    // Left curve
    ctx.bezierCurveTo(12, 8, 8, 38, 32, 54);
    // Right curve
    ctx.bezierCurveTo(56, 38, 52, 8, 32, 8);
    ctx.fill();

    // Highlight line
    ctx.strokeStyle = '#ffe4e6';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(32, 26, 12, -Math.PI / 2, 0);
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
  }

  static createSparkleTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // 4-point magic sparkle star
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.moveTo(32, 6);
    ctx.quadraticCurveTo(32, 32, 58, 32);
    ctx.quadraticCurveTo(32, 32, 32, 58);
    ctx.quadraticCurveTo(32, 32, 6, 32);
    ctx.quadraticCurveTo(32, 32, 32, 6);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  static createHeartTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Pastel pink heart sticker
    ctx.fillStyle = '#ff4d6d';
    ctx.shadowColor = 'rgba(255, 77, 109, 0.4)';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.moveTo(32, 20);
    ctx.bezierCurveTo(32, 10, 14, 10, 14, 26);
    ctx.bezierCurveTo(14, 42, 32, 54, 32, 58);
    ctx.bezierCurveTo(32, 54, 50, 42, 50, 26);
    ctx.bezierCurveTo(50, 10, 32, 10, 32, 20);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  static createGlowTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
  }

  static createButterflyTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Draw cute Ghibli butterfly wings
    ctx.fillStyle = '#a5f3fc';
    ctx.shadowColor = 'rgba(165, 243, 252, 0.5)';
    ctx.shadowBlur = 10;

    // Left wings
    ctx.beginPath();
    ctx.ellipse(42, 48, 28, 38, -Math.PI / 6, 0, Math.PI * 2);
    ctx.ellipse(46, 80, 22, 24, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // Right wings
    ctx.beginPath();
    ctx.ellipse(86, 48, 28, 38, Math.PI / 6, 0, Math.PI * 2);
    ctx.ellipse(82, 80, 22, 24, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // Wings pattern
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.arc(38, 44, 12, 0, Math.PI * 2);
    ctx.arc(90, 44, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.arc(64, 34, 4, 0, Math.PI * 2); // head
    ctx.fill();

    ctx.fillRect(62.5, 38, 3, 56); // body torso

    // Antennae
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(63, 32);
    ctx.quadraticCurveTo(58, 22, 52, 20);
    ctx.moveTo(65, 32);
    ctx.quadraticCurveTo(70, 22, 76, 20);
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
  }
}
