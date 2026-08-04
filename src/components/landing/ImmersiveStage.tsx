'use client';

import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, LayoutGrid, Smartphone, Clapperboard } from 'lucide-react';

const SLIDES = [
  { badge: 'LIMITED OFFER', headline: 'Festive offer is live', cta: 'Shop Now', accent: '#e85d04', format: 0 },
  { badge: 'REAL REVIEWS', headline: 'Homemade-premium taste', cta: 'Learn More', accent: '#0f766e', format: 1 },
  { badge: 'STORIES', headline: 'Taste of tradition', cta: 'Swipe up', accent: '#1e3a5f', format: 2 },
  { badge: 'VIDEO', headline: 'Selling fast this weekend', cta: 'Watch', accent: '#b45309', format: 3 },
];

const FORMATS = [
  { label: 'Image', icon: ImageIcon },
  { label: 'Carousel', icon: LayoutGrid },
  { label: 'Stories', icon: Smartphone },
  { label: 'Video', icon: Clapperboard },
];

/** CSS-3D creative stack with pointer parallax */
export default function ImmersiveStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const id = window.setInterval(() => setActive((a) => (a + 1) % SLIDES.length), 3200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      setTilt({ x: ny * -14, y: nx * 18 });
    };
    const onLeave = () => setTilt({ x: 0, y: 0 });
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  const s = SLIDES[active];

  return (
    <div className="af-stage" ref={stageRef}>
      <div
        className="af-stage-world"
        style={{
          transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        }}
      >
        {/* depth layers */}
        <div className="af-layer af-layer-back" aria-hidden />
        <div className="af-layer af-layer-mid" aria-hidden />

        <div
          className={`af-creative ${s.format === 2 ? 'is-story' : ''}`}
          style={{ ['--c-accent' as string]: s.accent }}
        >
          <div className="af-creative-top">
            <span className="af-badge">{s.badge}</span>
            <span className="af-brand-pill">AdForge</span>
          </div>
          <div className="af-creative-body">
            <div className={`af-orb f${active}`} />
            <div className="af-product" />
            {s.format === 1 && (
              <div className="af-carousel-dots">
                <i className="on" />
                <i />
                <i />
              </div>
            )}
          </div>
          <div className="af-creative-foot">
            <p className="af-sub">Chana Keri · Sweet Mango · Sweet Lime</p>
            <p className="af-headline" key={s.headline}>
              {s.headline}
            </p>
            <span className="af-cta">{s.cta}</span>
          </div>
          {s.format === 3 && <div className="af-play" aria-hidden />}
        </div>

        {/* floating satellite cards */}
        <div className="af-sat af-sat-a" aria-hidden>
          <span>CPC -18%</span>
        </div>
        <div className="af-sat af-sat-b" aria-hidden>
          <span>Draft → Confirm</span>
        </div>
      </div>

      <div className="af-format-rail" role="tablist" aria-label="Creative formats">
        {FORMATS.map((f, i) => (
          <button
            key={f.label}
            type="button"
            role="tab"
            aria-selected={active === i}
            className={active === i ? 'on' : ''}
            onClick={() => setActive(i)}
          >
            <f.icon className="w-3.5 h-3.5" />
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
