import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runOpsAnalysis } from '@/lib/ops-agent';
import { metricsFromSnapshots } from '@/lib/reports/build';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source'); // performance | policy | all
  const status = searchParams.get('status') || 'pending';

  const { data: profile } = await supabase
    .from('users')
    .select('cpa_target, roas_target, daily_budget_cap')
    .eq('id', userId)
    .maybeSingle();

  const { data: storedRecs, error } = await supabase
    .from('agent_recommendations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: runs } = await supabase
    .from('agent_runs')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: campaigns } = await supabase
    .from('meta_campaigns')
    .select('id, name, budget, status')
    .eq('user_id', userId);
  const campIds = (campaigns || []).map((c) => c.id);
  let snapshots: import('@/types/database').PerformanceSnapshot[] = [];
  if (campIds.length) {
    const { data } = await supabase
      .from('performance_snapshots')
      .select('*')
      .in('meta_campaign_id', campIds)
      .order('date', { ascending: true });
    snapshots = (data || []) as import('@/types/database').PerformanceSnapshot[];
  }

  const liveMetrics = metricsFromSnapshots(
    snapshots,
    (campaigns || []).map((c) => ({
      id: c.id,
      name: c.name,
      budget: c.budget != null ? Number(c.budget) : null,
      status: c.status,
    }))
  );
  const hasLive = liveMetrics.length > 0 && liveMetrics.some((m) => m.spend > 0);

  function liveRecRows() {
    const analysis = runOpsAnalysis({
      metrics: liveMetrics,
      useDryRun: !hasLive,
      targets: {
        cpaTarget: profile?.cpa_target ?? 100,
        roasTarget: profile?.roas_target ?? 2,
        dailyBudgetCap: profile?.daily_budget_cap ?? null,
      },
    });
    return analysis.recommendations
      .filter((r) => !r.auto_apply)
      .map((r, i) => ({
        id: `live-${i}`,
        user_id: userId,
        meta_campaign_id: r.meta_campaign_id || null,
        source: r.source,
        type: r.type,
        severity: r.severity,
        title: r.title,
        body: r.body,
        proposed_action: r.proposed_action,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      }));
  }

  const stored = error ? [] : storedRecs || [];
  const resolvedKeys = new Set(
    stored
      .filter((r) => r.status === 'applied' || r.status === 'rejected')
      .map((r) => `${r.type}:${r.meta_campaign_id || ''}`)
  );

  let live = hasLive
    ? liveRecRows().filter((r) => !resolvedKeys.has(`${r.type}:${r.meta_campaign_id || ''}`))
    : [];

  if (error && !hasLive) {
    const analysis = runOpsAnalysis({ useDryRun: true });
    live = analysis.recommendations
      .filter((r) => !r.auto_apply)
      .map((r, i) => ({
        id: `dry-${i}`,
        user_id: userId,
        meta_campaign_id: r.meta_campaign_id || null,
        source: r.source,
        type: r.type,
        severity: r.severity,
        title: r.title,
        body: r.body,
        proposed_action: r.proposed_action,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      }));
  }

  let list = [
    ...stored.filter((r) => (status === 'all' ? true : r.status === status)),
    ...(status === 'pending' || status === 'all' ? live : []),
  ];

  if (source === 'performance' || source === 'policy') {
    list = list.filter((r) => r.source === source);
  }

  // Prefer DB pending over duplicate live type+campaign
  const seen = new Set<string>();
  list = list.filter((r) => {
    const key = `${r.status}:${r.type}:${r.meta_campaign_id || ''}`;
    if (seen.has(key) && String(r.id).startsWith('live-')) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({
    dryRun: list.some((r) => String(r.id).startsWith('dry-')),
    liveComputed: list.some((r) => String(r.id).startsWith('live-')),
    recommendations: list,
    runs: runs || [],
  });
}
