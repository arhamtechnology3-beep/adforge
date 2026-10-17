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
  const rangeParam = (searchParams.get('range') || 'last_30d').toLowerCase();
  const catalogOnly = searchParams.get('catalog') === '1';

  if (catalogOnly) {
    return NextResponse.json({ catalog: REPORT_CATALOG });
  }

  const { data: allCampaigns } = await supabase
    .from('meta_campaigns')
    .select('id, name, budget, status, meta_campaign_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const campaigns =
    campaignId && campaignId !== 'all'
      ? (allCampaigns || []).filter((c) => c.id === campaignId)
      : allCampaigns || [];

  const ids = campaigns.map((c) => c.id);
  let sinceDate: string | null = null;
  if (rangeParam === 'last_7d') {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 6);
    sinceDate = d.toISOString().split('T')[0];
  } else if (rangeParam === 'last_30d' || rangeParam === '30' || rangeParam === 'default') {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 29);
    sinceDate = d.toISOString().split('T')[0];
  }
  // range=all → no sinceDate filter

  let snapshots = [];
  if (ids.length) {
    let q = supabase
      .from('performance_snapshots')
      .select('*')
      .in('meta_campaign_id', ids)
      .order('date', { ascending: true });
    if (sinceDate) q = q.gte('date', sinceDate);
    const { data } = await q;
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

  const { data: adAccount } = await supabase
    .from('ad_accounts')
    .select('id, meta_ad_account_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const liveMetaLinked = Boolean(
    adAccount?.meta_ad_account_id ||
      (allCampaigns || []).some((c) => c.meta_campaign_id)
  );

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
    // Sample numbers ONLY when Meta is not linked. Live ₹0 must stay ₹0.
    liveMetaLinked,
    forceDryRun: !liveMetaLinked && snapshots.length === 0,
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
    range: rangeParam === 'all' ? 'all' : rangeParam === 'last_7d' ? 'last_7d' : 'last_30d',
    rangeSince: sinceDate,
    lastSyncedAt: latestSnap?.date || null,
    snapshotDays: new Set(snapshots.map((s: { date: string }) => s.date)).size,
  });
}
