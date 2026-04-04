import { useEffect, useRef } from 'react';
import styles from './Auth.module.css';

export default function AnimatedGrid() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width, height;
    let animationFrameId;
    let time = 0;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    const drawLine = (x, y, angle, length, color, thickness) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.stroke();
    };

    const render = () => {
      time += 0.03;
      ctx.clearRect(0, 0, width, height);

      const spacing = 45; // Match spacing of the dots
      const angle = -Math.PI / 4; // 45 degrees up-right tilt
      const cols = Math.ceil(width / spacing) + 2;
      const rows = Math.ceil(height / spacing) + 2;

      for (let i = -1; i < cols; i++) {
        for (let j = -1; j < rows; j++) {
          const x = i * spacing;
          const y = j * spacing;
          
          // Wave logic
          const dist = Math.sqrt(Math.pow(x - width/2, 2) + Math.pow(y - height/2, 2));
          const wave = Math.sin(dist * 0.005 - time * 0.8) * 0.5 + 0.5;

          // Gradient colors matching the user's second image (Orange -> Pink -> Purple -> Blue)
          const r = Math.floor(255 - (x / width) * 150);
          const g = Math.floor(100 + wave * 50 - (y / height) * 50);
          const b = Math.floor(100 + (x / width) * 155);

          const dotLength = 3 + wave * 6; // dots stretch out
          const thickness = 2.5 + wave * 1.5;
          
          ctx.globalAlpha = 0.3 + wave * 0.7;
          drawLine(x, y, angle, dotLength, `rgb(${r}, ${g}, ${b})`, thickness);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvasBackground} />;
}
