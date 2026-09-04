import assert from 'node:assert/strict';
import type { MetaAdLibraryAd } from '../../src/lib/ai';
import {
  performanceBadgeClass,
  rankLibraryAds,
} from '../../src/lib/ad-performance';

function ad(
  libraryId: string,
  overrides: Partial<MetaAdLibraryAd> = {}
): MetaAdLibraryAd {
  return {
    id: `lib_${libraryId}`,
    library_id: libraryId,
    ad_format: 'single_image',
    primary_text: `Primary text ${libraryId}`,
    headline: `Headline ${libraryId}`,
    cta: 'Shop Now',
    active_status: 'ACTIVE',
    started_date: null,
    publisher_platforms: ['Facebook'],
    source: 'web_library',
    ...overrides,
  };
}

const input = [
  ad('first', { runtime_days: 1 }),
  ad('durable', { runtime_days: 30, total_active_time: 30 * 86400 }),
  ad('newest', { runtime_days: 0 }),
  ad('multi-platform', {
    runtime_days: 60,
    total_active_time: 60 * 86400,
    has_multiple_versions: true,
    publisher_platforms: ['Facebook', 'Instagram'],
  }),
];

const ranked = rankLibraryAds(input);

assert.deepEqual(
  ranked.map((item) => item.library_id),
  input.map((item) => item.library_id),
  'ranking should preserve Meta Library collection order'
);
assert.deepEqual(
  ranked.map((item) => item.library_rank),
  [1, 2, 3, 4],
  'Library rank should reflect collection order'
);
assert.equal(
  ranked.find((item) => item.library_id === 'durable')?.performance_rating,
  'WINNER',
  'the strongest score should receive the winner badge'
);
assert.equal(
  ranked.find((item) => item.library_id === 'newest')?.performance_rating,
  'TESTING',
  'a low-signal new creative should remain testing'
);
assert.match(
  ranked[0].performance_reason || '',
  /#1 in Library/,
  'top collection positions should explain their Library rank'
);
assert.match(
  ranked[3].performance_reason || '',
  /Running 60d/,
  'sustained runtime should be included in the explanation'
);
assert.ok(
  ranked.every(
    (item) =>
      (item.performance_score || 0) >= 10 &&
      (item.performance_score || 0) <= 99
  ),
  'performance scores should remain in the documented 10–99 range'
);
assert.notStrictEqual(ranked[0], input[0], 'ranking should not mutate ad objects');
assert.equal(input[0].library_rank, undefined, 'input fixtures should stay untouched');

assert.equal(performanceBadgeClass('WINNER'), 'bg-amber-500 text-white');
assert.equal(performanceBadgeClass('SCALING'), 'bg-emerald-600 text-white');
assert.equal(performanceBadgeClass('TESTING'), 'bg-slate-600 text-white');

console.log('Step 1 ranking contracts passed.');
