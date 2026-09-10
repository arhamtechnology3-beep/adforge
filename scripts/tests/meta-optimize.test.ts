/**
 * Deep unit + E2E-style contracts for Meta Optimize (P0–P2).
 * Run: npx tsx scripts/tests/meta-optimize.test.ts
 */
import assert from 'node:assert/strict';
import {
  CHECK_CATALOG,
  PILLAR_WEIGHTS,
  analyzeCreativeDiversity,
  creativeSimilarity,
  assessTrackingHealth,
  hashPii,
  hashPhoneE164,
  buildCapiPayload,
  estimateEmq,
  shopifyOrderToCapiPurchase,
  sendCapiEvents,
  analyzePerformanceV2,
  buildKillScaleLists,
  computeHealthScore,
  computePpcMath,
  breakEvenCpa,
  breakEvenRoas,
  budgetForPurchases,
  adviseBudget,
  scoreLandingPage,
  messageMatchScore,
  designAbTest,
  sampleSizePerArm,
  assessAttribution,
  recommendAttributionWindow,
  planAudiences,
  extractBrandDna,
  planPhotoshoot,
  buildAuditHtml,
  dryRunOptimizeAccount,
  runOptimizeSuite,
} from '../../src/lib/meta-optimize';
import { analyzePerformance } from '../../src/lib/ops-agent/rules';
import { dryRunCampaignMetrics, dryRunPriorCpa } from '../../src/lib/ops-agent/dry-run';

let passed = 0;
function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`  ✓ ${name}`);
    })
    .catch((err) => {
      console.error(`  ✗ ${name}`);
      throw err;
    });
}

async function main() {
  console.log('meta-optimize deep tests\n');

  await test('catalog has 25+ checks across 4 pillars', () => {
    assert.ok(CHECK_CATALOG.length >= 25);
    const pillars = new Set(CHECK_CATALOG.map((c) => c.pillar));
    assert.deepEqual([...pillars].sort(), ['audience', 'creative', 'structure', 'tracking']);
    const w = Object.values(PILLAR_WEIGHTS).reduce((s, x) => s + x, 0);
    assert.ok(Math.abs(w - 1) < 1e-9);
  });

  await test('creative diversity detects near-duplicates + fatigue', () => {
    const report = analyzeCreativeDiversity([
      {
        id: '1',
        name: 'A',
        format: 'carousel',
        headline: '8 jars for 599',
        primaryText: 'Family variety pack free shipping',
        spend: 100,
        ctr: 1,
        cpa: 80,
        frequency: 2,
        conceptCluster: 'bundle',
      },
      {
        id: '2',
        name: 'B',
        format: 'carousel',
        headline: '8 jars for 599',
        primaryText: 'Family variety pack free shipping today',
        spend: 100,
        ctr: 0.9,
        cpa: 90,
        frequency: 2.2,
        conceptCluster: 'bundle',
      },
      {
        id: '3',
        name: 'C',
        format: 'video',
        headline: 'Kitchen UGC',
        primaryText: 'Taste test at home',
        spend: 100,
        ctr: 0.5,
        cpa: 150,
        frequency: 4.0,
        conceptCluster: 'ugc',
      },
    ]);
    assert.ok(report.nearDuplicateGroups.length >= 1);
    assert.ok(report.fatigued.length >= 1);
    assert.ok(report.diversityScore >= 0 && report.diversityScore <= 100);
    assert.ok(creativeSimilarity(
      { id: '1', name: 'A', format: 'carousel', headline: 'same hook offer', primaryText: 'buy now pack', spend: 0, ctr: 1, cpa: null, frequency: 1 },
      { id: '2', name: 'B', format: 'carousel', headline: 'same hook offer', primaryText: 'buy now pack deal', spend: 0, ctr: 1, cpa: null, frequency: 1 }
    ) >= 0.5);
  });

  await test('tracking health penalizes missing CAPI + gap', () => {
    const bad = assessTrackingHealth(
      {
        pixelConnected: true,
        capiEnabled: false,
        emqScore: 5,
        dedupRate: 0.4,
        domainVerified: false,
        eventsSeen: ['ViewContent'],
        purchaseEvents7d: 0,
      },
      { spend: 800, clicks: 100, purchases: 0, addToCart: 0 }
    );
    assert.ok(bad.score < 60);
    assert.ok(bad.issues.some((i) => i.id === 'capi' || i.id === 'tracking_gap'));

    const good = assessTrackingHealth({
      pixelConnected: true,
      capiEnabled: true,
      emqScore: 9,
      dedupRate: 0.95,
      domainVerified: true,
      eventsSeen: ['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'],
      purchaseEvents7d: 12,
    });
    assert.ok(good.score >= 85);
    assert.equal(good.grade, 'A');
  });

  await test('CAPI hashing + Shopify order mapping + dry send', async () => {
    const em = hashPii('User@Email.COM');
    assert.equal(em, hashPii('user@email.com'));
    assert.ok(hashPhoneE164('9876543210')?.length === 64);

    const event = shopifyOrderToCapiPurchase({
      id: 555,
      order_number: 1001,
      email: 'buyer@example.com',
      phone: '9876543210',
      total_price: '499.00',
      currency: 'INR',
      customer: { id: 9, first_name: 'Ada', last_name: 'Lovelace' },
      billing_address: { city: 'Mumbai', province_code: 'MH', zip: '400001', country_code: 'IN' },
      line_items: [{ product_id: 11, quantity: 2 }],
      note_attributes: [{ name: '_fbp', value: 'fb.1.x' }],
    });
    assert.equal(event.eventName, 'Purchase');
    assert.equal(event.eventId, 'shopify_order_555');
    assert.equal(event.customData?.currency, 'INR');
    assert.ok((estimateEmq(event.userData) as number) >= 4);

    const payload = buildCapiPayload([event]);
    assert.equal(payload.data.length, 1);
    const ud = payload.data[0].user_data as Record<string, unknown>;
    assert.ok(Array.isArray(ud.em));

    const sent = await sendCapiEvents({
      pixelId: null,
      accessToken: null,
      events: [event],
    });
    assert.equal(sent.dryRun, true);
    assert.equal(sent.ok, true);
  });

  await test('Ops v2: 3× kill + 20% scale + learning protect', () => {
    const metrics = [
      {
        campaignId: 'win',
        campaignName: 'Winner',
        status: 'active',
        budget: 1000,
        spend: 900,
        impressions: 20000,
        clicks: 400,
        cpc: 2,
        cpm: 20,
        ctr: 2,
        cpa: 80,
        roas: 3,
        frequency: 2,
        purchases: 10,
        add_to_cart: 40,
        initiate_checkout: 20,
        conversion_rate: 2.5,
        video_views: 0,
        engagement_rate: null,
        revenue: 2700,
        reach: 10000,
      },
      {
        campaignId: 'lose',
        campaignName: 'Loser',
        status: 'active',
        budget: 800,
        spend: 700,
        impressions: 15000,
        clicks: 200,
        cpc: 3.5,
        cpm: 20,
        ctr: 1.3,
        cpa: 350,
        roas: 0.5,
        frequency: 2.5,
        purchases: 2,
        add_to_cart: 8,
        initiate_checkout: 3,
        conversion_rate: 1,
        video_views: 0,
        engagement_rate: null,
        revenue: 350,
        reach: 6000,
      },
      {
        campaignId: 'new',
        campaignName: 'Learning',
        status: 'active',
        budget: 300,
        spend: 80,
        impressions: 400,
        clicks: 10,
        cpc: 8,
        cpm: 40,
        ctr: 2.5,
        cpa: 200,
        roas: 0.2,
        frequency: 1.1,
        purchases: 0,
        add_to_cart: 0,
        initiate_checkout: 0,
        conversion_rate: null,
        video_views: 0,
        engagement_rate: null,
        revenue: 0,
        reach: 350,
      },
    ];
    const targets = { cpaTarget: 100, roasTarget: 2.5, dailyBudgetCap: 5000 };
    const recs = analyzePerformanceV2(metrics, targets, {
      new: [200, 210, 190],
    });
    assert.ok(recs.some((r) => r.type === 'scale_budget' && (r.proposed_action as { pct?: number }).pct === 20));
    assert.ok(recs.some((r) => r.type === 'kill_3x'));
    assert.ok(recs.some((r) => r.type === 'learning_protect'));

    const lists = buildKillScaleLists(metrics, targets);
    assert.ok(lists.killList.some((k) => k.id === 'lose'));
    assert.ok(lists.scaleList.some((k) => k.id === 'win'));

    // Wired into ops-agent
    const wired = analyzePerformance(dryRunCampaignMetrics(), targets, dryRunPriorCpa());
    assert.ok(wired.length >= 1);
  });

  await test('Health Score grades dry-run account', () => {
    const account = dryRunOptimizeAccount();
    const health = computeHealthScore(account);
    assert.ok(health.score >= 0 && health.score <= 100);
    assert.ok(['A', 'B', 'C', 'D', 'F'].includes(health.grade));
    assert.equal(Object.keys(health.pillars).length, 4);
    assert.ok(health.quickWins.length >= 1); // CAPI off etc.
  });

  await test('PPC math break-even + targets', () => {
    assert.equal(breakEvenCpa(500, 40), 200);
    assert.equal(breakEvenRoas(40), 2.5);
    const r = computePpcMath({
      aov: 500,
      marginPct: 40,
      adSpend: 1000,
      revenue: 2000,
      purchases: 4,
      ltv: 1500,
    });
    assert.equal(r.cpa, 250);
    assert.equal(r.roas, 2);
    assert.ok(r.targetCpa < r.breakEvenCpa);
    assert.ok(r.notes.length >= 1);
    assert.equal(budgetForPurchases(5, 100), 500);
  });

  await test('Budget advisor 70/20/10 + kill/scale actions', () => {
    const advice = adviseBudget({
      campaigns: dryRunOptimizeAccount().campaigns,
      targets: dryRunOptimizeAccount().targets,
      totalDailyBudget: 2000,
    });
    assert.equal(advice.allocation.prospectingPct, 70);
    assert.ok(['CBO', 'ABO', 'hybrid'].includes(advice.recommendedModel));
    assert.ok(advice.perCampaign.length >= 1);
  });

  await test('Landing score message match + penalties', () => {
    assert.ok(messageMatchScore('festive pickle offer free shipping', 'festive pickle jars free shipping india') > 40);
    const low = scoreLandingPage({
      url: 'http://example.com',
      adHeadline: 'Festive pickle combo',
      adPrimaryText: 'Free shipping today',
      pageTitle: 'Home',
      h1: 'Welcome',
      hasCta: false,
      mobileFriendly: false,
      loadTimeMs: 6000,
      hasTrustSignals: false,
      hasHttps: false,
      hasPixelHint: false,
    });
    assert.ok(low.score < 55);
    assert.ok(low.quickWins.length >= 2);

    const high = scoreLandingPage({
      url: 'https://example.com/pickles',
      adHeadline: 'Festive pickle combo',
      adPrimaryText: 'Free shipping today',
      pageTitle: 'Festive pickle combo — free shipping',
      h1: 'Festive pickle combo',
      hasCta: true,
      mobileFriendly: true,
      loadTimeMs: 1800,
      hasTrustSignals: true,
      hasHttps: true,
      hasPixelHint: true,
    });
    assert.ok(high.score >= 75);
  });

  await test('A/B planner sample size + duration', () => {
    const n = sampleSizePerArm(0.02, 0.2);
    assert.ok(n >= 100);
    const plan = designAbTest({
      hypothesis: {
        variable: 'creative',
        control: 'Packshot',
        variant: 'UGC hook',
        expectedLiftPct: 20,
      },
      baselineConversionRate: 0.02,
      dailyVisitors: 1000,
    });
    assert.ok(plan.sampleSizePerArm >= 100);
    assert.ok(plan.estimatedDays != null && plan.estimatedDays >= 1);
    assert.ok(plan.setupSteps.length >= 3);
    assert.equal(plan.status, 'planned');
  });

  await test('Attribution + audiences + brand DNA + photoshoot', () => {
    assert.equal(recommendAttributionWindow(2), '1d_click');
    assert.equal(recommendAttributionWindow(30), '28d_click_1d_view');
    const attr = assessAttribution({
      window: '7d_click_1d_view',
      dedupRate: 0.5,
      aemConfigured: false,
      cmpConsentRate: 0.4,
    });
    assert.ok(attr.score < 90);
    assert.ok(attr.recommendations.length >= 1);

    const aud = planAudiences({
      brandName: 'Demo',
      hasPurchasePixel: true,
      purchaseCount90d: 200,
    });
    assert.equal(aud.lookalikes.length, 3);
    assert.ok(aud.lookalikes.every((l) => l.ready));

    const dna = extractBrandDna({
      brandName: 'Green Jar',
      description: 'Organic natural ayurveda pickles for family',
      category: 'Food',
    });
    assert.ok(dna.voice.includes('natural') || dna.tone_keywords.length >= 1);
    assert.ok(dna.confidence > 0.4);

    const shoot = planPhotoshoot({
      productName: 'Mango Pickle',
      brandName: 'Green Jar',
    });
    assert.equal(shoot.styles.length, 5);
    assert.ok(shoot.styles.every((s) => s.prompt.includes('Mango Pickle')));
  });

  await test('Audit HTML + full suite orchestration', () => {
    const suite = runOptimizeSuite(dryRunOptimizeAccount());
    assert.ok(suite.health.score >= 0);
    assert.ok(suite.auditHtml.includes('Meta Ads Health Audit'));
    assert.ok(suite.auditHtml.includes('Grade'));
    assert.ok(suite.opsRecs.length >= 1);
    assert.ok(suite.photoshoot.styles.length === 5);
    assert.ok(suite.audiences.lookalikes.length === 3);
    const html = buildAuditHtml({
      brandName: 'Test',
      health: suite.health,
      tracking: suite.tracking,
      diversity: suite.diversity,
      budget: suite.budget,
      ppc: suite.ppc,
      attribution: suite.attribution,
    });
    assert.ok(html.includes('Kill list'));
  });

  await test('E2E path: dry account → suite → ops wire consistency', () => {
    const account = dryRunOptimizeAccount();
    const suite = runOptimizeSuite(account);
    // CAPI off should surface in tracking + health quick wins
    assert.equal(account.tracking.capiEnabled, false);
    assert.ok(suite.tracking.issues.some((i) => i.id === 'capi'));
    assert.ok(
      suite.health.quickWins.some((w) => w.id === 'M02' || w.pillar === 'tracking') ||
        suite.health.pillars.tracking.score < 100
    );
    // Fatigued creative on dry camp-2
    assert.ok(suite.diversity.fatigued.length >= 1 || suite.diversity.recommendations.length >= 1);
  });

  console.log(`\n${passed} meta-optimize tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
