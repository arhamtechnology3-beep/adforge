'use client';

import { Check, X, Link2, Sparkles, IndianRupee, Rocket, Pause } from 'lucide-react';

const STEPS = [
  {
    n: '01',
    title: 'Connect brand',
    desc: 'Website + competitors. We learn your catalog and hooks.',
    visual: 'connect' as const,
  },
  {
    n: '02',
    title: 'Generate',
    desc: 'Copy + Image / Carousel / Stories / Video options.',
    visual: 'generate' as const,
  },
  {
    n: '03',
    title: 'Approve & draft',
    desc: 'Pick winners. Set ₹ budget. Never auto-spend.',
    visual: 'approve' as const,
  },
  {
    n: '04',
    title: 'Confirm & optimize',
    desc: 'Live on client ad account. Pause on CPA slip.',
    visual: 'launch' as const,
  },
];

function ConnectVisual() {
  return (
    <div className="af-flow-ui af-flow-connect" aria-hidden>
      <div className="af-flow-field">
        <Link2 className="w-3 h-3" />
        <span>yourbrand.myshopify.com</span>
      </div>
      <div className="af-flow-field muted">
        <span>+ competitor URLs</span>
      </div>
      <div className="af-flow-chips">
        <i>Products</i>
        <i>Angles</i>
        <i>Hooks</i>
      </div>
    </div>
  );
}

function GenerateVisual() {
  return (
    <div className="af-flow-ui af-flow-generate" aria-hidden>
      <div className="af-flow-formats">
        <span className="on">1:1</span>
        <span>Car</span>
        <span>9:16</span>
        <span>Vid</span>
      </div>
      <div className="af-flow-thumbs">
        <div className="af-flow-thumb t1">
          <Sparkles className="w-3 h-3" />
        </div>
        <div className="af-flow-thumb t2" />
        <div className="af-flow-thumb t3" />
      </div>
      <p className="af-flow-caption">10 angles · 4 formats</p>
    </div>
  );
}

function ApproveVisual() {
  return (
    <div className="af-flow-ui af-flow-approve" aria-hidden>
      <div className="af-flow-preview">
        <span className="badge">OFFER</span>
        <span className="line" />
        <span className="line short" />
      </div>
      <div className="af-flow-actions">
        <span className="ok">
          <Check className="w-3 h-3" /> Approve
        </span>
        <span className="no">
          <X className="w-3 h-3" /> Reject
        </span>
      </div>
      <div className="af-flow-budget">
        <IndianRupee className="w-3 h-3" />
        <div className="bar">
          <i style={{ width: '62%' }} />
        </div>
        <span>₹500/day</span>
      </div>
    </div>
  );
}

function LaunchVisual() {
  return (
    <div className="af-flow-ui af-flow-launch" aria-hidden>
      <div className="af-flow-status">
        <Rocket className="w-3.5 h-3.5" />
        <span>Confirm & Launch</span>
      </div>
      <div className="af-flow-chart">
        <svg viewBox="0 0 120 40" preserveAspectRatio="none">
          <path
            d="M0 28 C20 26, 30 18, 45 20 S70 30, 85 14 S110 8, 120 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
        </svg>
        <div className="af-flow-metrics">
          <span>CPA ↓</span>
          <span className="pause">
            <Pause className="w-2.5 h-2.5" /> Auto-pause
          </span>
        </div>
      </div>
    </div>
  );
}

function StepVisual({ type }: { type: (typeof STEPS)[number]['visual'] }) {
  switch (type) {
    case 'connect':
      return <ConnectVisual />;
    case 'generate':
      return <GenerateVisual />;
    case 'approve':
      return <ApproveVisual />;
    case 'launch':
      return <LaunchVisual />;
  }
}

export default function FlowVisual() {
  return (
    <ol className="af-flow">
      {STEPS.map((step, i) => (
        <li key={step.n} className="af-flow-step">
          {i < STEPS.length - 1 && <div className="af-flow-connector" aria-hidden />}
          <div className="af-flow-visual">
            <StepVisual type={step.visual} />
          </div>
          <div className="af-flow-meta">
            <span className="af-flow-n">{step.n}</span>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
