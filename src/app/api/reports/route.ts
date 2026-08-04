import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { REPORT_CATALOG, type ReportViewId } from '@/lib/reports/catalog';
import { buildReport } from '@/lib/reports/build';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const view = (searchParams.get('view') || 'executive') as ReportViewId;
  const catalogOnly = searchParams.get('catalog') === '1';

  if (catalogOnly) {
    return NextResponse.json({ catalog: REPORT_CATALOG });
  }

  const { data: campaigns } = await supabase
    .from('meta_campaigns')
    .select('id')
    .eq('user_id', user.id);

  const ids = (campaigns || []).map((c) => c.id);
  let snapshots = [];
  if (ids.length) {
    const { data } = await supabase
      .from('performance_snapshots')
      .select('*')
      .in('meta_campaign_id', ids)
      .order('date', { ascending: true });
    snapshots = data || [];
  }

  const { data: recommendations } = await supabase
    .from('agent_recommendations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const report = buildReport({
    view,
    snapshots,
    recommendations: recommendations || [],
    forceDryRun: snapshots.length === 0,
  });

  return NextResponse.json({ catalog: REPORT_CATALOG, report });
}
