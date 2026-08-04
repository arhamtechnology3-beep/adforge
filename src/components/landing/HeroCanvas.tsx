'use client';

import { useEffect, useRef } from 'react';

/** Interactive aurora mesh — reacts to pointer for immersive depth */
export default function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let mx = 0.5;
    let my = 0.4;
    let t = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width;
      my = (e.clientY - r.top) / r.height;
    };

    const blobs = [
      { x: 0.25, y: 0.35, r: 0.28, c: [14, 116, 110] },
      { x: 0.72, y: 0.28, r: 0.32, c: [232, 93, 4] },
      { x: 0.55, y: 0.7, r: 0.26, c: [30, 64, 95] },
      { x: 0.18, y: 0.75, r: 0.2, c: [180, 83, 9] },
    ];

    const draw = () => {
      t += reduce ? 0 : 0.004;
      ctx.clearRect(0, 0, w, h);

      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#e6edf4');
      g.addColorStop(0.5, '#f3f6f9');
      g.addColorStop(1, '#dde7f0');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        const px = (b.x + Math.sin(t + i) * 0.04 + (mx - 0.5) * 0.08) * w;
        const py = (b.y + Math.cos(t * 0.9 + i) * 0.05 + (my - 0.5) * 0.1) * h;
        const rad = b.r * Math.min(w, h);
        const grad = ctx.createRadialGradient(px, py, 0, px, py, rad);
        const [cr, cg, cb] = b.c;
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.28)`);
        grad.addColorStop(0.55, `rgba(${cr},${cg},${cb},0.08)`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // fine grain grid that shifts with pointer
      ctx.strokeStyle = 'rgba(11,18,32,0.04)';
      ctx.lineWidth = 1;
      const gap = 42;
      const ox = (mx - 0.5) * 24;
      const oy = (my - 0.5) * 18;
      for (let x = -gap; x < w + gap; x += gap) {
        ctx.beginPath();
        ctx.moveTo(x + ox, 0);
        ctx.lineTo(x + ox, h);
        ctx.stroke();
      }
      for (let y = -gap; y < h + gap; y += gap) {
        ctx.beginPath();
        ctx.moveTo(0, y + oy);
        ctx.lineTo(w, y + oy);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', onMove);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', onMove);
    };
  }, []);

  return <canvas ref={ref} className="af-canvas" aria-hidden />;
}
