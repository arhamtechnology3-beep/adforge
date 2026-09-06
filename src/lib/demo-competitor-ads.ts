import type { CompetitorIntel, MetaAdLibraryAd } from '@/lib/ai';
import { rankLibraryAds } from '@/lib/ad-performance';
import { productSceneUrl } from '@/lib/creatives';

function demoMediaUrl(comp: CompetitorIntel, index: number): string {
  if (comp.image) return comp.image;
  return productSceneUrl('pickles', 'competitor-beat', index + 1);
}

/**
 * Sample Library-style ads from website intel when Playwright/API fetch returns 0.
 * Used in demo mode and as a production fallback so Step 1 is never a dead end.
 */
export function buildDemoLibraryAdsFromIntel(comp: CompetitorIntel): MetaAdLibraryAd[] {
  const pageId = comp.meta_page_id || 'demo';
  const hooks = [
    comp.hook?.slice(0, 180) || comp.description?.slice(0, 180) || `Discover ${comp.brand}`,
    `Why ${comp.brand} customers keep reordering — limited batch drops every week.`,
    `As seen trending: authentic flavours, zero preservatives. Shop ${comp.domain}.`,
    `${comp.brand} bestsellers — the creatives that usually keep running longest in category.`,
    `Homemade taste, ready to ship. See what ${comp.brand} puts in front of Meta shoppers.`,
  ];
  const headlines = [
    comp.title?.split(/[-–—|]/)[0]?.trim().slice(0, 40) || comp.brand,
    'Limited batch — order today',
    'Free delivery on first order',
    'Customer favourite',
    'Shop the drop',
  ];
  const formats: MetaAdLibraryAd['ad_format'][] = [
    'single_image',
    'single_image',
    'video',
    'carousel',
    'single_image',
  ];
  const daysAgo = [62, 28, 14, 90, 45];

  const raw: MetaAdLibraryAd[] = hooks.map((primary_text, i) => ({
    id: `demo_lib_${pageId}_${i + 1}`,
    library_id: `demo${pageId}${i + 1}`,
    ad_format: formats[i],
    primary_text,
    headline: headlines[i] || comp.brand,
    cta: i === 2 ? 'Shop Now' : 'Order Now',
    active_status: i % 2 === 0 ? ('ACTIVE' as const) : ('UNKNOWN' as const),
    started_date: new Date(Date.now() - daysAgo[i] * 86400000).toISOString().slice(0, 10),
    publisher_platforms: ['Instagram', 'Facebook'],
    media_url: demoMediaUrl(comp, i),
    snapshot_url: comp.meta_ad_library_url,
    source: 'manual' as const,
    runtime_days: daysAgo[i],
    total_active_time: daysAgo[i] * 86400,
    has_multiple_versions: i === 0,
  }));

  return rankLibraryAds(raw).slice(0, 10);
}

export function withDemoLibraryFallback(
  intel: CompetitorIntel[],
  opts: { isDemo: boolean }
): CompetitorIntel[] {
  return intel.map((comp) => {
    const hasLive =
      (comp.live_meta_ads?.length || 0) > 0 &&
      comp.live_meta_ads?.some((a) => a.source !== 'manual');
    if (hasLive) {
      return {
        ...comp,
        live_meta_ads: (comp.live_meta_ads || []).slice(0, 10),
        meta_ads_count: Math.min(comp.meta_ads_count || comp.live_meta_ads?.length || 0, 10),
      };
    }
    const demoAds = buildDemoLibraryAdsFromIntel(comp);
    return {
      ...comp,
      live_meta_ads: demoAds,
      meta_ads_count: demoAds.length,
      library_fetch_note:
        (comp.library_fetch_note ? `${comp.library_fetch_note} ` : '') +
        (opts.isDemo
          ? 'Showing sample ads (preview placeholders). Click Refresh from Ad Library for live Meta creatives.'
          : 'Live Ad Library fetch returned none — showing top estimated patterns from competitor site intel (active + historical style). Open Meta Ad Library for exact creatives, or Refresh again.'),
    };
  });
}
