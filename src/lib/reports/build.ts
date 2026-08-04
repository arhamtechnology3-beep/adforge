import { REPORT_CATALOG, type ReportResult, type ReportViewId } from './catalog';
import {
  dryRunSnapshots,
  dryRunCreatives,
  dryRunBreakdowns,
  dryRunCampaignMetrics,
  runOpsAnalysis,
} from '@/lib/ops-agent';
import type { PerformanceSnapshot, AgentRecommendation } from '@/types/database';

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function pct(n: number) {
  return `${n.toFixed(2)}%`;
}

export function buildReport(opts: {
  view: ReportViewId;
  snapshots?: PerformanceSnapshot[];
  recommendations?: AgentRecommendation[];
  forceDryRun?: boolean;
}): ReportResult {
  const catalog = REPORT_CATALOG.find((c) => c.id === opts.view);
  const title = catalog?.title || opts.view;
  const dry =
    opts.forceDryRun ||
    !opts.snapshots?.length ||
    opts.snapshots.every((s) => !s.spend);

  const snaps = dry
    ? dryRunSnapshots(14).map((r, i) => ({
        id: `dry-${i}`,
        meta_campaign_id: r.campaignId,
        date: r.date,
        cpc: r.cpc,
        cpa: r.cpa,
        ctr: r.ctr,
        spend: r.spend,
        impressions: r.impressions,
        reach: r.reach,
        clicks: r.clicks,
        cpm: r.cpm,
        frequency: r.frequency,
        purchases: r.purchases,
        add_to_cart: r.add_to_cart,
        initiate_checkout: r.initiate_checkout,
        cost_per_purchase: r.cpa,
        roas: r.roas,
        conversion_rate: r.conversion_rate,
        video_views: r.video_views,
        engagement_rate: r.engagement_rate,
        revenue: r.revenue,
        raw_insights: {},
        breakdowns: r.breakdowns || {},
      }))
    : opts.snapshots!;

  const sum = (key: keyof PerformanceSnapshot) =>
    snaps.reduce((a, s) => a + Number(s[key] || 0), 0);

  const spend = sum('spend');
  const revenue = sum('revenue');
  const purchases = sum('purchases');
  const impressions = sum('impressions');
  const clicks = sum('clicks');
  const atc = sum('add_to_cart');
  const ic = sum('initiate_checkout');
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = purchases > 0 ? spend / purchases : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

  const byDate = new Map<string, { spend: number; revenue: number; purchases: number; ctr: number; cpc: number; cpa: number; impressions: number }>();
  for (const s of snaps) {
    const cur = byDate.get(s.date) || {
      spend: 0,
      revenue: 0,
      purchases: 0,
      ctr: 0,
      cpc: 0,
      cpa: 0,
      impressions: 0,
    };
    cur.spend += Number(s.spend || 0);
    cur.revenue += Number(s.revenue || 0);
    cur.purchases += Number(s.purchases || 0);
    cur.impressions += Number(s.impressions || 0);
    cur.ctr = Number(s.ctr || cur.ctr);
    cur.cpc = Number(s.cpc || cur.cpc);
    cur.cpa = Number(s.cpa || cur.cpa);
    byDate.set(s.date, cur);
  }
  const dailySeries = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, ...v, roas: v.spend ? v.revenue / v.spend : 0 }));

  const creatives = dryRunCreatives();
  const breakdowns = snaps.find((s) => s.breakdowns && Object.keys(s.breakdowns).length)?.breakdowns || dryRunBreakdowns();
  const camps = dryRunCampaignMetrics();
  const analysis = runOpsAnalysis({ useDryRun: true });
  const chips: string[] = [];
  if (dry) chips.push('Sample data — Connect Meta for live reports');
  if (catalog?.needs?.includes('shopify')) chips.push('Needs Shopify');
  if (catalog?.needs?.includes('phase2')) chips.push('Coming in Phase 2');
  if (catalog?.needs?.includes('meta') && dry) chips.push('Needs Meta breakdowns');

  const base: ReportResult = {
    view: opts.view,
    title,
    dryRun: dry,
    kpis: [],
    chips,
  };

  switch (opts.view) {
    case 'executive':
      return {
        ...base,
        kpis: [
          { label: 'Spend', value: money(spend) },
          { label: 'Revenue', value: money(revenue) },
          { label: 'ROAS', value: `${roas.toFixed(2)}x` },
          { label: 'CPA', value: money(cpa) },
          { label: 'CTR', value: pct(ctr) },
          { label: 'Purchases', value: String(Math.round(purchases)) },
          { label: 'Health', value: roas >= 2 ? 'Good' : roas >= 1 ? 'Watch' : 'At risk' },
        ],
        series: dailySeries.map((d) => ({ date: d.date, spend: d.spend, revenue: d.revenue })),
        notes: ['Health blends ROAS and CPA vs targets when set.'],
      };

    case 'daily':
      return {
        ...base,
        kpis: [
          { label: 'Days', value: String(dailySeries.length) },
          { label: 'Spend', value: money(spend) },
        ],
        table: {
          columns: ['Date', 'Spend', 'Purchases', 'CPA', 'CTR', 'ROAS'],
          rows: dailySeries.map((d) => [
            d.date,
            Math.round(d.spend),
            Math.round(d.purchases),
            Math.round(d.cpa || (d.purchases ? d.spend / d.purchases : 0)),
            Number(d.ctr.toFixed(2)),
            Number(d.roas.toFixed(2)),
          ]),
        },
        series: dailySeries.map((d) => ({ date: d.date, spend: d.spend })),
      };

    case 'weekly':
    case 'monthly': {
      const slice = opts.view === 'weekly' ? dailySeries.slice(-7) : dailySeries;
      const sSpend = slice.reduce((a, d) => a + d.spend, 0);
      const sRev = slice.reduce((a, d) => a + d.revenue, 0);
      return {
        ...base,
        kpis: [
          { label: 'Spend', value: money(sSpend) },
          { label: 'Revenue', value: money(sRev) },
          { label: 'ROAS', value: sSpend ? `${(sRev / sSpend).toFixed(2)}x` : '—' },
          { label: 'Delta vs prior', value: dry ? '+8% spend' : '—' },
        ],
        series: slice.map((d) => ({ date: d.date, spend: d.spend, revenue: d.revenue })),
        notes: opts.view === 'weekly' ? ['WoW computed when ≥14 days of live data.'] : ['MoM when ≥60 days available.'],
      };
    }

    case 'pacing':
    case 'spend_budget':
      return {
        ...base,
        kpis: camps.map((c) => ({
          label: c.campaignName,
          value: c.budget ? `${Math.round((c.spend / c.budget) * 100)}%` : '—',
          hint: `${money(c.spend)} / ${money(c.budget || 0)}`,
        })),
        table: {
          columns: ['Campaign', 'Budget', 'Spend', 'Pacing'],
          rows: camps.map((c) => [
            c.campaignName,
            c.budget || 0,
            Math.round(c.spend),
            c.budget ? `${Math.round((c.spend / c.budget) * 100)}%` : '—',
          ]),
        },
      };

    case 'policy_actions':
    case 'audit_trail':
      return {
        ...base,
        kpis: [
          { label: 'Policy hits (sample)', value: String(analysis.recommendations.filter((r) => r.source === 'policy').length) },
          { label: 'Auto-applied', value: String(analysis.recommendations.filter((r) => r.auto_apply).length) },
        ],
        table: {
          columns: ['Severity', 'Title', 'Action'],
          rows: (opts.recommendations?.length
            ? opts.recommendations.map((r) => [r.severity, r.title, r.status])
            : analysis.recommendations
                .filter((r) => r.source === 'policy' || r.auto_apply)
                .map((r) => [r.severity, r.title, r.auto_apply ? 'auto' : 'confirm'])),
        },
      };

    case 'delivery_issues':
      return {
        ...base,
        kpis: [
          { label: 'Under-pacing', value: String(camps.filter((c) => c.budget && c.spend / c.budget < 0.4).length) },
          { label: 'Low CTR', value: String(camps.filter((c) => c.ctr < 0.6).length) },
        ],
        notes: ['Learning-phase flags appear when Meta delivery insights are connected.'],
      };

    case 'efficiency':
      return {
        ...base,
        kpis: [
          { label: 'Avg CPC', value: money(spend && clicks ? spend / clicks : 0) },
          { label: 'CTR', value: pct(ctr) },
          { label: 'CPM', value: money(impressions ? (spend / impressions) * 1000 : 0) },
        ],
        series: dailySeries.map((d) => ({ date: d.date, cpc: d.cpc, ctr: d.ctr })),
      };

    case 'cpa_trends':
      return {
        ...base,
        kpis: [{ label: 'Blended CPA', value: money(cpa) }],
        series: dailySeries.map((d) => ({
          date: d.date,
          cpa: d.purchases ? d.spend / d.purchases : d.cpa,
        })),
      };

    case 'roas':
      return {
        ...base,
        kpis: [
          { label: 'ROAS', value: `${roas.toFixed(2)}x` },
          { label: 'CVR', value: clicks ? pct((purchases / clicks) * 100) : '—' },
        ],
        series: dailySeries.map((d) => ({ date: d.date, roas: d.roas })),
      };

    case 'frequency':
      return {
        ...base,
        kpis: camps.map((c) => ({
          label: c.campaignName,
          value: c.frequency.toFixed(1),
          hint: `Reach ${c.reach.toLocaleString()}`,
        })),
      };

    case 'engagement_video':
      return {
        ...base,
        kpis: [
          { label: 'Video views', value: String(Math.round(sum('video_views'))) },
          { label: 'Engagement rate', value: pct(Number(snaps[snaps.length - 1]?.engagement_rate || 0)) },
        ],
      };

    case 'creative_leaderboard':
    case 'fatigue':
    case 'format_mix':
      return {
        ...base,
        kpis: [
          { label: 'Creatives', value: String(creatives.length) },
          { label: 'Best CTR', value: pct(Math.max(...creatives.map((c) => c.ctr))) },
        ],
        table: {
          columns: ['Creative', 'Format', 'Spend', 'CTR', 'CPC', 'CPA', 'Freq'],
          rows: creatives
            .filter((c) => (opts.view === 'fatigue' ? c.frequency >= 3 : true))
            .map((c) => [
              c.name,
              c.format,
              Math.round(c.spend),
              c.ctr,
              c.cpc,
              c.cpa ?? '—',
              c.frequency,
            ]),
        },
      };

    case 'audience':
      return {
        ...base,
        table: {
          columns: ['Audience', 'Spend', 'CPA', 'ROAS'],
          rows: (breakdowns.audience || []).map((a) => [
            a.name,
            Math.round(a.spend),
            a.cpa ?? '—',
            a.roas ?? '—',
          ]),
        },
      };

    case 'placement':
      return {
        ...base,
        table: {
          columns: ['Placement', 'Spend', 'Impressions', 'CTR'],
          rows: (breakdowns.placement || []).map((p) => [
            p.name,
            Math.round(p.spend),
            p.impressions || 0,
            p.ctr || 0,
          ]),
        },
      };

    case 'device':
      return {
        ...base,
        table: {
          columns: ['Device', 'Spend', 'CTR'],
          rows: (breakdowns.device || []).map((d) => [d.name, Math.round(d.spend), d.ctr || 0]),
        },
      };

    case 'age_gender':
      return {
        ...base,
        table: {
          columns: ['Segment', 'Spend', 'Purchases'],
          rows: [
            ...(breakdowns.age || []).map((a) => [`Age ${a.name}`, Math.round(a.spend), a.purchases || 0]),
            ...(breakdowns.gender || []).map((g) => [`Gender ${g.name}`, Math.round(g.spend), '—']),
          ],
        },
      };

    case 'geo':
      return {
        ...base,
        table: {
          columns: ['Geo', 'Spend'],
          rows: (breakdowns.geo || []).map((g) => [g.name, Math.round(g.spend)]),
        },
      };

    case 'funnel':
    case 'dropoff': {
      const stages = [
        ['Impressions', impressions],
        ['Clicks', clicks],
        ['Add to cart', atc],
        ['Initiate checkout', ic],
        ['Purchases', purchases],
      ] as const;
      const rows = stages.map((s, i) => {
        const prev = i === 0 ? s[1] : stages[i - 1][1];
        const rate = prev ? ((s[1] / prev) * 100).toFixed(1) + '%' : '—';
        return [s[0], Math.round(s[1]), rate];
      });
      return {
        ...base,
        kpis: stages.map((s) => ({ label: s[0], value: String(Math.round(s[1])) })),
        table: { columns: ['Stage', 'Count', 'Step CVR'], rows: [...rows] },
        notes:
          opts.view === 'dropoff'
            ? ['Largest leak highlighted when live funnel events are complete.']
            : undefined,
      };
    }

    case 'sku_roas':
    case 'new_returning':
    case 'aov':
      return {
        ...base,
        kpis: [
          { label: 'Purchases (Meta)', value: String(Math.round(purchases)) },
          { label: 'AOV proxy', value: purchases ? money(revenue / purchases) : '—' },
        ],
        notes: ['Shopify deep metrics unlock after store analytics connect.'],
      };

    case 'recommendations':
      return {
        ...base,
        table: {
          columns: ['Source', 'Severity', 'Title', 'Status'],
          rows: (opts.recommendations?.length
            ? opts.recommendations
            : analysis.recommendations.map((r, i) => ({
                source: r.source,
                severity: r.severity,
                title: r.title,
                status: r.auto_apply ? 'applied' : 'pending',
                id: String(i),
              }))
          ).map((r) => [r.source, r.severity, r.title, 'status' in r ? r.status : 'pending']),
        },
      };

    case 'ab_tests':
      return {
        ...base,
        kpis: [{ label: 'Active tests', value: '0' }],
        notes: ['A/B board populates when creative/audience tests launch (Phase 2).'],
      };

    case 'best_of':
      return {
        ...base,
        table: {
          columns: ['Type', 'Name', 'Metric'],
          rows: [
            ['Creative', creatives[0]?.name || '—', `CTR ${creatives[0]?.ctr}%`],
            ['Audience', breakdowns.audience?.[0]?.name || '—', `ROAS ${breakdowns.audience?.[0]?.roas}x`],
            ['Placement', breakdowns.placement?.[0]?.name || '—', money(breakdowns.placement?.[0]?.spend || 0)],
          ],
        },
        notes: analysis.recommendations.slice(0, 3).map((r) => r.title),
      };

    case 'weekly_checklist':
      return {
        ...base,
        table: {
          columns: ['Task', 'Why'],
          rows: analysis.recommendations.map((r) => [r.title, r.body.slice(0, 80)]),
        },
      };

    case 'monthly_strategy':
      return {
        ...base,
        kpis: [
          { label: 'Month spend', value: money(spend) },
          { label: 'Blended ROAS', value: `${roas.toFixed(2)}x` },
        ],
        notes: [
          'Review seasonal calendar and product winners.',
          'Plan creative refresh for fatigued ads.',
          'Confirm budget caps before scaling winners.',
        ],
      };

    default:
      return { ...base, kpis: [{ label: 'Status', value: 'Ready' }] };
  }
}
