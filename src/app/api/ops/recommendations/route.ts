import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runOpsAnalysis } from '@/lib/ops-agent';

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

  let query = supabase
    .from('agent_recommendations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (status !== 'all') query = query.eq('status', status);
  if (source === 'performance' || source === 'policy') query = query.eq('source', source);

  const { data: recommendations, error } = await query;

  if (error) {
    // Table may not exist yet — return dry-run
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

  const { data: runs } = await supabase
    .from('agent_runs')
    .select('*')
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(20);

  let list = recommendations || [];
  if (!list.length && status === 'pending') {
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
  }

  return NextResponse.json({
    dryRun: list.some((r) => String(r.id).startsWith('dry-')),
    recommendations: list,
    runs: runs || [],
  });
}
