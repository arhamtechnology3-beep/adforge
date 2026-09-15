import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { resolveCampaignInput, competitorsFromInput } from '@/lib/auth/campaign-input';
import { scrapeAllCompetitors, scrapeWebsite, extractBrandContext } from '@/lib/ai';
import {
  suggestAudience,
  audienceSuggestionFromCompetitorIntel,
  citiesFromTiers,
  DEFAULT_SALES_CITY_TIERS,
  type CityTier,
} from '@/lib/audience-suggest';
import { resolveTargeting } from '@/lib/meta-targeting';
import { resolveMetaConnection, metaAccessToken } from '@/lib/auth/demo-meta';
import { createClient } from '@/lib/supabase/server';
import { readDemoProducts } from '@/lib/product-catalog';

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
 * Studies the subscriber website + product catalog to prefill interests,
 * and returns Meta-style suggestedInterest chips for one-click add.
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

    // Study subscriber store website
    let websiteTexts: string[] = [];
    let brandName: string | null = null;
    let categoryHint: string | null = null;
    try {
      if (resolved.website_url) {
        const content = await scrapeWebsite(resolved.website_url);
        if (content) {
          websiteTexts = content
            .split('|')
            .map((p) => p.replace(/^site:/, '').trim())
            .filter(Boolean);
          const ctx = extractBrandContext(content, resolved.website_url);
          brandName = ctx.brand || null;
          categoryHint = ctx.category || null;
          if (ctx.hook) websiteTexts.push(ctx.hook);
        }
      }
    } catch (err) {
      console.warn('[audience-suggest] website scrape failed', err);
    }

    // Product catalog names (pickle SKUs etc.)
    let productNames: string[] = [];
    try {
      if (user.isDemo) {
        productNames = (await readDemoProducts())
          .map((p) => [p.product_name, p.category, p.description].filter(Boolean).join(' '))
          .filter(Boolean);
      } else {
        const supabase = await createClient();
        const { data: products } = await supabase
          .from('products')
          .select('product_name, category, description, brand_name')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(40);
        productNames = (products || [])
          .map((p) =>
            [p.brand_name, p.product_name, p.category, p.description].filter(Boolean).join(' ')
          )
          .filter(Boolean);
        if (!brandName && products?.[0]?.brand_name) brandName = products[0].brand_name;
      }
    } catch (err) {
      console.warn('[audience-suggest] products load failed', err);
    }

    const competitors = competitorsFromInput(resolved);
    let competitorIntel: Awaited<ReturnType<typeof scrapeAllCompetitors>> = [];
    try {
      competitorIntel = await scrapeAllCompetitors(competitors, { fetchLiveAds: false });
    } catch (err) {
      console.warn('[audience-suggest] competitor scrape failed', err);
    }

    const suggestion = audienceSuggestionFromCompetitorIntel({
      brandName,
      websiteUrl: resolved.website_url,
      category: categoryHint,
      websiteTexts,
      productNames,
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
    let suggestedInterests =
      suggestion.suggestedInterests?.length
        ? suggestion.suggestedInterests
        : fallback.suggestedInterests || [];

    let metaResolved = false;
    let droppedCities: string[] = [];
    let droppedInterests: string[] = [];

    if (wantResolve) {
      try {
        const connection = await resolveMetaConnection(user);
        const token = connection ? metaAccessToken(connection) : null;
        if (token) {
          const targeting = await resolveTargeting(
            cities,
            [...interests, ...suggestedInterests],
            token
          );
          if (targeting.cities.length) {
            cities = targeting.cities.map((c) => c.name);
            metaResolved = true;
          }
          if (targeting.interests.length) {
            const byLower = new Map(
              targeting.interests.map((r) => [r.name.toLowerCase(), r.name] as const)
            );
            const mapped = interests
              .map((i) => {
                const exact = byLower.get(i.toLowerCase());
                if (exact) return exact;
                const soft = targeting.interests.find(
                  (r) =>
                    r.name.toLowerCase().includes(i.toLowerCase()) ||
                    i.toLowerCase().includes(r.name.toLowerCase())
                );
                return soft?.name || null;
              })
              .filter(Boolean) as string[];
            interests = mapped.length ? mapped : targeting.interests.slice(0, 12).map((r) => r.name);
            const sel = new Set(interests.map((i) => i.toLowerCase()));
            suggestedInterests = targeting.interests
              .map((r) => r.name)
              .filter((n) => !sel.has(n.toLowerCase()));
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
      suggestedInterests,
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
      brandName,
      category: suggestion.category || categoryHint,
      competitor_count: competitorIntel.length,
      note: metaResolved
        ? 'Interests + cities filtered to Meta Targeting Search matches from your store.'
        : brandName
          ? `Prefill from ${brandName} store + India Sales playbook. Click suggestion chips to add.`
          : 'City/interest names are Meta-oriented; geo keys resolve at launch.',
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
