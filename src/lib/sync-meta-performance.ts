import type { SupabaseClient } from '@supabase/supabase-js';
import {
  retrieveToken,
  getCampaignInsights,
  parseInsightsPayload,
  getCampaignInsightBreakdowns,
} from '@/lib/meta';
import type { InsightBreakdowns } from '@/types/database';

const GRAPH = 'https://graph.facebook.com/v21.0';

async function fetchMetaCampaignStatus(token: string, metaCampaignId: string) {
  const res = await fetch(
    `${GRAPH}/${metaCampaignId}?fields=id,name,status,effective_status&access_token=${encodeURIComponent(token)}`
  );
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'Meta campaign status failed');
  return json as {
    id: string;
    name?: string;
    status?: string;
    effective_status?: string;
  };
}

export function mapMetaCampaignStatus(
  effective?: string,
  configured?: string
): 'active' | 'paused' | null {
  const eff = (effective || configured || '').toUpperCase();
  if (eff === 'ACTIVE') return 'active';
  if (
    eff === 'PAUSED' ||
    eff === 'CAMPAIGN_PAUSED' ||
    eff === 'ADSET_PAUSED' ||
    eff === 'ARCHIVED' ||
    eff === 'DELETED'
  ) {
    return 'paused';
  }
  return null;
}

async function buildBreakdowns(
  token: string,
  metaCampaignId: string
): Promise<InsightBreakdowns> {
  const mapRows = (
    rows: Array<Record<string, unknown>>,
    key: string
  ): Array<{ name: string; spend: number; impressions?: number; ctr?: number }> =>
    rows.map((r) => ({
      name: String(r[key] || 'Unknown'),
      spend: parseFloat(String(r.spend || '0')),
      impressions: parseInt(String(r.impressions || '0'), 10),
      ctr: parseFloat(String(r.ctr || '0')),
    }));

  try {
    const [placement, age, gender, device, geo] = await Promise.all([
      getCampaignInsightBreakdowns(token, metaCampaignId, 'publisher_platform', 'today'),
      getCampaignInsightBreakdowns(token, metaCampaignId, 'age', 'today'),
      getCampaignInsightBreakdowns(token, metaCampaignId, 'gender', 'today'),
      getCampaignInsightBreakdowns(token, metaCampaignId, 'impression_device', 'today'),
      getCampaignInsightBreakdowns(token, metaCampaignId, 'country', 'today'),
    ]);
    return {
      placement: mapRows(placement, 'publisher_platform'),
      age: mapRows(age, 'age').map((r) => ({ name: r.name, spend: r.spend })),
      gender: mapRows(gender, 'gender').map((r) => ({ name: r.name, spend: r.spend })),
      device: mapRows(device, 'impression_device'),
      geo: mapRows(geo, 'country').map((r) => ({ name: r.name, spend: r.spend })),
    };
  } catch {
    return {};
  }
}

export type SyncCampaignResult = {
  id: string;
  name: string;
  statusSynced: boolean;
  status?: string;
  snapshot: boolean;
  spend?: number;
  impressions?: number;
  clicks?: number;
  error?: string;
};

export type SyncMetaPerformanceResult = {
  date: string;
  statusSynced: number;
  snapshotsWritten: number;
  campaigns: SyncCampaignResult[];
};

/**
 * Pull Meta status + today's insights into performance_snapshots for one user
 * (or a single campaign). Used by Reports Sync button and CLI script.
 */
export async function syncMetaPerformanceForUser(
  supabase: SupabaseClient,
  opts: { userId: string; campaignId?: string | null }
): Promise<SyncMetaPerformanceResult> {
  const today = new Date().toISOString().split('T')[0];
  const { data: account, error: accErr } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('user_id', opts.userId)
    .not('access_token_encrypted', 'is', null)
    .maybeSingle();

  if (accErr) throw new Error(accErr.message);
  if (!account?.access_token_encrypted) {
    throw new Error('Connect Meta Ad Account before syncing insights.');
  }

  let campQuery = supabase
    .from('meta_campaigns')
    .select('*')
    .eq('user_id', opts.userId)
    .not('meta_campaign_id', 'is', null);

  if (opts.campaignId) {
    campQuery = campQuery.eq('id', opts.campaignId);
  }

  const { data: campaigns, error: cErr } = await campQuery;
  if (cErr) throw new Error(cErr.message);
  if (!campaigns?.length) {
    return { date: today, statusSynced: 0, snapshotsWritten: 0, campaigns: [] };
  }

  const token = retrieveToken(account.access_token_encrypted);
  let statusSynced = 0;
  let snapshotsWritten = 0;
  const results: SyncCampaignResult[] = [];

  for (const campaign of campaigns) {
    const metaId = campaign.meta_campaign_id as string;
    const row: SyncCampaignResult = {
      id: campaign.id,
      name: campaign.name || 'Campaign',
      statusSynced: false,
      snapshot: false,
    };
    try {
      const meta = await fetchMetaCampaignStatus(token, metaId);
      const mapped = mapMetaCampaignStatus(meta.effective_status, meta.status);

      if (mapped && mapped !== campaign.status) {
        const launchConfig = {
          ...((campaign.launch_config || {}) as Record<string, unknown>),
          meta_live: mapped === 'active',
          meta_status_synced_at: new Date().toISOString(),
          meta_effective_status: meta.effective_status || meta.status,
        };
        const { error: uErr } = await supabase
          .from('meta_campaigns')
          .update({ status: mapped, launch_config: launchConfig })
          .eq('id', campaign.id)
          .eq('user_id', opts.userId);
        if (uErr) throw new Error(uErr.message);
        statusSynced += 1;
        row.statusSynced = true;
        row.status = mapped;
      }

      const raw = await getCampaignInsights(token, metaId, 'today');
      const parsed = parseInsightsPayload(raw);
      if (!parsed) {
        results.push(row);
        continue;
      }

      const breakdowns = await buildBreakdowns(token, metaId);
      const { error: sErr } = await supabase.from('performance_snapshots').upsert(
        {
          meta_campaign_id: campaign.id,
          date: today,
          cpc: parsed.cpc,
          cpa: parsed.cost_per_purchase,
          ctr: parsed.ctr,
          spend: parsed.spend,
          impressions: parsed.impressions,
          reach: parsed.reach,
          clicks: parsed.clicks,
          cpm: parsed.cpm,
          frequency: parsed.frequency,
          purchases: parsed.purchases,
          add_to_cart: parsed.add_to_cart,
          initiate_checkout: parsed.initiate_checkout,
          cost_per_purchase: parsed.cost_per_purchase,
          roas: parsed.roas,
          conversion_rate: parsed.conversion_rate,
          video_views: parsed.video_views,
          engagement_rate: parsed.engagement_rate,
          revenue: parsed.revenue,
          raw_insights: parsed.raw,
          breakdowns,
        },
        { onConflict: 'meta_campaign_id,date' }
      );
      if (sErr) throw new Error(sErr.message);

      snapshotsWritten += 1;
      row.snapshot = true;
      row.spend = parsed.spend;
      row.impressions = parsed.impressions;
      row.clicks = parsed.clicks;
      results.push(row);
    } catch (err) {
      row.error = err instanceof Error ? err.message : String(err);
      results.push(row);
    }
  }

  return { date: today, statusSynced, snapshotsWritten, campaigns: results };
}
