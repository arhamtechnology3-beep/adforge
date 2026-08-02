import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { retrieveToken, getCampaignInsights } from '@/lib/meta';

export async function GET(
  _request: Request,
  { params }: { params: { campaignId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: campaign } = await supabase
    .from('meta_campaigns')
    .select('*')
    .eq('id', params.campaignId)
    .eq('user_id', user.id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { data: snapshots } = await supabase
    .from('performance_snapshots')
    .select('*')
    .eq('meta_campaign_id', campaign.id)
    .order('date', { ascending: true });

  let liveInsights = null;
  if (campaign.meta_campaign_id) {
    const { data: adAccount } = await supabase
      .from('ad_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

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
    cpaTarget: userProfile?.cpa_target,
  });
}
