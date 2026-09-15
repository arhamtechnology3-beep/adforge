import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { resolveCampaignInput, competitorsFromInput } from '@/lib/auth/campaign-input';
import { scrapeAllCompetitors } from '@/lib/ai';
import { audienceSuggestionFromCompetitorIntel } from '@/lib/audience-suggest';

/**
 * GET /api/campaigns/audience-suggest
 * Auto cities + interests from onboarding brand + competitor intel / Library copy.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolved = await resolveCampaignInput(user);
  if (!resolved) {
    const fallback = audienceSuggestionFromCompetitorIntel({
      brandName: null,
      websiteUrl: null,
      category: 'pickles',
      competitors: [],
    });
    return NextResponse.json({
      ...fallback,
      note: 'Complete onboarding for brand-specific suggestions.',
    });
  }

  const competitors = competitorsFromInput(resolved);
  let competitorIntel: Awaited<ReturnType<typeof scrapeAllCompetitors>> = [];
  try {
    competitorIntel = await scrapeAllCompetitors(competitors, { fetchLiveAds: false });
  } catch (err) {
    console.warn('[audience-suggest] competitor scrape failed', err);
  }

  const suggestion = audienceSuggestionFromCompetitorIntel({
    brandName: null,
    websiteUrl: resolved.website_url,
    category: null,
    competitors: competitorIntel.map((c) => ({
      brand: c.brand,
      hook: c.hook,
      counterAngle: c.counterAngle,
      positioning: c.positioning,
      live_meta_ads: c.live_meta_ads,
    })),
  });

  return NextResponse.json({
    ...suggestion,
    website_url: resolved.website_url,
    competitor_count: competitorIntel.length,
  });
}
