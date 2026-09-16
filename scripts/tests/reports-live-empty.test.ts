/**
 * Trust check: live Meta-linked reports must never invent sample spend.
 * Run: npx tsx scripts/tests/reports-live-empty.test.ts
 */
import assert from 'node:assert/strict';
import { buildReport } from '../../src/lib/reports/build';

const sample = buildReport({
  view: 'executive',
  forceDryRun: true,
  liveMetaLinked: false,
});
assert.equal(sample.dryRun, true);
assert.match(String(sample.chips?.[0] || ''), /Sample data/i);
assert.match(String(sample.kpis.find((k) => k.label === 'Spend')?.value || ''), /13/);

const liveEmpty = buildReport({
  view: 'executive',
  snapshots: [],
  campaigns: [{ id: 'c1', name: 'Sales · Prospecting · 16/9/2026', budget: 1000, status: 'active' }],
  liveMetaLinked: true,
  forceDryRun: true, // must be ignored when liveMetaLinked
});
assert.equal(liveEmpty.dryRun, false);
assert.match(String(liveEmpty.chips?.[0] || ''), /Live Meta/i);
assert.equal(liveEmpty.kpis.find((k) => k.label === 'Spend')?.value, '₹0');
assert.doesNotMatch(JSON.stringify(liveEmpty), /Festive Pickles|UGC Stories/);

const liveZero = buildReport({
  view: 'executive',
  liveMetaLinked: true,
  campaigns: [{ id: 'c1', name: 'Sales · Prospecting', budget: 1000, status: 'active' }],
  snapshots: [
    {
      id: 's1',
      meta_campaign_id: 'c1',
      date: '2026-09-16',
      spend: 0,
      revenue: 0,
      purchases: 0,
      impressions: 0,
      clicks: 0,
      cpc: 0,
      cpa: 0,
      ctr: 0,
      cpm: 0,
      frequency: 0,
      reach: 0,
      add_to_cart: 0,
      initiate_checkout: 0,
      cost_per_purchase: 0,
      roas: 0,
      conversion_rate: 0,
      video_views: 0,
      engagement_rate: 0,
      raw_insights: {},
      breakdowns: {},
    } as never,
  ],
});
assert.equal(liveZero.dryRun, false);
assert.match(String(liveZero.chips?.[0] || ''), /₹0 spend/i);
assert.equal(liveZero.kpis.find((k) => k.label === 'Spend')?.value, '₹0');

console.log('reports-live-empty trust tests passed');
