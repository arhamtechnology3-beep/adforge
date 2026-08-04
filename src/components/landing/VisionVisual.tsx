'use client';

import {
  Users,
  PenLine,
  Palette,
  Target,
  LineChart,
  PauseCircle,
  Sparkles,
} from 'lucide-react';

const ROLES = [
  { label: 'Strategist', icon: Users, pos: 'nw' },
  { label: 'Copywriter', icon: PenLine, pos: 'n' },
  { label: 'Creative', icon: Palette, pos: 'ne' },
  { label: 'Media buyer', icon: Target, pos: 'sw' },
  { label: 'Analyst', icon: LineChart, pos: 's' },
  { label: 'Optimizer', icon: PauseCircle, pos: 'se' },
];

/** Agency roles collapse into one AdForge hub */
export default function VisionVisual() {
  return (
    <div className="af-vision-visual" aria-hidden>
      <div className="af-vision-orbit">
        {ROLES.map((r) => (
          <div key={r.label} className={`af-vision-node af-vision-${r.pos}`}>
            <r.icon strokeWidth={1.6} />
            <span>{r.label}</span>
          </div>
        ))}
        <div className="af-vision-hub">
          <Sparkles strokeWidth={1.6} />
          <strong>AdForge</strong>
          <em>You approve · You confirm</em>
        </div>
        <svg className="af-vision-lines" viewBox="0 0 400 280" preserveAspectRatio="xMidYMid meet">
          <path d="M80 56 L200 140" />
          <path d="M200 36 L200 140" />
          <path d="M320 56 L200 140" />
          <path d="M80 224 L200 140" />
          <path d="M200 244 L200 140" />
          <path d="M320 224 L200 140" />
        </svg>
      </div>
      <p className="af-vision-caption">Six roles → one product. Founder stays in the loop.</p>
    </div>
  );
}
