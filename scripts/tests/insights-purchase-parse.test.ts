/**
 * Website purchase mapping + order-goal math (no Meta network).
 * Run: npx tsx scripts/tests/insights-purchase-parse.test.ts
 */
import assert from 'node:assert/strict';
import { parseInsightsPayload, prioritizedActionValue } from '../../src/lib/meta';
import { budgetForPurchases } from '../../src/lib/meta-optimize/ppc-math';
import { analyzePerformanceV2, buildKillScaleLists } from '../../src/lib/meta-optimize/ops-v2';
import type { CampaignMetrics } from '../../src/lib/ops-agent/types';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log('insights-purchase-parse');

test('prefers fb_pixel_purchase over omni_purchase', () => {
  const actions = [
    { action_type: 'omni_purchase', value: '5' },
    { action_type: 'offsite_conversion.fb_pixel_purchase', value: '1' },
  ];
  assert.equal(
    prioritizedActionValue(actions, [
      'offsite_conversion.fb_pixel_purchase',
      'omni_purchase',
      'purchase',
    ]),
    1
  );
});

test('parseInsightsPayload maps Website Purchases + revenue', () => {
  const parsed = parseInsightsPayload({
    spend: '7601.73',
    impressions: '18198',
    clicks: '100',
    ctr: '0.5',
    cpc: '76',
    cpm: '400',
    frequency: '1.2',
    reach: '10000',
    actions: [
      { action_type: 'link_click', value: '80' },
      { action_type: 'omni_purchase', value: '3' },
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '1' },
    ],
    action_values: [
      { action_type: 'omni_purchase', value: '1500' },
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '599' },
    ],
    date_start: '2026-10-16',
  });
  assert.ok(parsed);
  assert.equal(parsed!.purchases, 1);
  assert.equal(parsed!.revenue, 599);
  assert.ok(parsed!.cost_per_purchase != null && parsed!.cost_per_purchase > 7000);
});

test('zero-purchase spend floor recommends pause', () => {
  const metrics: CampaignMetrics[] = [
    {
      campaignId: 'dead',
      campaignName: 'Navratri zero',
      status: 'active',
      budget: 500,
      spend: 1948,
      impressions: 7275,
      clicks: 92,
      cpc: 21,
      cpm: 268,
      ctr: 1.2,
      cpa: null,
      roas: null,
      frequency: 1.5,
      purchases: 0,
      add_to_cart: 0,
      initiate_checkout: 0,
      conversion_rate: null,
      video_views: 0,
      engagement_rate: null,
      revenue: 0,
      reach: 5000,
    },
  ];
  const targets = { cpaTarget: 300, roasTarget: 2, dailyBudgetCap: 5000 };
  const recs = analyzePerformanceV2(metrics, targets);
  assert.ok(recs.some((r) => r.type === 'kill_zero_purchase'));
  const lists = buildKillScaleLists(metrics, targets);
  assert.ok(lists.killList.some((k) => k.id === 'dead'));
});

test('budgetForPurchases for 5 and 10 orders/day', () => {
  assert.equal(budgetForPurchases(5, 300), 1500);
  assert.equal(budgetForPurchases(10, 300), 3000);
});

console.log('All insights-purchase-parse tests passed');
