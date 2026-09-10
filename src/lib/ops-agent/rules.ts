import type { AgentTargets, CampaignMetrics, RecommendationDraft } from './types';
import { analyzePerformanceV2 } from '@/lib/meta-optimize/ops-v2';

/**
 * Ops performance rules — delegates to Optimize Ops v2
 * (3× kill, +20% scale, learning protect, fatigue, tracking gaps).
 */
export function analyzePerformance(
  metrics: CampaignMetrics[],
  targets: AgentTargets,
  priorDaysCpa?: Record<string, number[]>
): RecommendationDraft[] {
  return analyzePerformanceV2(metrics, targets, priorDaysCpa, { scalePct: 20 });
}
