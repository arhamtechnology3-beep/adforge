import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { resolveCampaignInput, competitorsFromInput } from '@/lib/auth/campaign-input';
import { scrapeAllCompetitors } from '@/lib/ai';
import {
  suggestAudience,
  audienceSuggestionFromCompetitorIntel,
  citiesFromTiers,
  DEFAULT_SALES_CITY_TIERS,
  type CityTier,
} from '@/lib/audience-suggest';
import { resolveTargeting } from '@/lib/meta-targeting';
import { resolveMetaConnection, metaAccessToken } from '@/lib/auth/demo-meta';

function parseTiers(raw: string | null): CityTier[] {
  if (!raw) return [...DEFAULT_SALES_CITY_TIERS];
  const allowed: CityTier[] = ['tier1', 'tier2', 'tier3'];
  const parts = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is CityTier => allowed.includes(s as CityTier));
  return parts.length ? parts : [...DEFAULT_SALES_CITY_TIERS];
}

/**
 * GET /api/campaigns/audience-suggest?tiers=tier1,tier2&resolve=1
 *
 * City names are Meta-oriented (Tier 1 = 8 metros, Tier 2 ≈ 97, Tier 3 = more).
 * With resolve=1 + Meta token: only Targeting Search matches are returned —
 * safe to push into Meta Ads geo_locations.
 */
export async function GET(request: NextRequest) {
  const tiers = parseTiers(request.nextUrl.searchParams.get('tiers'));
  const wantResolve = request.nextUrl.searchParams.get('resolve') === '1';

  const fallback = suggestAudience({
    websiteUrl: null,
    brandName: null,
    category: 'pickles',
    cityTiers: tiers,
  });

  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({
        ...fallback,
        cityTiers: tiers,
        note: 'Signed-out fallback — India Sales playbook (Meta resolve skipped).',
      });
    }

    const resolved = await resolveCampaignInput(user);
    if (!resolved) {
      return NextResponse.json({
        ...fallback,
        cityTiers: tiers,
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
      cityTiers: tiers,
      competitors: competitorIntel.map((c) => ({
        brand: c.brand,
        hook: c.hook,
        counterAngle: c.counterAngle,
        positioning: c.positioning,
        live_meta_ads: c.live_meta_ads,
      })),
    });

    const tierCities = citiesFromTiers(tiers);
    let cities = tierCities.length ? tierCities : suggestion.cities;
    let interests =
      suggestion.interests?.length >= 3 ? suggestion.interests : fallback.interests;

    let metaResolved = false;
    let droppedCities: string[] = [];
    let droppedInterests: string[] = [];

    if (wantResolve) {
      try {
        const connection = await resolveMetaConnection(user);
        const token = connection ? metaAccessToken(connection) : null;
        if (token) {
          const targeting = await resolveTargeting(cities, interests, token);
          if (targeting.cities.length) {
            cities = targeting.cities.map((c) => c.name);
            metaResolved = true;
          }
          if (targeting.interests.length) {
            interests = targeting.interests.map((i) => i.name);
            metaResolved = true;
          }
          droppedCities = targeting.unresolved_cities;
          droppedInterests = targeting.unresolved_interests;
        }
      } catch (err) {
        console.warn('[audience-suggest] Meta resolve failed', err);
      }
    }

    return NextResponse.json({
      ...suggestion,
      cities,
      interests,
      citiesCsv: cities.join(', '),
      interestsCsv: interests.join(', '),
      cityTiers: tiers,
      cityCounts: {
        tier1: citiesFromTiers(['tier1']).length,
        tier2: citiesFromTiers(['tier2']).length,
        tier3: citiesFromTiers(['tier3']).length,
        selected: cities.length,
      },
      metaResolved,
      droppedCities,
      droppedInterests,
      website_url: resolved.website_url,
      competitor_count: competitorIntel.length,
      note: metaResolved
        ? 'Only Meta Targeting Search matches kept — safe to push to Meta Ads.'
        : 'City names are Meta-oriented; geo keys resolve via Meta Targeting Search at launch.',
    });
  } catch (err) {
    console.warn('[audience-suggest] fatal', err);
    return NextResponse.json({
      ...fallback,
      cityTiers: tiers,
      note: 'Fallback playbook after error.',
    });
  }
}
