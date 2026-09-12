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
  const campaignId = searchParams.get('campaignId');
  const catalogOnly = searchParams.get('catalog') === '1';

  if (catalogOnly) {
    return NextResponse.json({ catalog: REPORT_CATALOG });
  }

  let campQuery = supabase
    .from('meta_campaigns')
    .select('id, name, budget, status, meta_campaign_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const { data: allCampaigns } = await campQuery;

  const campaigns =
    campaignId && campaignId !== 'all'
      ? (allCampaigns || []).filter((c) => c.id === campaignId)
      : allCampaigns || [];

  const ids = campaigns.map((c) => c.id);
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

  const scopedRecs =
    campaignId && campaignId !== 'all'
      ? (recommendations || []).filter((r) => r.meta_campaign_id === campaignId)
      : recommendations || [];

  const report = buildReport({
    view,
    snapshots,
    recommendations: scopedRecs,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      budget: c.budget != null ? Number(c.budget) : null,
      status: c.status,
    })),
    forceDryRun: snapshots.length === 0,
  });

  const latestSnap = [...snapshots].sort((a, b) => b.date.localeCompare(a.date))[0];

  return NextResponse.json({
    catalog: REPORT_CATALOG,
    report,
    campaigns: (allCampaigns || []).map((c) => ({
      id: c.id,
      name: c.name || 'Campaign',
      status: c.status,
      budget: c.budget != null ? Number(c.budget) : null,
      hasMeta: Boolean(c.meta_campaign_id),
    })),
    selectedCampaignId: campaignId && campaignId !== 'all' ? campaignId : 'all',
    lastSyncedAt: latestSnap?.date || null,
  });
}
