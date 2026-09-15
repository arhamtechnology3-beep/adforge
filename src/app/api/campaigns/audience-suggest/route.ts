import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { resolveCampaignInput, competitorsFromInput } from '@/lib/auth/campaign-input';
import { scrapeAllCompetitors } from '@/lib/ai';
import {
  suggestAudience,
  audienceSuggestionFromCompetitorIntel,
} from '@/lib/audience-suggest';

/**
 * GET /api/campaigns/audience-suggest
 * Always returns a usable Sales audience (never empty).
 * Prefer competitor intel when logged in; otherwise category playbook.
 */
export async function GET() {
  const fallback = suggestAudience({
    websiteUrl: null,
    brandName: null,
    category: 'pickles',
  });

  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({
        ...fallback,
        note: 'Signed-out fallback — India Sales playbook.',
      });
    }

    const resolved = await resolveCampaignInput(user);
    if (!resolved) {
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

    // Never return thinner than playbook
    const cities =
      suggestion.cities?.length >= 5 ? suggestion.cities : fallback.cities;
    const interests =
      suggestion.interests?.length >= 3 ? suggestion.interests : fallback.interests;

    return NextResponse.json({
      ...suggestion,
      cities,
      interests,
      citiesCsv: cities.join(', '),
      interestsCsv: interests.join(', '),
      website_url: resolved.website_url,
      competitor_count: competitorIntel.length,
    });
  } catch (err) {
    console.warn('[audience-suggest] fatal', err);
    return NextResponse.json({
      ...fallback,
      note: 'Fallback playbook after error.',
    });
  }
}
