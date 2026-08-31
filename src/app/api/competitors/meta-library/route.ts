import { NextResponse } from 'next/server';
import { scrapeAllCompetitors } from '@/lib/ai';
import { getSessionUser } from '@/lib/auth/session';
import {
  resolveCampaignInput,
  competitorsFromInput,
} from '@/lib/auth/campaign-input';
import { withDemoLibraryFallback } from '@/lib/demo-competitor-ads';

export const maxDuration = 120;

/**
 * Fetch live competitor creatives from Meta Ad Library
 * (official ads_archive when available; otherwise Playwright web Library).
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const campaignInputId = body.campaign_input_id as string | undefined;

  const resolvedInput = await resolveCampaignInput(user, campaignInputId);
  if (!resolvedInput) {
    return NextResponse.json({ error: 'Campaign input not found' }, { status: 404 });
  }

  const competitors = competitorsFromInput(resolvedInput);

  if (competitors.length === 0) {
    return NextResponse.json({
      competitor_intel: [],
      note: 'No competitors saved in onboarding. Go to Onboarding and add at least one competitor URL.',
    });
  }

  const competitorIntel = withDemoLibraryFallback(
    await scrapeAllCompetitors(competitors, { fetchLiveAds: true }),
    { isDemo: user.isDemo }
  );

  return NextResponse.json({
    competitor_intel: competitorIntel,
    note: 'Live ads come from Meta Ad Library (same public source as facebook.com/ads/library). Spend/targeting are not exposed for commercial ads.',
  });
}
