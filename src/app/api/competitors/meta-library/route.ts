import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scrapeAllCompetitors } from '@/lib/ai';

export const maxDuration = 120;

/**
 * Fetch live competitor creatives from Meta Ad Library
 * (official ads_archive when available; otherwise Playwright web Library).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const campaignInputId = body.campaign_input_id as string | undefined;

  if (!campaignInputId) {
    return NextResponse.json({ error: 'campaign_input_id required' }, { status: 400 });
  }

  const { data: campaignInput } = await supabase
    .from('campaigns_input')
    .select('*')
    .eq('id', campaignInputId)
    .eq('user_id', user.id)
    .single();

  if (!campaignInput) {
    return NextResponse.json({ error: 'Campaign input not found' }, { status: 404 });
  }

  const competitors =
    Array.isArray(campaignInput.competitors) && campaignInput.competitors.length > 0
      ? campaignInput.competitors
      : campaignInput.competitor_url
        ? [
            {
              url: campaignInput.competitor_url,
              type: campaignInput.competitor_type || 'website',
              meta_page_id: null,
            },
          ]
        : [];

  if (competitors.length === 0) {
    return NextResponse.json({
      competitor_intel: [],
      note: 'No competitors saved in onboarding.',
    });
  }

  const competitorIntel = await scrapeAllCompetitors(competitors, { fetchLiveAds: true });

  return NextResponse.json({
    competitor_intel: competitorIntel,
    note: 'Live ads come from Meta Ad Library (same public source as facebook.com/ads/library). Spend/targeting are not exposed for commercial ads.',
  });
}
