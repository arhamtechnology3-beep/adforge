import assert from 'node:assert/strict';
import {
  buildAdLibraryUrl,
  resolveMetaPageId,
} from '../../src/lib/meta-ad-library';

const explicitPageId = '1234567890';
assert.equal(
  resolveMetaPageId({
    domain: 'farmdidi.com',
    metaPageId: `  ${explicitPageId}  `,
  }),
  explicitPageId,
  'a valid explicit Page ID should take precedence over domain lookup'
);

assert.equal(
  resolveMetaPageId({
    url: 'https://www.facebook.com/ads/library/?active_status=all&page_ids%5B0%5D=987654321',
  }),
  '987654321',
  'an encoded page_ids[0] parameter should resolve'
);

assert.equal(
  resolveMetaPageId({
    url: 'https://www.facebook.com/ads/library/?view_all_page_id=876543210',
  }),
  '876543210',
  'view_all_page_id should resolve'
);

assert.equal(
  resolveMetaPageId({ domain: 'www.FarmDidi.com' }),
  '108788791719221',
  'known competitor domains should resolve case-insensitively'
);
assert.equal(
  resolveMetaPageId({ url: 'https://farmdidi.com/products/mango-pickle' }),
  '108788791719221',
  'known competitor website URLs should resolve by hostname'
);
assert.equal(
  resolveMetaPageId({
    domain: 'unknown.example',
    metaPageId: 'not-a-page-id',
  }),
  null,
  'invalid and unknown inputs should not invent a Page ID'
);

const pageUrl = new URL(
  buildAdLibraryUrl({
    pageId: explicitPageId,
    country: 'IN',
    publisherPlatform: 'instagram',
  })
);
assert.equal(pageUrl.origin, 'https://www.facebook.com');
assert.equal(pageUrl.pathname, '/ads/library/');
assert.equal(pageUrl.searchParams.get('page_ids[0]'), explicitPageId);
assert.equal(pageUrl.searchParams.get('view_all_page_id'), explicitPageId);
assert.equal(pageUrl.searchParams.get('search_type'), 'page');
assert.equal(pageUrl.searchParams.get('publisher_platforms[0]'), 'instagram');
assert.equal(pageUrl.searchParams.get('sort_data[mode]'), 'total_impressions');
assert.equal(pageUrl.searchParams.get('sort_data[direction]'), 'desc');

const searchUrl = new URL(
  buildAdLibraryUrl({
    searchTerms: 'A "quoted" brand',
    country: 'US',
    sortByImpressions: false,
  })
);
assert.equal(searchUrl.searchParams.get('q'), '"A quoted brand"');
assert.equal(searchUrl.searchParams.get('search_type'), 'keyword_exact_phrase');
assert.equal(searchUrl.searchParams.get('country'), 'US');
assert.equal(searchUrl.searchParams.has('sort_data[mode]'), false);
assert.equal(searchUrl.searchParams.has('view_all_page_id'), false);

console.log('Step 1 Meta URL/Page ID resolution contracts passed.');
