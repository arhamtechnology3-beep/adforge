import { CHECK_CATALOG, PILLAR_WEIGHTS } from './check-catalog';
import { analyzeCreativeDiversity } from './creative-diversity';
import { buildKillScaleLists } from './ops-v2';
import { assessTrackingHealth } from './tracking-health';
import type {
  CheckResult,
  HealthScoreReport,
  OptimizeAccountInput,
  OptimizeCampaignInput,
  PillarId,
} from './types';
import type { CampaignMetrics } from '@/lib/ops-agent/types';

function gradeFrom(score: number): HealthScoreReport['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function toMetrics(c: OptimizeCampaignInput): CampaignMetrics {
  return {
    campaignId: c.id,
    campaignName: c.name,
    status: c.status,
    budget: c.dailyBudget,
    spend: c.spend,
    impressions: c.impressions,
    clicks: c.clicks,
    cpc: c.cpc,
    cpm: c.cpm,
    ctr: c.ctr,
    cpa: c.cpa,
    roas: c.roas,
    frequency: c.frequency,
    purchases: c.purchases,
    add_to_cart: c.addToCart,
    initiate_checkout: c.initiateCheckout,
    conversion_rate: c.conversionRate,
    video_views: 0,
    engagement_rate: null,
    revenue: c.revenue,
    reach: c.reach,
  };
}

function weightedAvg(results: CheckResult[]): number {
  const w = results.reduce((s, r) => s + r.weight, 0) || 1;
  return results.reduce((s, r) => s + r.score * r.weight, 0) / w;
}

function evalCheck(
  id: string,
  status: CheckResult['status'],
  score: number,
  evidence: string,
  recommendation?: string
): CheckResult {
  const base = CHECK_CATALOG.find((c) => c.id === id)!;
  return { ...base, status, score, evidence, recommendation };
}

export function computeHealthScore(account: OptimizeAccountInput): HealthScoreReport {
  const camps = account.campaigns.filter((c) => c.status === 'active');
  const allCamps = account.campaigns;
  const creatives = account.creatives;
  const diversity = analyzeCreativeDiversity(creatives);
  const spend = camps.reduce((s, c) => s + c.spend, 0);
  const clicks = camps.reduce((s, c) => s + c.clicks, 0);
  const purchases = camps.reduce((s, c) => s + c.purchases, 0);
  const atc = camps.reduce((s, c) => s + c.addToCart, 0);
  const tracking = assessTrackingHealth(account.tracking, {
    spend,
    clicks,
    purchases,
    addToCart: atc,
  });

  const avgFreq =
    camps.length === 0
      ? 0
      : camps.reduce((s, c) => s + c.frequency, 0) / camps.length;
  const avgCtr =
    camps.length === 0 ? 0 : camps.reduce((s, c) => s + c.ctr, 0) / camps.length;
  const totalImpr = camps.reduce((s, c) => s + c.impressions, 0);
  const totalReach = camps.reduce((s, c) => s + c.reach, 0);
  const cpaTarget = account.targets.cpaTarget || 100;

  const results: CheckResult[] = [];

  // Tracking
  results.push(
    evalCheck(
      'M01',
      account.tracking.pixelConnected ? 'pass' : 'fail',
      account.tracking.pixelConnected ? 100 : 0,
      account.tracking.pixelConnected
        ? `Pixel ${account.tracking.pixelId || 'connected'}`
        : 'No pixel',
      account.tracking.pixelConnected ? undefined : 'Connect Meta Pixel in Campaigns / Meta assets'
    )
  );
  results.push(
    evalCheck(
      'M02',
      account.tracking.capiEnabled ? 'pass' : 'fail',
      account.tracking.capiEnabled ? 100 : 10,
      account.tracking.capiEnabled ? 'CAPI on' : 'CAPI off',
      'Enable Shopify → Meta CAPI webhook'
    )
  );
  const emq = account.tracking.emqScore;
  results.push(
    evalCheck(
      'M03',
      emq != null && emq >= 8 ? 'pass' : emq == null ? 'na' : 'warn',
      emq == null ? 50 : Math.min(100, Math.round((emq / 10) * 100)),
      emq == null ? 'EMQ unknown' : `EMQ ${emq}`,
      'Send email/phone/fbp/fbc on Purchase'
    )
  );
  const dedup = account.tracking.dedupRate;
  results.push(
    evalCheck(
      'M04',
      dedup != null && dedup >= 0.9 ? 'pass' : dedup == null ? 'na' : 'fail',
      dedup == null ? 50 : Math.round(dedup * 100),
      dedup == null ? 'Dedup unknown' : `Dedup ${(dedup * 100).toFixed(0)}%`
    )
  );
  const p7 = account.tracking.purchaseEvents7d ?? 0;
  results.push(
    evalCheck(
      'M05',
      p7 > 0 ? 'pass' : 'fail',
      p7 > 0 ? 100 : 20,
      `Purchases 7d: ${p7}`
    )
  );
  const events = new Set(account.tracking.eventsSeen.map((e) => e.toLowerCase()));
  const core = ['viewcontent', 'addtocart', 'initiatecheckout', 'purchase'];
  const coreHit = core.filter((e) => events.has(e)).length;
  results.push(
    evalCheck(
      'M06',
      coreHit === 4 ? 'pass' : coreHit >= 2 ? 'warn' : 'fail',
      Math.round((coreHit / 4) * 100),
      `Core events ${coreHit}/4`
    )
  );
  results.push(
    evalCheck(
      'M07',
      account.tracking.domainVerified ? 'pass' : 'warn',
      account.tracking.domainVerified ? 100 : 40,
      account.tracking.domainVerified ? 'Domain verified' : 'Domain not verified'
    )
  );
  const gap = spend >= 500 && clicks >= 50 && purchases === 0 && atc === 0;
  results.push(
    evalCheck(
      'M08',
      gap ? 'fail' : 'pass',
      gap ? 0 : 100,
      gap ? 'Spend with zero conversions' : 'No tracking gap detected',
      gap ? 'Fix Pixel/CAPI immediately' : undefined
    )
  );

  // Creative
  results.push(
    evalCheck(
      'M25',
      diversity.formatCount >= 3 ? 'pass' : diversity.formatCount >= 2 ? 'warn' : 'fail',
      Math.min(100, diversity.formatCount * 34),
      `Formats: ${diversity.formats.join(', ') || 'none'}`
    )
  );
  results.push(
    evalCheck(
      'M26',
      diversity.conceptCount >= 3 ? 'pass' : 'warn',
      Math.min(100, diversity.conceptCount * 30),
      `Concepts: ${diversity.conceptCount}`
    )
  );
  results.push(
    evalCheck(
      'M27',
      diversity.fatigued.length === 0 ? 'pass' : 'fail',
      diversity.fatigued.length === 0 ? 100 : Math.max(0, 100 - diversity.fatigued.length * 25),
      `Fatigued creatives: ${diversity.fatigued.length}`
    )
  );
  results.push(
    evalCheck(
      'M28',
      diversity.nearDuplicateGroups.length === 0 ? 'pass' : 'warn',
      Math.max(0, 100 - diversity.nearDuplicateGroups.length * 30),
      `Near-dup groups: ${diversity.nearDuplicateGroups.length}`
    )
  );
  const withCopy = creatives.filter((c) => (c.headline || c.primaryText)?.trim()).length;
  results.push(
    evalCheck(
      'M29',
      creatives.length === 0 ? 'na' : withCopy / creatives.length >= 0.8 ? 'pass' : 'warn',
      creatives.length === 0 ? 50 : Math.round((withCopy / creatives.length) * 100),
      `${withCopy}/${creatives.length} with copy`
    )
  );
  results.push(
    evalCheck(
      'M30',
      creatives.length >= 4 ? 'pass' : creatives.length >= 2 ? 'warn' : 'fail',
      Math.min(100, creatives.length * 25),
      `Active creatives: ${creatives.length}`
    )
  );

  // Structure
  const learningLimited = camps.filter((c) => c.learningLimited).length;
  results.push(
    evalCheck(
      'M11',
      learningLimited === 0 ? 'pass' : 'warn',
      camps.length === 0 ? 50 : Math.round((1 - learningLimited / camps.length) * 100),
      `Learning-limited: ${learningLimited}`
    )
  );
  const budgetOk = camps.filter(
    (c) => c.dailyBudget != null && c.dailyBudget >= cpaTarget * 2
  ).length;
  results.push(
    evalCheck(
      'M12',
      camps.length === 0 ? 'na' : budgetOk === camps.length ? 'pass' : 'warn',
      camps.length === 0 ? 50 : Math.round((budgetOk / camps.length) * 100),
      `Budgets ≥ 2× CPA: ${budgetOk}/${camps.length || 0}`
    )
  );
  const typed = camps.filter((c) => c.budgetType && c.budgetType !== 'unknown').length;
  results.push(
    evalCheck(
      'M13',
      typed > 0 || camps.length === 0 ? 'pass' : 'na',
      typed > 0 || camps.length === 0 ? 100 : 60,
      `Known budget types: ${typed}`
    )
  );
  const { killList, scaleList } = buildKillScaleLists(
    allCamps.map(toMetrics),
    {
      cpaTarget: account.targets.cpaTarget,
      roasTarget: account.targets.roasTarget,
      dailyBudgetCap: account.targets.dailyBudgetCap,
    }
  );
  results.push(
    evalCheck('M14', 'pass', killList.length ? 70 : 100, `Kill candidates: ${killList.length}`)
  );
  results.push(
    evalCheck(
      'M15',
      scaleList.length > 0 ? 'pass' : 'info' as CheckResult['status'],
      scaleList.length > 0 ? 100 : 60,
      `Scale candidates: ${scaleList.length}`
    )
  );
  // fix status 'info' - CheckStatus doesn't include info, use 'na' or 'warn'
  results[results.length - 1].status = scaleList.length > 0 ? 'pass' : 'na';

  const pacingBad = camps.filter((c) => {
    if (!c.dailyBudget || c.dailyBudget <= 0) return false;
    const r = c.spend / c.dailyBudget;
    return r > 1.15 || (r < 0.4 && c.impressions > 500);
  }).length;
  results.push(
    evalCheck(
      'M16',
      pacingBad === 0 ? 'pass' : 'warn',
      camps.length === 0 ? 50 : Math.round((1 - pacingBad / camps.length) * 100),
      `Pacing issues: ${pacingBad}`
    )
  );
  const activeCount = camps.length;
  const fragOk = activeCount >= 1 && activeCount <= 6;
  results.push(
    evalCheck(
      'M17',
      activeCount === 0 ? 'na' : fragOk ? 'pass' : 'warn',
      activeCount === 0 ? 50 : fragOk ? 100 : 40,
      `Active campaigns: ${activeCount}`
    )
  );

  // Audience
  results.push(
    evalCheck(
      'M19',
      avgFreq < 3.5 ? 'pass' : 'fail',
      avgFreq === 0 ? 50 : Math.max(0, Math.round(100 - Math.max(0, avgFreq - 2) * 30)),
      `Avg frequency: ${avgFreq.toFixed(2)}`
    )
  );
  const excl = camps.some((c) => c.hasExclusions);
  results.push(
    evalCheck(
      'M20',
      excl ? 'pass' : 'warn',
      excl ? 100 : 45,
      excl ? 'Exclusions present' : 'No purchaser exclusions detected'
    )
  );
  const lal = camps.some((c) => c.hasLookalike);
  results.push(
    evalCheck(
      'M21',
      lal ? 'pass' : 'warn',
      lal ? 100 : 50,
      lal ? 'Lookalike present' : 'No lookalike — consider purchasers 1%'
    )
  );
  results.push(
    evalCheck(
      'M22',
      avgCtr >= 0.6 ? 'pass' : avgCtr > 0 ? 'warn' : 'na',
      avgCtr === 0 ? 50 : Math.min(100, Math.round((avgCtr / 0.6) * 70)),
      `Avg CTR: ${avgCtr.toFixed(2)}%`
    )
  );
  const attrSet = camps.some((c) => !!c.attributionWindow);
  results.push(
    evalCheck(
      'M23',
      attrSet ? 'pass' : 'na',
      attrSet ? 100 : 70,
      attrSet ? 'Attribution window set' : 'Attribution window not recorded'
    )
  );
  const reachRatio = totalImpr > 0 ? totalReach / totalImpr : 1;
  results.push(
    evalCheck(
      'M24',
      reachRatio >= 0.25 ? 'pass' : 'warn',
      Math.min(100, Math.round(reachRatio * 200)),
      `Reach/impr ratio: ${reachRatio.toFixed(2)}`
    )
  );

  const pillars = {} as HealthScoreReport['pillars'];
  for (const pillar of Object.keys(PILLAR_WEIGHTS) as PillarId[]) {
    const checks = results.filter((r) => r.pillar === pillar);
    pillars[pillar] = {
      score: Math.round(weightedAvg(checks)),
      weight: PILLAR_WEIGHTS[pillar],
      checks,
    };
  }

  const score = Math.round(
    (Object.keys(PILLAR_WEIGHTS) as PillarId[]).reduce(
      (s, p) => s + pillars[p].score * PILLAR_WEIGHTS[p],
      0
    )
  );

  const failed = results.filter((r) => r.status === 'fail' || r.status === 'warn');
  const quickWins = failed
    .filter((r) => r.severity === 'critical' || r.severity === 'high')
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);

  // Blend tracking module score lightly into evidence (already in checks)
  void tracking;

  return {
    score,
    grade: gradeFrom(score),
    pillars,
    quickWins,
    killList: killList.map((k) => ({
      id: k.id,
      name: k.name,
      reason: k.reason,
      metric: k.metric,
    })),
    scaleList: scaleList.map((k) => ({
      id: k.id,
      name: k.name,
      reason: k.reason,
      nextBudget: k.nextBudget,
    })),
    generatedAt: new Date().toISOString(),
  };
}
