import type { AgentTargets, CampaignMetrics, RecommendationDraft } from './types';

/** Pure performance rules — no Meta I/O */
export function analyzePerformance(
  metrics: CampaignMetrics[],
  targets: AgentTargets,
  priorDaysCpa?: Record<string, number[]>
): RecommendationDraft[] {
  const out: RecommendationDraft[] = [];

  for (const m of metrics) {
    if (m.status !== 'active') continue;

    // CPA breach auto-pause (3 days handled by caller via priorDaysCpa)
    const history = priorDaysCpa?.[m.campaignId] || [];
    if (targets.cpaTarget && history.length >= 3) {
      const threshold = targets.cpaTarget * 1.5;
      if (history.every((c) => c > threshold)) {
        out.push({
          source: 'performance',
          type: 'pause_cpa',
          severity: 'critical',
          title: `Auto-pause: ${m.campaignName}`,
          body: `CPA exceeded ₹${threshold.toFixed(0)} (1.5× target) for 3 consecutive days.`,
          proposed_action: { action: 'pause_campaign', campaignId: m.campaignId },
          meta_campaign_id: m.campaignId,
          auto_apply: true,
        });
      }
    }

    // Low CTR
    if (m.impressions >= 2000 && m.ctr > 0 && m.ctr < 0.6) {
      out.push({
        source: 'performance',
        type: 'pause_low_ctr',
        severity: 'medium',
        title: `Low CTR on ${m.campaignName}`,
        body: `CTR is ${m.ctr.toFixed(2)}% with ${m.impressions.toLocaleString()} impressions. Consider pausing weak ads or refreshing creatives.`,
        proposed_action: { action: 'pause_weak_ads', campaignId: m.campaignId, threshold_ctr: 0.6 },
        meta_campaign_id: m.campaignId,
      });
    }

    // Creative fatigue: high frequency + soft CTR
    if (m.frequency >= 3.5 && m.ctr > 0 && m.ctr < 1.2) {
      out.push({
        source: 'performance',
        type: 'creative_fatigue',
        severity: 'medium',
        title: `Creative fatigue: ${m.campaignName}`,
        body: `Frequency ${m.frequency.toFixed(1)} with CTR ${m.ctr.toFixed(2)}%. Refresh creatives to avoid ad fatigue.`,
        proposed_action: { action: 'refresh_creatives', campaignId: m.campaignId },
        meta_campaign_id: m.campaignId,
      });
    }

    // Pacing
    if (m.budget && m.budget > 0) {
      const ratio = m.spend / m.budget;
      if (ratio > 1.15) {
        out.push({
          source: 'performance',
          type: 'pacing_over',
          severity: 'high',
          title: `Over-pacing: ${m.campaignName}`,
          body: `Spend ₹${m.spend.toFixed(0)} is ${(ratio * 100).toFixed(0)}% of daily budget ₹${m.budget}.`,
          proposed_action: { action: 'review_budget', campaignId: m.campaignId },
          meta_campaign_id: m.campaignId,
        });
      } else if (ratio < 0.4 && m.impressions > 500) {
        out.push({
          source: 'performance',
          type: 'pacing_under',
          severity: 'medium',
          title: `Under-delivery: ${m.campaignName}`,
          body: `Only ${(ratio * 100).toFixed(0)}% of ₹${m.budget} daily budget spent. Check learning phase, audience size, or bids.`,
          proposed_action: { action: 'review_delivery', campaignId: m.campaignId },
          meta_campaign_id: m.campaignId,
        });
      }
    }

    // Scale winners (Confirm required)
    const roasOk = targets.roasTarget
      ? m.roas != null && m.roas >= targets.roasTarget
      : m.roas != null && m.roas >= 2;
    const cpaOk = targets.cpaTarget
      ? m.cpa != null && m.cpa <= targets.cpaTarget
      : m.cpa != null && m.cpa > 0;

    if (roasOk && cpaOk && m.spend >= 300 && m.budget) {
      const nextBudget = Math.round(m.budget * 1.15);
      const cap = targets.dailyBudgetCap;
      const capped = cap ? Math.min(nextBudget, cap) : nextBudget;
      if (capped > m.budget) {
        out.push({
          source: 'performance',
          type: 'scale_budget',
          severity: 'info',
          title: `Scale +15%: ${m.campaignName}`,
          body: `Winning metrics (ROAS ${m.roas?.toFixed(2)}x, CPA ₹${m.cpa?.toFixed(0)}). Propose daily budget ₹${m.budget} → ₹${capped}. Requires Confirm.`,
          proposed_action: {
            action: 'update_budget',
            campaignId: m.campaignId,
            new_budget: capped,
            pct: 15,
          },
          meta_campaign_id: m.campaignId,
          auto_apply: false,
        });
      }
    }

    // Tracking gap
    if (m.spend >= 500 && m.clicks >= 50 && m.purchases === 0 && m.add_to_cart === 0) {
      out.push({
        source: 'performance',
        type: 'tracking_gap',
        severity: 'high',
        title: `Possible tracking gap: ${m.campaignName}`,
        body: `₹${m.spend.toFixed(0)} spend and ${m.clicks} clicks with zero ATC/purchases. Verify Pixel / CAPI events.`,
        proposed_action: { action: 'check_pixel', campaignId: m.campaignId },
        meta_campaign_id: m.campaignId,
      });
    }
  }

  return out;
}
