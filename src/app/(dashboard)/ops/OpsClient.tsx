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

  async function confirm(id: string, decision: 'approve' | 'reject') {
    setActing(id);
    await fetch(`/api/ops/recommendations/${id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    await load();
    setActing(null);
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
            Research-backed Meta rules: learning-phase protection, pause losers, scale winners
            +15%, Pixel/conversion gaps. Live changes email you a detailed report + screenshot.
          </p>
          {dryRun && (
            <p className="text-xs mt-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 inline-block">
              Showing sample recommendations until Meta is connected and migration 006 is applied.
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
            <div className="card text-center py-12 text-muted">
              No {tab} items right now.
            </div>
          ) : (
            filtered.map((r) => (
              <article key={r.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${severityColor[r.severity] || 'bg-gray-100'}`}>
                        {r.severity}
                      </span>
                      <span className="text-xs text-muted">{r.type}</span>
                      <span className="text-xs font-medium text-muted uppercase">{r.status}</span>
                    </div>
                    <h3 className="font-semibold">{r.title}</h3>
                    <p className="text-sm text-muted mt-1">{r.body}</p>
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        className="btn-primary text-sm inline-flex items-center gap-1"
                        disabled={acting === r.id}
                        onClick={() => confirm(r.id, 'approve')}
                      >
                        {acting === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-sm inline-flex items-center gap-1"
                        disabled={acting === r.id}
                        onClick={() => confirm(r.id, 'reject')}
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))
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
