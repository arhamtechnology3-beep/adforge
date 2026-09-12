import { createClient } from '@/lib/supabase/server';
import {
  dryRunOptimizeAccount,
  runOptimizeSuite,
  type OptimizeAccountInput,
  type OptimizeCampaignInput,
  type OptimizeCreativeInput,
} from '@/lib/meta-optimize';

/** Build optimize account input from Supabase (or dry-run). */
export async function loadOptimizeAccount(
  userId: string
): Promise<{ account: OptimizeAccountInput; dryRun: boolean }> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('users')
    .select('cpa_target, roas_target, daily_budget_cap, agent_settings')
    .eq('id', userId)
    .maybeSingle();

  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('brand_name, website_url')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: adAccount } = await supabase
    .from('ad_accounts')
    .select('pixel_id, page_id')
    .eq('user_id', userId)
    .maybeSingle();

  // Column is `budget` (not daily_budget) — wrong name made this query fail and forced sample account.
  const { data: campaigns, error: campErr } = await supabase
    .from('meta_campaigns')
    .select('id, name, status, budget, objective, launch_config, ad_ids')
    .eq('user_id', userId);

  if (campErr) {
    console.error('[optimize] meta_campaigns', campErr.message);
  }

  if (!campaigns?.length) {
    return { account: dryRunOptimizeAccount(), dryRun: true };
  }

  const campIds = campaigns.map((c) => c.id);
  const { data: snapshots } = await supabase
    .from('performance_snapshots')
    .select('*')
    .in('meta_campaign_id', campIds)
    .order('date', { ascending: false })
    .limit(200);

  const adIds = Array.from(
    new Set(
      campaigns.flatMap((c) => (Array.isArray(c.ad_ids) ? (c.ad_ids as string[]) : []))
    )
  );

  let ads: Array<{
    id: string;
    headline: string | null;
    copy_text: string;
    ad_format: string | null;
    status: string;
  }> = [];

  if (adIds.length) {
    const { data } = await supabase
      .from('generated_ads')
      .select('id, headline, copy_text, ad_format, status')
      .in('id', adIds)
      .limit(40);
    ads = data || [];
  } else {
    // Fallback: ads owned via campaigns_input for this user
    const { data: inputs } = await supabase
      .from('campaigns_input')
      .select('id')
      .eq('user_id', userId)
      .limit(20);
    const inputIds = (inputs || []).map((i) => i.id);
    if (inputIds.length) {
      const { data } = await supabase
        .from('generated_ads')
        .select('id, headline, copy_text, ad_format, status')
        .in('campaign_input_id', inputIds)
        .in('status', ['approved', 'pending'])
        .limit(40);
      ads = data || [];
    }
  }

  const byCamp = new Map<string, NonNullable<typeof snapshots>>();
  for (const s of snapshots || []) {
    const list = byCamp.get(s.meta_campaign_id) || [];
    list.push(s);
    byCamp.set(s.meta_campaign_id, list);
  }

  const optimizeCampaigns: OptimizeCampaignInput[] = campaigns.map((c) => {
    const rows = byCamp.get(c.id) || [];
    const latest = rows[0];
    const lc = (c.launch_config || {}) as Record<string, unknown>;
    return {
      id: c.id,
      name: c.name || 'Campaign',
      status: c.status === 'active' ? 'active' : c.status || 'paused',
      objective: c.objective,
      budgetType: (lc.budget_type as OptimizeCampaignInput['budgetType']) || 'unknown',
      biddingStrategy: (lc.bidding_strategy as string) || null,
      dailyBudget: c.budget != null ? Number(c.budget) : null,
      spend: Number(latest?.spend || 0),
      impressions: Number(latest?.impressions || 0),
      clicks: Number(latest?.clicks || 0),
      cpc: Number(latest?.cpc || 0),
      cpm: Number(latest?.cpm || 0),
      ctr: Number(latest?.ctr || 0),
      cpa: latest?.cost_per_purchase != null ? Number(latest.cost_per_purchase) : null,
      roas: latest?.roas != null ? Number(latest.roas) : null,
      frequency: Number(latest?.frequency || 0),
      purchases: Number(latest?.purchases || 0),
      addToCart: Number(latest?.add_to_cart || 0),
      initiateCheckout: Number(latest?.initiate_checkout || 0),
      conversionRate: latest?.conversion_rate != null ? Number(latest.conversion_rate) : null,
      revenue: Number(latest?.revenue || 0),
      reach: Number(latest?.reach || 0),
      attributionWindow: (lc.attribution_window as string) || '7d_click_1d_view',
      hasExclusions: Boolean(lc.has_exclusions),
      hasLookalike: Boolean(lc.has_lookalike),
    };
  });

  const creatives: OptimizeCreativeInput[] = ads.map((a, i) => ({
    id: a.id,
    name: a.headline || `Creative ${i + 1}`,
    format: a.ad_format || 'single_image',
    headline: a.headline || undefined,
    primaryText: a.copy_text || undefined,
    spend: 0,
    ctr: 0,
    cpa: null,
    frequency: 0,
    conceptCluster: undefined,
  }));

  const agentSettings = (profile?.agent_settings || {}) as Record<string, unknown>;
  const trackingSettings = (agentSettings.tracking || {}) as Record<string, unknown>;

  const account: OptimizeAccountInput = {
    brandName: brand?.brand_name || null,
    websiteUrl: brand?.website_url || null,
    campaigns: optimizeCampaigns,
    creatives,
    tracking: {
      pixelConnected: Boolean(adAccount?.pixel_id),
      pixelId: adAccount?.pixel_id || null,
      capiEnabled: Boolean(trackingSettings.capi_enabled),
      emqScore:
        trackingSettings.emq_score != null ? Number(trackingSettings.emq_score) : null,
      dedupRate:
        trackingSettings.dedup_rate != null ? Number(trackingSettings.dedup_rate) : null,
      domainVerified: Boolean(trackingSettings.domain_verified),
      eventsSeen: Array.isArray(trackingSettings.events_seen)
        ? (trackingSettings.events_seen as string[])
        : adAccount?.pixel_id
          ? ['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase']
          : [],
      purchaseEvents7d:
        trackingSettings.purchase_events_7d != null
          ? Number(trackingSettings.purchase_events_7d)
          : optimizeCampaigns.reduce((s, c) => s + c.purchases, 0),
    },
    targets: {
      cpaTarget: profile?.cpa_target != null ? Number(profile.cpa_target) : 100,
      roasTarget: profile?.roas_target != null ? Number(profile.roas_target) : 2.5,
      dailyBudgetCap:
        profile?.daily_budget_cap != null ? Number(profile.daily_budget_cap) : null,
      aov: trackingSettings.aov != null ? Number(trackingSettings.aov) : 499,
      marginPct:
        trackingSettings.margin_pct != null ? Number(trackingSettings.margin_pct) : 40,
      ltv: trackingSettings.ltv != null ? Number(trackingSettings.ltv) : null,
    },
  };

  const hasInsights = (snapshots || []).length > 0;
  return { account, dryRun: !hasInsights };
}

export async function runOptimizeForUser(userId: string) {
  const { account, dryRun } = await loadOptimizeAccount(userId);
  const suite = runOptimizeSuite(account);
  return { dryRun, account, suite };
}
