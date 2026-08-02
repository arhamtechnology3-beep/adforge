import { createClient } from '@supabase/supabase-js';
import { retrieveToken, pauseCampaign } from '@/lib/meta';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function checkAndAutoPause() {
  const supabase = getServiceClient();

  const { data: users } = await supabase
    .from('users')
    .select('*')
    .not('cpa_target', 'is', null);

  if (!users?.length) return;

  for (const user of users) {
    const { data: campaigns } = await supabase
      .from('meta_campaigns')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (!campaigns?.length) continue;

    for (const campaign of campaigns) {
      const { data: snapshots } = await supabase
        .from('performance_snapshots')
        .select('*')
        .eq('meta_campaign_id', campaign.id)
        .order('date', { ascending: false })
        .limit(3);

      if (!snapshots || snapshots.length < 3) continue;

      const threshold = user.cpa_target! * 1.5;
      const allExceed = snapshots.every(
        (s) => s.cpa !== null && s.cpa > threshold
      );

      if (!allExceed) continue;

      try {
        const { data: adAccount } = await supabase
          .from('ad_accounts')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (adAccount?.access_token_encrypted && campaign.meta_campaign_id) {
          const token = retrieveToken(adAccount.access_token_encrypted);
          await pauseCampaign(token, campaign.meta_campaign_id);
        }

        await supabase
          .from('meta_campaigns')
          .update({ status: 'paused' })
          .eq('id', campaign.id);

        await supabase.from('report_logs').insert({
          user_id: user.id,
          channel: 'whatsapp',
          report_type: 'auto_pause_cpa',
        });

        if (user.phone && user.whatsapp_opt_in) {
          await sendWhatsAppMessage(
            user.phone,
            `⚠️ Campaign "${campaign.objective}" was auto-paused. CPA exceeded ₹${threshold.toFixed(0)} for 3 consecutive days. Review in your dashboard.`
          );
        }
      } catch (err) {
        console.error(`[Auto-Pause] Campaign ${campaign.id}:`, err);
      }
    }
  }
}
