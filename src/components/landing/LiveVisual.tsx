'use client';

import {
  LayoutGrid,
  Sparkles,
  Rocket,
  BarChart3,
  Check,
  IndianRupee,
} from 'lucide-react';

const FEATURES = [
  {
    title: 'Multi-format studio',
    desc: 'Feed, Carousel, Stories, Video — approve what wins.',
    icon: LayoutGrid,
    visual: 'formats' as const,
  },
  {
    title: 'Brand-aware copy',
    desc: 'Scrapes Shopify + competitors into Meta-ready text.',
    icon: Sparkles,
    visual: 'copy' as const,
  },
  {
    title: 'Confirm-to-launch',
    desc: 'Drafts first. Live only when you confirm. Client pays Meta.',
    icon: Rocket,
    visual: 'launch' as const,
  },
  {
    title: 'Performance pulse',
    desc: 'Spend, CPC, CPA, CTR — WhatsApp when you want numbers.',
    icon: BarChart3,
    visual: 'pulse' as const,
  },
];

function FormatsMock() {
  return (
    <div className="af-live-mock af-live-formats">
      <div className="af-live-tabs">
        <span className="on">1:1</span>
        <span>Car</span>
        <span>9:16</span>
        <span>Vid</span>
      </div>
      <div className="af-live-thumbs">
        <div className="t square">
          <i />
          <Check className="w-3 h-3" />
        </div>
        <div className="t tall" />
        <div className="t wide" />
      </div>
    </div>
  );
}

function CopyMock() {
  return (
    <div className="af-live-mock af-live-copy">
      <div className="af-live-scrape">
        <span className="url">yourbrand.myshopify.com</span>
        <span className="pulse" />
      </div>
      <div className="af-live-lines">
        <p className="angle">Angle 03 · Urgency</p>
        <p className="body">Festive jars selling out — ship before the weekend rush.</p>
        <p className="meta">Primary text · 125 chars</p>
      </div>
    </div>
  );
}

function LaunchMock() {
  return (
    <div className="af-live-mock af-live-launch">
      <div className="af-live-draft">
        <span className="pill">DRAFT</span>
        <span>Traffic · ₹500/day</span>
      </div>
      <div className="af-live-budget">
        <IndianRupee className="w-3 h-3" />
        <div className="track">
          <i />
        </div>
      </div>
      <button type="button" tabIndex={-1} className="af-live-confirm">
        <Rocket className="w-3.5 h-3.5" /> Confirm & Launch
      </button>
    </div>
  );
}

function PulseMock() {
  return (
    <div className="af-live-mock af-live-pulse">
      <div className="af-live-kpis">
        <span>
          <b>₹12.4k</b> Spend
        </span>
        <span>
          <b>₹86</b> CPA
        </span>
        <span>
          <b>2.1%</b> CTR
        </span>
      </div>
      <svg viewBox="0 0 160 48" preserveAspectRatio="none" className="af-live-spark">
        <path
          d="M0 36 C20 34, 28 22, 48 24 S78 40, 98 18 S130 10, 160 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
      </svg>
      <p className="af-live-wa">WhatsApp report · Mon 9am</p>
    </div>
  );
}

function FeatureMock({ type }: { type: (typeof FEATURES)[number]['visual'] }) {
  switch (type) {
    case 'formats':
      return <FormatsMock />;
    case 'copy':
      return <CopyMock />;
    case 'launch':
      return <LaunchMock />;
    case 'pulse':
      return <PulseMock />;
  }
}

export default function LiveVisual() {
  return (
    <div className="af-live-visual">
      {FEATURES.map((f) => (
        <article key={f.title} className="af-live-card">
          <div className="af-live-card-visual">
            <FeatureMock type={f.visual} />
          </div>
          <div className="af-live-card-meta">
            <f.icon strokeWidth={1.6} />
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
