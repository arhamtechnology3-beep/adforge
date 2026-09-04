import assert from 'node:assert/strict';
import type { CompetitorIntel, MetaAdLibraryAd } from '../../src/lib/ai';
import {
  buildDemoLibraryAdsFromIntel,
  withDemoLibraryFallback,
} from '../../src/lib/demo-competitor-ads';
import { extractAdsFromGraphqlPayload } from '../../src/lib/meta-ad-library-parse';

function competitor(liveMetaAds: MetaAdLibraryAd[] = []): CompetitorIntel {
  return {
    url: 'https://example.com',
    domain: 'example.com',
    brand: 'Example',
    title: 'Example Pickles',
    description: 'Small-batch pickles',
    hook: 'Traditional flavour',
    image: null,
    positioning: 'Homemade',
    counterAngle: 'Fresh batches',
    meta_ad_library_url:
      'https://www.facebook.com/ads/library/?view_all_page_id=123456789',
    meta_ads_count: liveMetaAds.length,
    live_meta_ads: liveMetaAds,
    website_scrape_ok: true,
    meta_page_id: '123456789',
  };
}

const parsedLiveAds = extractAdsFromGraphqlPayload({
  data: {
    collated_results: [
      {
        ad_archive_id: 'live-1',
        is_active: true,
        publisher_platform: ['FACEBOOK', 'INSTAGRAM'],
        start_date: 1_700_000_000,
        total_active_time: 86400,
        snapshot: {
          body: { text: 'A real Library response' },
          title: 'Live creative',
          images: [{ original_image_url: 'https://cdn.example/live.jpg' }],
        },
      },
    ],
  },
});

assert.equal(parsedLiveAds.length, 1);
assert.equal(
  parsedLiveAds[0].source,
  'web_library',
  'GraphQL-derived ads must be labeled as live web Library data'
);
assert.equal(
  parsedLiveAds[0].snapshot_url,
  'https://www.facebook.com/ads/library/?id=live-1'
);

const cachedLiveAd: MetaAdLibraryAd = {
  ...parsedLiveAds[0],
  id: 'cached-live',
  library_id: 'cached-live',
};
const cachedIntel = competitor([cachedLiveAd]);
cachedIntel.library_fetch_note =
  'Showing cached live Meta ads from 1/9/2026, 10:00:00 am.';

const preservedCached = withDemoLibraryFallback([cachedIntel], { isDemo: true });
assert.strictEqual(
  preservedCached[0],
  cachedIntel,
  'cached live Library ads should not be replaced by demo fallback'
);
assert.equal(preservedCached[0].live_meta_ads[0].source, 'web_library');
assert.match(preservedCached[0].library_fetch_note || '', /cached live Meta ads/);

const demoAds = buildDemoLibraryAdsFromIntel(competitor());
assert.equal(demoAds.length, 3);
assert.ok(
  demoAds.every(
    (item) =>
      item.source === 'manual' &&
      item.id.startsWith('demo_lib_') &&
      item.library_id.startsWith('demo')
  ),
  'demo placeholders must always carry manual provenance and demo identifiers'
);
assert.ok(
  demoAds.every((item) => item.source !== 'web_library' && item.source !== 'ad_library_api'),
  'demo placeholders must never masquerade as either live source'
);

const fallback = withDemoLibraryFallback([competitor()], { isDemo: true });
assert.ok(fallback[0].live_meta_ads.every((item) => item.source === 'manual'));
assert.match(
  fallback[0].library_fetch_note || '',
  /sample ads \(preview placeholders\)/,
  'fallback labeling should explicitly disclose sample placeholders'
);

const manualOnly = competitor([demoAds[0]]);
const replacedManualOnly = withDemoLibraryFallback([manualOnly], { isDemo: true });
assert.equal(
  replacedManualOnly[0].live_meta_ads.length,
  3,
  'manual-only data should not satisfy the live-data guard'
);
assert.ok(replacedManualOnly[0].live_meta_ads.every((item) => item.source === 'manual'));

const productionInput = [competitor()];
assert.strictEqual(
  withDemoLibraryFallback(productionInput, { isDemo: false }),
  productionInput,
  'demo fallback must be inert outside demo mode'
);

console.log('Step 1 source provenance and fallback contracts passed.');
