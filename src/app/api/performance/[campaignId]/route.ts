import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { retrieveToken, getCampaignInsights } from '@/lib/meta';
import { loadActiveStore } from '@/lib/stores';

export async function GET(
  _request: Request,
  { params }: { params: { campaignId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const store = await loadActiveStore(user.id);
  const { data: campaign } = await supabase
    .from('meta_campaigns')
    .select('*')
    .eq('id', params.campaignId)
    .eq('user_id', user.id)
    .single();

  if (!campaign || (store && campaign.store_id && campaign.store_id !== store.id)) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { data: snapshots } = await supabase
    .from('performance_snapshots')
    .select('*')
    .eq('meta_campaign_id', campaign.id)
    .order('date', { ascending: true });

  let liveInsights = null;
  if (campaign.meta_campaign_id) {
    let accountQuery = supabase.from('ad_accounts').select('*').eq('user_id', user.id);
    if (campaign.store_id) accountQuery = accountQuery.eq('store_id', campaign.store_id);
    else if (store) accountQuery = accountQuery.eq('store_id', store.id);
    const { data: adAccount } = await accountQuery.maybeSingle();

    if (adAccount?.access_token_encrypted) {
      try {
        const token = retrieveToken(adAccount.access_token_encrypted);
        liveInsights = await getCampaignInsights(token, campaign.meta_campaign_id);
      } catch {
        // Fall back to cached snapshots
      }
    }
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('cpa_target')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    campaign,
    snapshots: snapshots || [],
    liveInsights,
    cpaTarget: store?.cpa_target ?? userProfile?.cpa_target,
  });
}
