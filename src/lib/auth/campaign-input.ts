import { createClient } from '@/lib/supabase/server';
import type { SessionUser } from '@/lib/auth/session';
import {
  DEMO_CAMPAIGN_INPUT_ID,
  readDemoOnboarding,
  type DemoOnboarding,
} from '@/lib/auth/demo-onboarding';
import type { CompetitorEntry } from '@/types/database';

/** Default demo data so /ads works without completing onboarding first */
export function getDefaultDemoOnboarding(userId: string): DemoOnboarding {
  return {
    id: DEMO_CAMPAIGN_INPUT_ID,
    user_id: userId,
    website_url: 'https://farmdidi.com',
    competitors: [
      {
        url: 'https://www.farmdidi.com',
        type: 'website',
        meta_page_id: '108788791719221',
      },
    ],
    competitor_url: 'https://www.farmdidi.com',
    competitor_type: 'website',
    meta_connected: false,
    demo: true,
  };
}

export type ResolvedCampaignInput = {
  id: string;
  user_id: string;
  website_url: string;
  competitors: CompetitorEntry[];
  competitor_url: string | null;
  competitor_type: string | null;
  isDemo: boolean;
};

export async function resolveCampaignInput(
  user: SessionUser,
  campaignInputId?: string | null
): Promise<ResolvedCampaignInput | null> {
  if (user.isDemo) {
    const saved = await readDemoOnboarding();
    const row = saved || getDefaultDemoOnboarding(user.id);
    if (campaignInputId && campaignInputId !== row.id) return null;
    return {
      id: row.id,
      user_id: row.user_id,
      website_url: row.website_url,
      competitors: row.competitors || [],
      competitor_url: row.competitor_url,
      competitor_type: row.competitor_type,
      isDemo: true,
    };
  }

  const supabase = await createClient();
  const query = supabase.from('campaigns_input').select('*').eq('user_id', user.id);

  const { data: campaignInput } = campaignInputId
    ? await query.eq('id', campaignInputId).maybeSingle()
    : await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!campaignInput) return null;

  return {
    id: campaignInput.id,
    user_id: campaignInput.user_id,
    website_url: campaignInput.website_url,
    competitors: (campaignInput.competitors as CompetitorEntry[]) || [],
    competitor_url: campaignInput.competitor_url,
    competitor_type: campaignInput.competitor_type,
    isDemo: false,
  };
}

export function competitorsFromInput(input: ResolvedCampaignInput) {
  if (input.competitors.length > 0) return input.competitors;
  if (input.competitor_url) {
    return [{ url: input.competitor_url, type: input.competitor_type || 'website' }];
  }
  return [];
}
