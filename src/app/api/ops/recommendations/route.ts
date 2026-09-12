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

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source'); // performance | policy | all
  const status = searchParams.get('status') || 'pending';

  const { data: profile } = await supabase
    .from('users')
    .select('cpa_target, roas_target, daily_budget_cap')
    .eq('id', user.id)
    .maybeSingle();

  let query = supabase
    .from('agent_recommendations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (status !== 'all') query = query.eq('status', status);
  if (source === 'performance' || source === 'policy') query = query.eq('source', source);

  const { data: recommendations, error } = await query;

  const { data: runs } = await supabase
    .from('agent_runs')
    .select('*')
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(20);

  // Live metrics from synced snapshots (same path as Reports)
  const { data: campaigns } = await supabase
    .from('meta_campaigns')
    .select('id, name, budget, status')
    .eq('user_id', user.id);
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
      useDryRun: false,
      targets: {
        cpaTarget: profile?.cpa_target ?? 100,
        roasTarget: profile?.roas_target ?? 2,
        dailyBudgetCap: profile?.daily_budget_cap ?? null,
      },
    });
    return analysis.recommendations.map((r, i) => ({
      id: `live-${i}`,
      user_id: user.id,
      meta_campaign_id: r.meta_campaign_id || null,
      source: r.source,
      type: r.type,
      severity: r.severity,
      title: r.title,
      body: r.body,
      proposed_action: r.proposed_action,
      status: (r.auto_apply ? 'applied' : 'pending') as const,
      created_at: new Date().toISOString(),
      resolved_at: r.auto_apply ? new Date().toISOString() : null,
    }));
  }

  if (error) {
    // Table missing — prefer live metrics over demo fixtures when we have spend
    if (hasLive) {
      let list = liveRecRows();
      if (status !== 'all') list = list.filter((r) => r.status === status);
      if (source === 'performance' || source === 'policy') {
        list = list.filter((r) => r.source === source);
      }
      return NextResponse.json({
        dryRun: false,
        liveComputed: true,
        recommendations: list,
        runs: [],
      });
    }
    const analysis = runOpsAnalysis({ useDryRun: true });
    return NextResponse.json({
      dryRun: true,
      recommendations: analysis.recommendations.map((r, i) => ({
        id: `dry-${i}`,
        user_id: user.id,
        meta_campaign_id: r.meta_campaign_id || null,
        source: r.source,
        type: r.type,
        severity: r.severity,
        title: r.title,
        body: r.body,
        proposed_action: r.proposed_action,
        status: r.auto_apply ? 'applied' : 'pending',
        created_at: new Date().toISOString(),
        resolved_at: r.auto_apply ? new Date().toISOString() : null,
      })),
      runs: [],
    });
  }

  let list = recommendations || [];
  let dryRun = false;
  let liveComputed = false;

  if (!list.length) {
    if (hasLive) {
      list = liveRecRows();
      liveComputed = true;
      if (status !== 'all') list = list.filter((r) => r.status === status);
      if (source === 'performance' || source === 'policy') {
        list = list.filter((r) => r.source === source);
      }
    } else if (status === 'pending' || status === 'all') {
      const analysis = runOpsAnalysis({ useDryRun: true });
      list = analysis.recommendations
        .filter((r) => !r.auto_apply)
        .map((r, i) => ({
          id: `dry-${i}`,
          user_id: user.id,
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
      dryRun = true;
    }
  }

  return NextResponse.json({
    dryRun,
    liveComputed,
    recommendations: list,
    runs: runs || [],
  });
}
