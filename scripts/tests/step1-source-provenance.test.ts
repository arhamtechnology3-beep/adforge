import assert from 'node:assert/strict';
import type { CompetitorIntel, MetaAdLibraryAd } from '../../src/lib/ai';
import {
  buildDemoLibraryAdsFromIntel,
  withDemoLibraryFallback,
} from '../../src/lib/demo-competitor-ads';
import { extractAdsFromGraphqlPayload } from '../../src/lib/meta-ad-library-parse';
import {
  applyCompetitorLibraryCache,
  competitorLibraryKey,
} from '../../src/lib/competitor-library-cache';

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

assert.equal(
  competitorLibraryKey({ meta_page_id: '108788791719221', domain: 'farmdidi.com' }),
  'page:108788791719221'
);
assert.equal(
  competitorLibraryKey({ domain: 'www.acme.in', url: 'https://acme.in' }),
  'domain:acme.in'
);

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
assert.equal(
  preservedCached[0].live_meta_ads.length,
  1,
  'cached live Library ads should not be replaced by demo fallback'
);
assert.equal(preservedCached[0].live_meta_ads[0].source, 'web_library');
assert.match(preservedCached[0].library_fetch_note || '', /cached live Meta ads/);
assert.equal(preservedCached[0].live_meta_ads[0].id, 'cached-live');

const demoAds = buildDemoLibraryAdsFromIntel(competitor());
assert.equal(demoAds.length, 5);
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
  5,
  'manual-only data should not satisfy the live-data guard'
);
assert.ok(replacedManualOnly[0].live_meta_ads.every((item) => item.source === 'manual'));

const productionSoft = withDemoLibraryFallback([competitor()], { isDemo: false });
assert.equal(productionSoft[0].live_meta_ads.length, 5);
assert.ok(productionSoft[0].live_meta_ads.every((item) => item.source === 'manual'));
assert.match(
  productionSoft[0].library_fetch_note || '',
  /no previous ads are saved/,
  'production soft fallback must disclose placeholders after empty live+cache'
);

// Persist live → empty live restores previous (demo file cache)
async function assertLibraryCacheRoundTrip() {
  const demoUser = `test-provenance-${Date.now()}`;
  const liveOnce = await applyCompetitorLibraryCache(
    demoUser,
    [
      {
        ...competitor(parsedLiveAds),
        library_fetch_note: 'Loaded 1 live Ad Library creatives.',
      },
    ],
    { isDemo: true }
  );
  assert.equal(liveOnce[0].live_meta_ads[0].source, 'web_library');

  const restorePrevious = await applyCompetitorLibraryCache(
    demoUser,
    [
      {
        ...competitor([]),
        library_fetch_note: 'Live Ad Library fetch returned none.',
      },
    ],
    { isDemo: true }
  );
  assert.equal(restorePrevious[0].live_meta_ads.length, 1);
  assert.equal(restorePrevious[0].live_meta_ads[0].source, 'web_library');
  assert.match(
    restorePrevious[0].library_fetch_note || '',
    /previous Ad Library ads saved/,
    'empty live must restore previous ads for that competitor URL'
  );
}

assertLibraryCacheRoundTrip()
  .then(() => {
    console.log('Step 1 source provenance and fallback contracts passed.');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
