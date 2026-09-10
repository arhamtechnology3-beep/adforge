import { NextResponse } from 'next/server';
import { scrapeAllCompetitors } from '@/lib/ai';
import { getSessionUser } from '@/lib/auth/session';
import {
  resolveCampaignInput,
  competitorsFromInput,
} from '@/lib/auth/campaign-input';
import { withDemoLibraryFallback } from '@/lib/demo-competitor-ads';
import { applyCompetitorLibraryCache } from '@/lib/competitor-library-cache';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Fetch live competitor creatives from Meta Ad Library
 * (official ads_archive when available; otherwise Playwright web Library).
 * Order: live → previous saved for that competitor URL → soft website-intel placeholders.
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

  const scraped = await scrapeAllCompetitors(competitors, { fetchLiveAds: true });
  const withPrevious = await applyCompetitorLibraryCache(user.id, scraped, {
    isDemo: user.isDemo,
  });
  const competitorIntel = withDemoLibraryFallback(withPrevious, {
    isDemo: user.isDemo,
  });

  return NextResponse.json({
    competitor_intel: competitorIntel,
    note: 'Live ads come from Meta Ad Library for the competitor URL you saved. If live fetch fails, we show the last successful Library ads for that competitor. Spend/targeting are not exposed for commercial ads.',
  });
}
