'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity,
  BarChart3,
  FlaskConical,
  Gauge,
  Loader2,
  Shield,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

type SuiteResponse = {
  dryRun?: boolean;
  brandName?: string | null;
  health?: {
    score: number;
    grade: string;
    pillars: Record<string, { score: number; weight: number }>;
    quickWins: Array<{ id: string; title: string; evidence: string; recommendation?: string }>;
    killList: Array<{ name: string; reason: string; metric: string }>;
    scaleList: Array<{ name: string; reason: string; nextBudget?: number }>;
  };
  tracking?: { score: number; grade: string; checklist: Array<{ label: string; ok: boolean }>; issues: Array<{ title: string; detail: string }> };
  diversity?: { diversityScore: number; formatCount: number; conceptCount: number; recommendations: string[] };
  budget?: { recommendedModel: string; biddingStrategy: string; notes: string[]; perCampaign: Array<{ name: string; action: string; rationale: string }> };
  ppc?: { breakEvenCpa: number; targetCpa: number; targetRoas: number; notes: string[] };
  attribution?: { score: number; recommendedWindow: string; recommendations: string[] };
  audiences?: { lookalikes: Array<{ name: string; ready: boolean; rationale: string }>; notes: string[] };
  brandDna?: { voice: string; tone_keywords: string[]; messaging_pillars: string[]; color_palette: string[] };
  photoshoot?: { styles: Array<{ id: string; name: string; prompt: string }> };
  killScale?: { killList: unknown[]; scaleList: unknown[] };
};

export default function OptimizeClient() {
  const [data, setData] = useState<SuiteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [abResult, setAbResult] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/optimize');
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createAbPlan() {
    setActing(true);
    const res = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ab_plan',
        name: 'Hook A/B',
        variable: 'creative',
        control: 'Current top creative',
        variant: 'New UGC hook',
        expectedLiftPct: 20,
        baselineConversionRate: 0.02,
        dailyVisitors: 800,
        primaryKpi: 'CPA',
      }),
    });
    const json = await res.json();
    setAbResult(
      json.plan
        ? `${json.plan.hypothesisStatement} · n=${json.plan.sampleSizePerArm}/arm · ~${json.plan.estimatedDays ?? '?'} days`
        : json.error || 'Failed'
    );
    setActing(false);
  }

  if (loading) {
    return (
      <div className="p-8 text-muted inline-flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading Optimize suite…
      </div>
    );
  }

  const h = data?.health;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Optimize</h1>
          <p className="text-muted mt-1 max-w-2xl">
            Health Score, Ops v2 kill/scale, creative diversity, Pixel/CAPI tracking, budget & PPC math,
            landing & A/B planner, attribution, lookalikes, brand DNA, and audit report.
          </p>
          {data?.dryRun && (
            <p className="text-xs mt-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 inline-block">
              Sample account until Meta insights sync into Performance.
            </p>
          )}
          {!data?.dryRun && data?.brandName && (
            <p className="text-xs mt-2 text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 inline-block">
              Live · {data.brandName}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <a href="/api/optimize?view=audit" target="_blank" rel="noreferrer" className="btn-secondary text-sm">
            Audit HTML / PDF
          </a>
          <Link href="/ops" className="btn-secondary text-sm inline-flex items-center gap-1.5">
            <Shield className="w-4 h-4" /> Ops Agent
          </Link>
        </div>
      </div>

      {/* Health */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 mb-6">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-sm text-muted flex items-center gap-1.5">
              <Gauge className="w-4 h-4" /> Meta Ads Health Score
            </div>
            <div className="text-5xl font-extrabold tracking-tight mt-1">{h?.score ?? '—'}</div>
            <div className="mt-2 inline-flex rounded-lg bg-primary text-white text-sm font-semibold px-3 py-1">
              Grade {h?.grade || '—'}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
            {h &&
              Object.entries(h.pillars).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-gray-50 p-3">
                  <div className="text-xs uppercase text-muted">{k}</div>
                  <div className="text-2xl font-bold">{v.score}</div>
                  <div className="text-xs text-muted">{Math.round(v.weight * 100)}% weight</div>
                </div>
              ))}
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4" /> Quick wins
          </h2>
          <ul className="space-y-2 text-sm">
            {(h?.quickWins || []).slice(0, 6).map((w) => (
              <li key={w.id} className="border-b border-gray-100 pb-2">
                <span className="font-medium">{w.id} {w.title}</span>
                <div className="text-muted">{w.evidence}</div>
                {w.recommendation && <div className="text-primary text-xs mt-0.5">{w.recommendation}</div>}
              </li>
            ))}
            {!h?.quickWins?.length && <li className="text-muted">No critical gaps</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold mb-3">Kill / Scale</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs font-semibold text-red-700 mb-1">Kill list</div>
              <ul className="space-y-1">
                {(h?.killList || []).map((k) => (
                  <li key={k.name}>
                    {k.name} — {k.reason}
                  </li>
                ))}
                {!h?.killList?.length && <li className="text-muted">None</li>}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-emerald-700 mb-1">Scale list</div>
              <ul className="space-y-1">
                {(h?.scaleList || []).map((k) => (
                  <li key={k.name}>
                    {k.name}
                    {k.nextBudget != null ? ` → ₹${k.nextBudget}` : ''}
                  </li>
                ))}
                {!h?.scaleList?.length && <li className="text-muted">None</li>}
              </ul>
            </div>
          </div>
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card title="Tracking" icon={<Target className="w-4 h-4" />}>
          <p className="text-2xl font-bold mb-2">
            {data?.tracking?.score} <span className="text-sm font-medium">({data?.tracking?.grade})</span>
          </p>
          <ul className="text-sm space-y-1">
            {(data?.tracking?.checklist || []).map((c) => (
              <li key={c.label} className={c.ok ? 'text-emerald-700' : 'text-amber-700'}>
                {c.ok ? '✓' : '○'} {c.label}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Creative diversity" icon={<Sparkles className="w-4 h-4" />}>
          <p className="text-2xl font-bold mb-1">{data?.diversity?.diversityScore}</p>
          <p className="text-sm text-muted mb-2">
            {data?.diversity?.formatCount} formats · {data?.diversity?.conceptCount} concepts
          </p>
          <ul className="text-sm space-y-1">
            {(data?.diversity?.recommendations || []).slice(0, 3).map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </Card>

        <Card title="PPC targets" icon={<BarChart3 className="w-4 h-4" />}>
          <p className="text-sm">
            Break-even CPA <strong>₹{data?.ppc?.breakEvenCpa?.toFixed(0)}</strong>
          </p>
          <p className="text-sm">
            Target CPA <strong>₹{data?.ppc?.targetCpa?.toFixed(0)}</strong> · ROAS{' '}
            <strong>{data?.ppc?.targetRoas?.toFixed(2)}x</strong>
          </p>
          <ul className="text-xs text-muted mt-2 space-y-1">
            {(data?.ppc?.notes || []).slice(0, 3).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card title="Budget advisor" icon={<Activity className="w-4 h-4" />}>
          <p className="text-sm mb-2">
            Model <strong>{data?.budget?.recommendedModel}</strong> · Bid{' '}
            <strong>{data?.budget?.biddingStrategy}</strong>
          </p>
          <ul className="text-sm space-y-1">
            {(data?.budget?.perCampaign || []).map((c) => (
              <li key={c.name}>
                <span className="font-medium uppercase text-xs mr-1">{c.action}</span>
                {c.name} — {c.rationale}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Audiences / Lookalikes" icon={<Users className="w-4 h-4" />}>
          <ul className="text-sm space-y-1">
            {(data?.audiences?.lookalikes || []).map((l) => (
              <li key={l.name}>
                {l.name} {l.ready ? '✓' : '(needs seed)'} — {l.rationale}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card title="Brand DNA" icon={<Sparkles className="w-4 h-4" />}>
          <p className="text-sm">
            Voice <strong>{data?.brandDna?.voice}</strong>
          </p>
          <p className="text-xs text-muted mt-1">{data?.brandDna?.tone_keywords?.join(' · ')}</p>
          <div className="flex gap-2 mt-3">
            {(data?.brandDna?.color_palette || []).map((c) => (
              <span
                key={c}
                className="w-8 h-8 rounded-lg border border-gray-200"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </Card>

        <Card title="A/B test planner" icon={<FlaskConical className="w-4 h-4" />}>
          <p className="text-sm text-muted mb-3">
            Designs Meta Experiments with sample size & duration.
          </p>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={acting}
            onClick={createAbPlan}
          >
            {acting ? 'Planning…' : 'Plan creative A/B'}
          </button>
          {abResult && <p className="text-xs mt-3 text-muted">{abResult}</p>}
        </Card>
      </div>

      <Card title="Photoshoot styles" icon={<Sparkles className="w-4 h-4" />}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(data?.photoshoot?.styles || []).map((s) => (
            <div key={s.id} className="rounded-xl bg-gray-50 p-3 text-sm">
              <div className="font-semibold">{s.name}</div>
              <p className="text-xs text-muted mt-1 line-clamp-4">{s.prompt}</p>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-xs text-muted mt-6">
        Attribution window preference: {data?.attribution?.recommendedWindow || '—'} (score{' '}
        {data?.attribution?.score ?? '—'})
      </p>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="font-semibold flex items-center gap-2 mb-3">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}
