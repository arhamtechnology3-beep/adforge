import { analyzePerformance } from './rules';
import { dryRunCampaignMetrics, dryRunCreatives, dryRunPriorCpa } from './dry-run';
import { scanCreativesForPolicy } from './policy/pack';
import type { AgentTargets, CampaignMetrics, CreativeRow, RecommendationDraft } from './types';

export function runOpsAnalysis(input: {
  metrics?: CampaignMetrics[];
  creatives?: CreativeRow[];
  targets?: AgentTargets;
  priorDaysCpa?: Record<string, number[]>;
  metaStatuses?: Array<{ adId: string; effective_status?: string }>;
  useDryRun?: boolean;
}): {
  recommendations: RecommendationDraft[];
  metrics: CampaignMetrics[];
  creatives: CreativeRow[];
  dryRun: boolean;
} {
  const dryRun = input.useDryRun ?? (!input.metrics || input.metrics.length === 0);
  const metrics = dryRun ? dryRunCampaignMetrics() : input.metrics!;
  const creatives = input.creatives?.length ? input.creatives : dryRun ? dryRunCreatives() : [];
  const targets: AgentTargets = input.targets || {
    cpaTarget: 100,
    roasTarget: 2,
    dailyBudgetCap: 2000,
  };
  const prior = input.priorDaysCpa || (dryRun ? dryRunPriorCpa() : {});

  const perf = analyzePerformance(metrics, targets, prior);
  const policyHits = scanCreativesForPolicy(creatives, undefined, input.metaStatuses);
  const policyRecs = policyHits.map((h) => h.recommendation);

  return {
    recommendations: [...policyRecs, ...perf],
    metrics,
    creatives,
    dryRun,
  };
}

export { analyzePerformance } from './rules';
export { scanCreativesForPolicy, POLICY_PACK_V1 } from './policy/pack';
export { META_POLICY_PACK_VERSION } from './types';
export * from './dry-run';
export * from './types';
