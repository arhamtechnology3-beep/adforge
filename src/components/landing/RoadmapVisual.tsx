'use client';

import {
  Clapperboard,
  Palette,
  FlaskConical,
  Library,
  MapPin,
  Gauge,
  RefreshCw,
  Presentation,
  Scale,
  Package,
  Check,
} from 'lucide-react';

const PHASES = [
  {
    phase: 'Next',
    tone: 'next' as const,
    blurb: 'Creative depth',
    items: [
      { label: 'Real MP4 export', icon: Clapperboard },
      { label: 'Brand kit', icon: Palette },
      { label: 'A/B creative sets', icon: FlaskConical },
      { label: 'Ad Library assist', icon: Library },
    ],
  },
  {
    phase: 'Buying',
    tone: 'buy' as const,
    blurb: 'Smarter spend',
    items: [
      { label: 'India lookalikes', icon: MapPin },
      { label: 'Budget pacing', icon: Gauge },
      { label: 'Creative fatigue refresh', icon: RefreshCw },
    ],
  },
  {
    phase: 'Optimize',
    tone: 'opt' as const,
    blurb: 'Agency cadence',
    items: [
      { label: 'Weekly decks', icon: Presentation },
      { label: 'Scale / kill rules', icon: Scale },
      { label: 'ROAS per SKU', icon: Package },
    ],
  },
];

export default function RoadmapVisual() {
  return (
    <div className="af-road-visual">
      <div className="af-road-track" aria-hidden>
        <span className="af-road-dot on" />
        <span className="af-road-line" />
        <span className="af-road-dot" />
        <span className="af-road-line" />
        <span className="af-road-dot" />
      </div>
      <div className="af-road-cols">
        {PHASES.map((col) => (
          <div key={col.phase} className={`af-road-col af-road-${col.tone}`}>
            <div className="af-road-head">
              <span className="af-road-phase">{col.phase}</span>
              <span className="af-road-blurb">{col.blurb}</span>
            </div>
            <ul>
              {col.items.map((item) => (
                <li key={item.label}>
                  <span className="af-road-ico">
                    <item.icon strokeWidth={1.6} />
                  </span>
                  <span className="af-road-label">{item.label}</span>
                  <Check className="af-road-check w-3.5 h-3.5" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
