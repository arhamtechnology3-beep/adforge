'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { BarChart3, Loader2 } from 'lucide-react';
import type { MetaCampaign, PerformanceSnapshot } from '@/types/database';
import { formatCurrency } from '@/lib/utils';

function getStatusColor(cpa: number | null, target: number | null): string {
  if (!cpa || !target) return 'bg-gray-100 text-muted';
  const ratio = cpa / target;
  if (ratio <= 1) return 'bg-green-100 text-green-700';
  if (ratio <= 1.5) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

export default function PerformanceClient() {
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('campaign'));
  const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([]);
  const [cpaTarget, setCpaTarget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/campaigns/launch')
      .then((r) => r.json())
      .then((data) => {
        const active = (data.campaigns || []).filter(
          (c: MetaCampaign) => c.status === 'active' || c.status === 'paused'
        );
        setCampaigns(active);
        if (!selectedId && active.length > 0) setSelectedId(active[0].id);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/performance/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        setSnapshots(data.snapshots || []);
        setCpaTarget(data.cpaTarget);
      });
  }, [selectedId]);

  const chartData = snapshots.map((s) => ({
    date: new Date(s.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    spend: s.spend || 0,
    cpc: s.cpc || 0,
    cpa: s.cpa || 0,
    ctr: s.ctr || 0,
  }));

  const latest = snapshots[snapshots.length - 1];

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Performance</h1>
        <p className="text-muted mt-1">Track campaign metrics and CPA health</p>
      </div>

      {campaigns.length === 0 ? (
        <div className="card text-center py-12">
          <BarChart3 className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted">No active campaigns to track. Launch a campaign first.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-6 overflow-x-auto">
            {campaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedId === c.id ? 'bg-primary text-white' : 'bg-gray-100 text-muted hover:bg-gray-200'
                }`}
              >
                {c.objective || 'Campaign'}
              </button>
            ))}
          </div>

          {latest && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Spend', value: formatCurrency(latest.spend || 0) },
                { label: 'CPC', value: formatCurrency(latest.cpc || 0) },
                { label: 'CPA', value: latest.cpa ? formatCurrency(latest.cpa) : '—', status: true },
                { label: 'CTR', value: `${(latest.ctr || 0).toFixed(2)}%` },
              ].map((stat) => (
                <div key={stat.label} className="card">
                  <p className="text-sm text-muted">{stat.label}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-2xl font-bold">{stat.value}</p>
                    {stat.status && latest.cpa && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(latest.cpa, cpaTarget)}`}>
                        {cpaTarget ? `Target: ${formatCurrency(cpaTarget)}` : 'No target'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {chartData.length > 0 ? (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-semibold mb-4">Spend Over Time</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="spend" stroke="#6c3ce0" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <h3 className="font-semibold mb-4">CPC Over Time</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="cpc" stroke="#f97316" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="card text-center py-8 text-muted text-sm">
              Performance data will appear after the daily sync job runs.
            </div>
          )}

          <div className="card mt-6">
            <h3 className="font-semibold mb-4">All Campaigns</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 font-medium text-muted">Campaign</th>
                    <th className="text-left py-2 font-medium text-muted">Status</th>
                    <th className="text-left py-2 font-medium text-muted">Budget</th>
                    <th className="text-left py-2 font-medium text-muted">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3">{c.objective}</td>
                      <td className="py-3 capitalize">{c.status}</td>
                      <td className="py-3">{formatCurrency(c.budget || 0)}/day</td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(latest?.cpa || null, cpaTarget)}`}>
                          {c.status === 'active' ? 'Monitoring' : c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
