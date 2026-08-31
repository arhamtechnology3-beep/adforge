/**
 * End-to-end unit tests for campaign validation and Meta field mapping.
 * Run: npx tsx scripts/e2e-campaign.test.ts
 */

import { validateCampaignLaunch } from '../src/lib/campaign-validation';
import {
  buildPlacementSpec,
  getObjectiveConfig,
  genderToMetaGenders,
} from '../src/lib/meta-campaign';
import { buildTargetingSpec, resolveTargeting } from '../src/lib/meta-targeting';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

async function run() {
  console.log('\n=== Campaign Validation E2E ===\n');

  // Valid launch
  const valid = validateCampaignLaunch({
    input: {
      name: 'Test Campaign',
      objective: 'OUTCOME_TRAFFIC',
      budget: 500,
      website_url: 'https://example.com',
      ad_ids: ['ad-1'],
      cta: 'SHOP_NOW',
      audience: { age_min: 18, age_max: 65 },
    },
    ads: [
      {
        id: 'ad-1',
        copy_text: 'Shop now for great deals',
        headline: 'Best Deals',
        image_url: 'https://example.com/img.jpg',
        status: 'approved',
      },
    ],
    meta_connected: true,
    has_pixel: false,
    page_id: '123456',
  });
  assert(valid.can_launch === true, 'Valid campaign can launch');
  assert(valid.errors.length === 0, 'No validation errors');

  // Missing name
  const noName = validateCampaignLaunch({
    input: { budget: 500, objective: 'OUTCOME_TRAFFIC', website_url: 'https://x.com', ad_ids: [] },
    ads: [],
  });
  assert(noName.can_launch === false, 'Missing name blocks launch');
  assert(noName.errors.some((e) => e.includes('name')), 'Name error reported');

  // Budget too low
  const lowBudget = validateCampaignLaunch({
    input: {
      name: 'Test',
      objective: 'OUTCOME_TRAFFIC',
      budget: 50,
      website_url: 'https://example.com',
      ad_ids: ['ad-1'],
    },
    ads: [
      { id: 'ad-1', copy_text: 'x', headline: 'h', image_url: 'https://x.com/i.jpg', status: 'approved' },
    ],
  });
  assert(lowBudget.can_launch === false, 'Low budget blocks launch');

  // Invalid URL
  const badUrl = validateCampaignLaunch({
    input: {
      name: 'Test',
      objective: 'OUTCOME_TRAFFIC',
      budget: 500,
      website_url: 'not-a-url',
      ad_ids: ['ad-1'],
    },
    ads: [
      { id: 'ad-1', copy_text: 'x', headline: 'h', image_url: 'https://x.com/i.jpg', status: 'approved' },
    ],
  });
  assert(badUrl.can_launch === false, 'Invalid URL blocks launch');

  // Headline too long
  const longHeadline = validateCampaignLaunch({
    input: {
      name: 'Test',
      objective: 'OUTCOME_TRAFFIC',
      budget: 500,
      website_url: 'https://example.com',
      ad_ids: ['ad-1'],
    },
    ads: [
      {
        id: 'ad-1',
        copy_text: 'x',
        headline: 'A'.repeat(50),
        image_url: 'https://x.com/i.jpg',
        status: 'approved',
      },
    ],
  });
  assert(longHeadline.can_launch === false, 'Long headline blocks launch');

  console.log('\n=== Meta Field Mapping ===\n');

  const traffic = getObjectiveConfig('OUTCOME_TRAFFIC');
  assert(traffic.optimization_goal === 'LINK_CLICKS', 'Traffic → LINK_CLICKS');

  const sales = getObjectiveConfig('OUTCOME_SALES');
  assert(sales.optimization_goal === 'OFFSITE_CONVERSIONS', 'Sales → OFFSITE_CONVERSIONS');

  const awareness = getObjectiveConfig('OUTCOME_AWARENESS');
  assert(awareness.optimization_goal === 'REACH', 'Awareness → REACH');

  const genders = genderToMetaGenders('WOMEN');
  assert(genders?.[0] === 2, 'WOMEN → gender 2');

  const placements = buildPlacementSpec({
    reels: true,
    ig_feed: true,
    fb_feed: true,
    stories: false,
  });
  assert(placements.publisher_platforms?.includes('instagram'), 'Placements include instagram');
  assert(placements.instagram_positions?.includes('reels'), 'Reels placement mapped');

  console.log('\n=== Targeting Resolution ===\n');

  const resolved = await resolveTargeting(['Mumbai', 'Delhi'], ['Online shopping']);
  assert(resolved.cities.length >= 2, 'Known cities resolved');
  assert(resolved.interests.length >= 1, 'Known interests resolved');

  const targeting = buildTargetingSpec({
    countries: ['IN'],
    age_min: 18,
    age_max: 45,
    cities: resolved.cities,
    interests: resolved.interests,
    placements,
  });
  assert(
    (targeting.geo_locations as any).countries[0] === 'IN',
    'Country targeting set'
  );
  assert(
    Array.isArray((targeting as any).flexible_spec),
    'Interest flexible_spec built'
  );

  console.log('\n=== Campaign Templates ===\n');
  const { CAMPAIGN_TEMPLATES, getCampaignTemplate } = await import('../src/lib/campaign-templates');
  assert(CAMPAIGN_TEMPLATES.length >= 5, 'At least 5 templates defined');
  const festive = getCampaignTemplate('festive-sale');
  assert(festive?.objective === 'OUTCOME_SALES', 'Festive template is Sales objective');
  assert(festive?.budget === 1500, 'Festive template budget set');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
