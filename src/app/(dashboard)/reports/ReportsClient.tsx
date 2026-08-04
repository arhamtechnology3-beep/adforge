'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Download,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ReportCatalogItem, ReportResult, ReportViewId } from '@/lib/reports/catalog';

const GROUPS = [
  'Overview',
  'Delivery',
  'Efficiency',
  'Creative',
  'Audience',
  'Funnel',
  'Agent',
  'Strategy',
] as const;

export default function ReportsClient() {
  const searchParams = useSearchParams();
  const initial = (searchParams.get('view') as ReportViewId) || 'executive';
  const [view, setView] = useState<ReportViewId>(initial);
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?view=${view}`)
      .then((r) => r.json())
      .then((data) => {
        setCatalog(data.catalog || []);
        setReport(data.report || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [view]);

  const grouped = useMemo(() => {
    const map: Record<string, ReportCatalogItem[]> = {};
    for (const g of GROUPS) map[g] = [];
    for (const item of catalog) {
      (map[item.group] ||= []).push(item);
    }
    return map;
  }, [catalog]);

  function downloadCsv() {
    if (!report?.table) return;
    const lines = [
      report.table.columns.join(','),
      ...report.table.rows.map((row) =>
        row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adforge-${report.view}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="lg:w-64 shrink-0 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted text-sm mt-1">Digital marketing report library</p>
        </div>
        <nav className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {GROUPS.map((g) => (
            <div key={g}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">{g}</p>
              <ul className="space-y-0.5">
                {(grouped[g] || []).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setView(item.id)}
                      className={`w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
                        view === item.id
                          ? 'bg-primary text-white'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <Link href="/ops" className="text-sm text-primary font-medium inline-flex items-center gap-1">
          <ShieldAlert className="w-4 h-4" /> Ops Agent →
        </Link>
      </aside>

      <main className="flex-1 min-w-0">
        {loading || !report ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{report.title}</h2>
                {report.chips?.map((c) => (
                  <span
                    key={c}
                    className="inline-block mt-2 mr-2 text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                  >
                    {c}
                  </span>
                ))}
              </div>
              {report.table && (
                <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1.5" onClick={downloadCsv}>
                  <Download className="w-4 h-4" /> CSV
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {report.kpis.map((k) => (
                <div key={k.label} className="card !p-4">
                  <p className="text-xs text-muted font-medium">{k.label}</p>
                  <p className="text-lg font-bold mt-1">{k.value}</p>
                  {k.hint && <p className="text-xs text-muted mt-0.5">{k.hint}</p>}
                </div>
              ))}
            </div>

            {report.series && report.series.length > 0 && (
              <div className="card h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    {'spend' in (report.series[0] || {}) && (
                      <Line type="monotone" dataKey="spend" stroke="#e85d04" strokeWidth={2} dot={false} />
                    )}
                    {'revenue' in (report.series[0] || {}) && (
                      <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} dot={false} />
                    )}
                    {'cpc' in (report.series[0] || {}) && (
                      <Line type="monotone" dataKey="cpc" stroke="#1e3a5f" strokeWidth={2} dot={false} />
                    )}
                    {'ctr' in (report.series[0] || {}) && (
                      <Line type="monotone" dataKey="ctr" stroke="#7c3aed" strokeWidth={2} dot={false} />
                    )}
                    {'cpa' in (report.series[0] || {}) && (
                      <Line type="monotone" dataKey="cpa" stroke="#b45309" strokeWidth={2} dot={false} />
                    )}
                    {'roas' in (report.series[0] || {}) && (
                      <Line type="monotone" dataKey="roas" stroke="#0f766e" strokeWidth={2} dot={false} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {report.table && (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted">
                      {report.table.columns.map((c) => (
                        <th key={c} className="py-2 pr-4 font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.table.rows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        {row.map((cell, j) => (
                          <td key={j} className="py-2.5 pr-4">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {report.notes?.length ? (
              <ul className="text-sm text-muted space-y-1">
                {report.notes.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
            ) : null}

            {!report.kpis.length && !report.table && (
              <div className="card text-center py-12 text-muted">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No data for this view yet.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
