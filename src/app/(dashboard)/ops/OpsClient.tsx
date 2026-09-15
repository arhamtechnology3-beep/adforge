'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Check,
  Loader2,
  Shield,
  Activity,
  X,
  BarChart3,
} from 'lucide-react';
import type { AgentRecommendation, AgentRun } from '@/types/database';

function confirmLabel(action: string | undefined) {
  switch (action) {
    case 'pause_campaign':
      return 'Confirm pause';
    case 'update_budget':
      return 'Confirm budget';
    case 'check_pixel':
    case 'review_landing':
    case 'review_funnel':
    case 'review_budget':
    case 'review_delivery':
    case 'refresh_creatives':
    case 'hold':
    case 'wait_learning':
      return 'Acknowledge';
    default:
      return 'Confirm';
  }
}

function splitBody(body: string) {
  const parts = {
    summary: body,
    what: '',
    why: '',
    confirmDoes: '',
    recommend: '',
  };
  const markers: Array<[keyof typeof parts, string]> = [
    ['what', 'What this means:'],
    ['why', 'Why it matters:'],
    ['confirmDoes', 'If you Confirm:'],
    ['recommend', 'Suggested decision:'],
  ];
  const working = body;
  for (let i = 0; i < markers.length; i++) {
    const [key, label] = markers[i];
    const idx = working.indexOf(label);
    if (idx < 0) continue;
    if (i === 0 || parts.summary === body) {
      parts.summary = working.slice(0, idx).trim();
    }
    const nextIdx = markers.slice(i + 1).reduce((found, [, nextLabel]) => {
      if (found >= 0) return found;
      const n = working.indexOf(nextLabel, idx + label.length);
      return n;
    }, -1);
    const end = nextIdx >= 0 ? nextIdx : working.length;
    parts[key] = working.slice(idx + label.length, end).trim();
  }
  return parts;
}

export default function OpsClient() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'performance' | 'policy'>(
    searchParams.get('tab') === 'policy' ? 'policy' : 'performance'
  );
  const [recs, setRecs] = useState<AgentRecommendation[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/ops/recommendations?status=all');
    const data = await res.json();
    setRecs(data.recommendations || []);
    setRuns(data.runs || []);
    setDryRun(!!data.dryRun);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = recs.filter((r) =>
    tab === 'policy' ? r.source === 'policy' : r.source === 'performance'
  );

  async function confirm(rec: AgentRecommendation, decision: 'approve' | 'reject') {
    setActing(rec.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/ops/recommendations/${rec.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          recommendation: {
            source: rec.source,
            type: rec.type,
            severity: rec.severity,
            title: rec.title,
            body: rec.body,
            proposed_action: rec.proposed_action,
            meta_campaign_id: rec.meta_campaign_id,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || data.detail || 'Confirm failed');
        return;
      }
      setMessage(
        decision === 'reject'
          ? 'Rejected.'
          : data.message || (data.meta_changed ? 'Applied on Meta.' : 'Acknowledged.')
      );
      await load();
    } catch {
      setMessage('Confirm failed — check connection and try again.');
    } finally {
      setActing(null);
    }
  }

  const severityColor: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-amber-100 text-amber-800',
    info: 'bg-sky-100 text-sky-800',
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ops Agent</h1>
          <p className="text-muted mt-1">
            Research-backed Meta rules (Ops v2): learning-phase protection, 3× kill rule,
            scale winners +20%, Pixel/CAPI gaps. Read the decision detail before Confirm.{' '}
            <Link href="/optimize" className="underline">
              Open Optimize
            </Link>{' '}
            for Health Score.
          </p>
          {dryRun && (
            <p className="text-xs mt-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 inline-block">
              Showing sample recommendations until Meta insights sync into Performance.
            </p>
          )}
          {message && (
            <p className="text-xs mt-2 font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 inline-block">
              {message}
            </p>
          )}
        </div>
        <Link href="/reports" className="btn-secondary text-sm inline-flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4" /> Reports Hub
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          className={`px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${
            tab === 'performance' ? 'bg-primary text-white' : 'bg-gray-100 text-muted'
          }`}
          onClick={() => setTab('performance')}
        >
          <Activity className="w-4 h-4" /> Performance
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${
            tab === 'policy' ? 'bg-primary text-white' : 'bg-gray-100 text-muted'
          }`}
          onClick={() => setTab('policy')}
        >
          <Shield className="w-4 h-4" /> Policy Guard
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="card text-center py-12 text-muted space-y-2">
              <p>No {tab} items right now.</p>
              <p className="text-xs max-w-md mx-auto">
                {tab === 'performance'
                  ? 'Ops v2 found no open actions (or you already acknowledged them). Open Optimize for Health Score.'
                  : 'No policy hits logged. Policy Guard scans copy + Meta ad effective_status on Ops Monitor runs.'}
              </p>
            </div>
          ) : (
            filtered.map((r) => {
              const action = String(r.proposed_action?.action || '');
              const detail = splitBody(r.body || '');
              const what = String(r.proposed_action?.what || detail.what || '');
              const why = String(r.proposed_action?.why || detail.why || '');
              const confirmDoes = String(
                r.proposed_action?.confirmDoes || detail.confirmDoes || ''
              );
              const recommend = String(
                r.proposed_action?.recommend || detail.recommend || ''
              );
              return (
                <article key={r.id} className="card space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${severityColor[r.severity] || 'bg-gray-100'}`}
                        >
                          {r.severity}
                        </span>
                        <span className="text-xs text-muted">{r.type}</span>
                        <span className="text-xs font-medium text-muted uppercase">{r.status}</span>
                      </div>
                      <h3 className="font-semibold">{r.title}</h3>
                      <p className="text-sm text-muted mt-1 whitespace-pre-line">
                        {detail.summary || r.body}
                      </p>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          className="btn-primary text-sm inline-flex items-center gap-1"
                          disabled={acting === r.id}
                          onClick={() => confirm(r, 'approve')}
                        >
                          {acting === r.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          {confirmLabel(action)}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-sm inline-flex items-center gap-1"
                          disabled={acting === r.id}
                          onClick={() => confirm(r, 'reject')}
                        >
                          <X className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {(what || why || confirmDoes || recommend) && (
                    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm space-y-2">
                      {what && (
                        <p>
                          <span className="font-semibold text-gray-800">What this means: </span>
                          <span className="text-muted">{what}</span>
                        </p>
                      )}
                      {why && (
                        <p>
                          <span className="font-semibold text-gray-800">Why it matters: </span>
                          <span className="text-muted">{why}</span>
                        </p>
                      )}
                      {confirmDoes && (
                        <p>
                          <span className="font-semibold text-gray-800">
                            {action === 'pause_campaign' || action === 'update_budget'
                              ? 'If you Confirm:'
                              : 'If you Acknowledge:'}{' '}
                          </span>
                          <span className="text-muted">{confirmDoes}</span>
                        </p>
                      )}
                      {recommend && (
                        <p>
                          <span className="font-semibold text-primary">Suggested decision: </span>
                          <span className="text-muted">{recommend}</span>
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {runs.length > 0 && (
        <div className="mt-10">
          <h2 className="font-semibold mb-3">Recent agent runs</h2>
          <ul className="space-y-2 text-sm">
            {runs.slice(0, 8).map((run) => (
              <li key={run.id} className="flex justify-between gap-4 border-b border-gray-100 py-2">
                <span className="capitalize text-muted">{run.slot}</span>
                <span className="text-muted">{new Date(run.created_at).toLocaleString('en-IN')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
