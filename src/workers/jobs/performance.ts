import { createClient } from '@supabase/supabase-js';
import { retrieveToken, getCampaignInsights } from '@/lib/meta';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function syncAllCampaignPerformance() {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: campaigns } = await supabase
    .from('meta_campaigns')
    .select('*, ad_accounts!inner(*)')
    .eq('status', 'active')
    .not('meta_campaign_id', 'is', null);

  if (!campaigns?.length) return;

  for (const campaign of campaigns) {
    try {
      const { data: adAccount } = await supabase
        .from('ad_accounts')
        .select('*')
        .eq('user_id', campaign.user_id)
        .single();

      if (!adAccount?.access_token_encrypted) continue;

      const token = retrieveToken(adAccount.access_token_encrypted);
      const insights = await getCampaignInsights(token, campaign.meta_campaign_id!);

      if (!insights) continue;

      const cpa = insights.cost_per_action_type?.find(
        (a: { action_type: string }) => a.action_type === 'purchase'
      )?.value;

      await supabase.from('performance_snapshots').upsert(
        {
          meta_campaign_id: campaign.id,
          date: today,
          cpc: parseFloat(insights.cpc || '0'),
          cpa: cpa ? parseFloat(cpa) : null,
          ctr: parseFloat(insights.ctr || '0'),
          spend: parseFloat(insights.spend || '0'),
          impressions: parseInt(insights.impressions || '0', 10),
        },
        { onConflict: 'meta_campaign_id,date' }
      );
    } catch (err) {
      console.error(`[Performance Sync] Campaign ${campaign.id}:`, err);
    }
  }
}
