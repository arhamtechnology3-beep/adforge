import type { OptimizeCheck, PillarId } from './types';

/** Canonical Meta check catalog (subset of 50+ weighted checks used for Health Score). */
export const CHECK_CATALOG: OptimizeCheck[] = [
  // Tracking 30%
  { id: 'M01', pillar: 'tracking', title: 'Pixel connected', description: 'Meta Pixel linked to ad account', weight: 8, severity: 'critical' },
  { id: 'M02', pillar: 'tracking', title: 'CAPI enabled', description: 'Conversions API server events active', weight: 10, severity: 'critical' },
  { id: 'M03', pillar: 'tracking', title: 'EMQ ≥ 8', description: 'Event Match Quality for Purchase', weight: 8, severity: 'high' },
  { id: 'M04', pillar: 'tracking', title: 'Dedup ≥ 90%', description: 'Pixel+CAPI event_id deduplication', weight: 6, severity: 'high' },
  { id: 'M05', pillar: 'tracking', title: 'Purchase events firing', description: 'Purchase seen in last 7 days', weight: 5, severity: 'high' },
  { id: 'M06', pillar: 'tracking', title: 'Core funnel events', description: 'ViewContent, ATC, InitiateCheckout present', weight: 4, severity: 'medium' },
  { id: 'M07', pillar: 'tracking', title: 'Domain verified', description: 'Business Manager domain verification', weight: 3, severity: 'medium' },
  { id: 'M08', pillar: 'tracking', title: 'Tracking gap vs spend', description: 'Spend/clicks with zero ATC/Purchase', weight: 6, severity: 'critical' },

  // Creative 30%
  { id: 'M25', pillar: 'creative', title: 'Format diversity', description: '≥3 formats live (image/carousel/stories/video)', weight: 8, severity: 'high' },
  { id: 'M26', pillar: 'creative', title: 'Concept diversity', description: 'Distinct concept clusters (≥3)', weight: 10, severity: 'critical' },
  { id: 'M27', pillar: 'creative', title: 'Fatigue control', description: 'No creatives with freq≥3.5 and soft CTR', weight: 8, severity: 'high' },
  { id: 'M28', pillar: 'creative', title: 'Near-duplicate risk', description: 'Similarity clusters not dominating spend', weight: 7, severity: 'high' },
  { id: 'M29', pillar: 'creative', title: 'Hook/copy present', description: 'Headline + primary text on ads', weight: 3, severity: 'medium' },
  { id: 'M30', pillar: 'creative', title: 'Creative volume', description: '≥4 active creatives for learning', weight: 4, severity: 'medium' },

  // Structure 20%
  { id: 'M11', pillar: 'structure', title: 'Learning health', description: 'Campaigns not stuck learning-limited', weight: 6, severity: 'high' },
  { id: 'M12', pillar: 'structure', title: 'Budget sufficiency', description: 'Daily budget ≥ 2× CPA target', weight: 5, severity: 'high' },
  { id: 'M13', pillar: 'structure', title: 'CBO/ABO clarity', description: 'Budget type set intentionally', weight: 3, severity: 'info' },
  { id: 'M14', pillar: 'structure', title: 'Kill rule ready', description: 'Losers identifiable via 3× CPA rule', weight: 4, severity: 'medium' },
  { id: 'M15', pillar: 'structure', title: 'Scale candidates', description: 'Winners exist for 20% scale', weight: 3, severity: 'info' },
  { id: 'M16', pillar: 'structure', title: 'Pacing healthy', description: 'Spend within 40–115% of daily budget', weight: 4, severity: 'medium' },
  { id: 'M17', pillar: 'structure', title: 'Active campaign count', description: '1–6 active campaigns (not fragmented)', weight: 3, severity: 'medium' },

  // Audience 20%
  { id: 'M19', pillar: 'audience', title: 'Frequency ceiling', description: 'Account avg frequency < 3.5', weight: 6, severity: 'high' },
  { id: 'M20', pillar: 'audience', title: 'Exclusions present', description: 'Purchasers / recent converters excluded', weight: 5, severity: 'medium' },
  { id: 'M21', pillar: 'audience', title: 'Lookalike / seed path', description: 'Lookalike or strong interest seed', weight: 5, severity: 'medium' },
  { id: 'M22', pillar: 'audience', title: 'CTR floor', description: 'Account CTR ≥ 0.6%', weight: 4, severity: 'medium' },
  { id: 'M23', pillar: 'audience', title: 'Attribution window set', description: '7d click / 1d view (or documented)', weight: 3, severity: 'info' },
  { id: 'M24', pillar: 'audience', title: 'Reach efficiency', description: 'Reach not collapsing vs impressions', weight: 3, severity: 'medium' },
];

export const PILLAR_WEIGHTS: Record<PillarId, number> = {
  tracking: 0.3,
  creative: 0.3,
  structure: 0.2,
  audience: 0.2,
};

export function checksByPillar(pillar: PillarId): OptimizeCheck[] {
  return CHECK_CATALOG.filter((c) => c.pillar === pillar);
}

export function checkById(id: string): OptimizeCheck | undefined {
  return CHECK_CATALOG.find((c) => c.id === id);
}
