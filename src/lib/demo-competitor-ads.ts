import type { CompetitorIntel, MetaAdLibraryAd } from '@/lib/ai';
import { rankLibraryAds } from '@/lib/ad-performance';
import { productSceneUrl } from '@/lib/creatives';

function demoMediaUrl(comp: CompetitorIntel, index: number): string {
  if (comp.image) return comp.image;
  return productSceneUrl('pickles', 'competitor-beat', index + 1);
}

/**
 * Sample Library ads from website intel when Playwright/API fetch returns 0.
 * Used in demo mode so Step 1 is never empty.
 */
export function buildDemoLibraryAdsFromIntel(comp: CompetitorIntel): MetaAdLibraryAd[] {
  const pageId = comp.meta_page_id || 'demo';
  const hooks = [
    comp.hook?.slice(0, 180) || comp.description?.slice(0, 180) || `Discover ${comp.brand}`,
    `Why ${comp.brand} customers keep reordering — limited batch drops every week.`,
    `As seen trending: authentic flavours, zero preservatives. Shop ${comp.domain}.`,
  ];
  const headlines = [
    comp.title?.split(/[-–—|]/)[0]?.trim().slice(0, 40) || comp.brand,
    'Limited batch — order today',
    'Free delivery on first order',
  ];
  const formats: MetaAdLibraryAd['ad_format'][] = ['single_image', 'single_image', 'video'];
  const daysAgo = [62, 28, 14];

  const raw: MetaAdLibraryAd[] = hooks.map((primary_text, i) => ({
    id: `demo_lib_${pageId}_${i + 1}`,
    library_id: `demo${pageId}${i + 1}`,
    ad_format: formats[i],
    primary_text,
    headline: headlines[i] || comp.brand,
    cta: i === 2 ? 'Shop Now' : 'Order Now',
    active_status: 'ACTIVE' as const,
    started_date: new Date(Date.now() - daysAgo[i] * 86400000).toISOString().slice(0, 10),
    publisher_platforms: ['Instagram', 'Facebook'],
    media_url: demoMediaUrl(comp, i),
    snapshot_url: comp.meta_ad_library_url,
    source: 'manual' as const,
    runtime_days: daysAgo[i],
    total_active_time: daysAgo[i] * 86400,
    has_multiple_versions: i === 0,
  }));

  return rankLibraryAds(raw);
}

export function withDemoLibraryFallback(
  intel: CompetitorIntel[],
  opts: { isDemo: boolean }
): CompetitorIntel[] {
  if (!opts.isDemo) return intel;

  return intel.map((comp) => {
    const hasLive =
      (comp.live_meta_ads?.length || 0) > 0 &&
      comp.live_meta_ads?.some((a) => a.source !== 'manual');
    if (hasLive) return comp;
    const demoAds = buildDemoLibraryAdsFromIntel(comp);
    return {
      ...comp,
      live_meta_ads: demoAds,
      meta_ads_count: demoAds.length,
      library_fetch_note:
        (comp.library_fetch_note ? `${comp.library_fetch_note} ` : '') +
        'Showing sample ads (preview placeholders). Click Refresh from Ad Library for live Meta creatives.',
    };
  });
}
