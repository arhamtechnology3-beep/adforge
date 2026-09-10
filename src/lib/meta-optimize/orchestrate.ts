import { adviseBudget } from './budget-advisor';
import { analyzeCreativeDiversity } from './creative-diversity';
import { computeHealthScore } from './health-score';
import { assessTrackingHealth } from './tracking-health';
import { computePpcMath } from './ppc-math';
import { assessAttribution } from './attribution';
import { planAudiences } from './audiences';
import { extractBrandDna } from './brand-dna';
import { planPhotoshoot } from './photoshoot';
import { buildAuditHtml } from './audit-report';
import { analyzePerformanceV2, buildKillScaleLists } from './ops-v2';
import type { OptimizeAccountInput } from './types';
import type { CampaignMetrics } from '@/lib/ops-agent/types';

function toOpsMetrics(account: OptimizeAccountInput): CampaignMetrics[] {
  return account.campaigns.map((c) => ({
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
  }));
}

/** Full optimize suite for one account snapshot. */
export function runOptimizeSuite(account: OptimizeAccountInput) {
  const health = computeHealthScore(account);
  const diversity = analyzeCreativeDiversity(account.creatives);
  const spend = account.campaigns.reduce((s, c) => s + c.spend, 0);
  const clicks = account.campaigns.reduce((s, c) => s + c.clicks, 0);
  const purchases = account.campaigns.reduce((s, c) => s + c.purchases, 0);
  const atc = account.campaigns.reduce((s, c) => s + c.addToCart, 0);
  const revenue = account.campaigns.reduce((s, c) => s + c.revenue, 0);
  const impressions = account.campaigns.reduce((s, c) => s + c.impressions, 0);

  const tracking = assessTrackingHealth(account.tracking, {
    spend,
    clicks,
    purchases,
    addToCart: atc,
  });

  const budget = adviseBudget({
    campaigns: account.campaigns,
    targets: account.targets,
  });

  const aov =
    account.targets.aov || (purchases > 0 ? revenue / purchases : 499);
  const marginPct = account.targets.marginPct ?? 40;
  const ppc = computePpcMath({
    aov,
    marginPct,
    adSpend: spend,
    revenue,
    purchases,
    clicks,
    impressions,
    ltv: account.targets.ltv,
  });

  const attribution = assessAttribution({
    window: account.campaigns.find((c) => c.attributionWindow)?.attributionWindow,
    dedupRate: account.tracking.dedupRate,
    aemConfigured: account.tracking.domainVerified,
  });

  const audiences = planAudiences({
    brandName: account.brandName,
    hasPurchasePixel: account.tracking.pixelConnected,
    purchaseCount90d: Math.max(purchases * 12, purchases),
  });

  const brandDna = extractBrandDna({
    brandName: account.brandName,
    websiteUrl: account.websiteUrl,
  });

  const photoshoot = planPhotoshoot({
    productName: account.brandName || 'Product',
    brandName: account.brandName || 'Brand',
  });

  const opsRecs = analyzePerformanceV2(
    toOpsMetrics(account),
    {
      cpaTarget: account.targets.cpaTarget ?? ppc.targetCpa,
      roasTarget: account.targets.roasTarget ?? ppc.targetRoas,
      dailyBudgetCap: account.targets.dailyBudgetCap,
    },
    account.priorDaysCpa,
    { scalePct: 20 }
  );

  const killScale = buildKillScaleLists(toOpsMetrics(account), {
    cpaTarget: account.targets.cpaTarget ?? ppc.targetCpa,
    roasTarget: account.targets.roasTarget ?? ppc.targetRoas,
    dailyBudgetCap: account.targets.dailyBudgetCap,
  });

  const auditHtml = buildAuditHtml({
    brandName: account.brandName,
    health,
    tracking,
    diversity,
    budget,
    ppc,
    attribution,
  });

  return {
    health,
    tracking,
    diversity,
    budget,
    ppc,
    attribution,
    audiences,
    brandDna,
    photoshoot,
    opsRecs,
    killScale,
    auditHtml,
  };
}
