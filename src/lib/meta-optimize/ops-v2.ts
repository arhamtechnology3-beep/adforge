import type { AgentTargets, CampaignMetrics, RecommendationDraft } from '@/lib/ops-agent/types';

/**
 * Ops v2 — plugin-aligned Meta media-buyer rules:
 * - 3× Kill Rule (CPA > 3× target after learning + spend floor)
 * - 20% scale rule (winners), with optional 15% conservative mode
 * - Learning-phase protection
 * - Fatigue, CTR floor, tracking gap, funnel, pacing
 */

export type OpsV2Options = {
  scalePct?: 15 | 20;
  killMultiplier?: number; // default 3
  softCpaMultiplier?: number; // default 1.5 for 3-day streak
};

function learningProtected(m: CampaignMetrics, targets: AgentTargets): boolean {
  const spendFloor = Math.max(500, (targets.cpaTarget || 100) * 2);
  if (m.impressions < 1000 && m.spend < spendFloor) return true;
  if (m.purchases > 0 && m.purchases < 10 && m.impressions < 5000) return true;
  return false;
}

function hasSpendFloor(m: CampaignMetrics, targets: AgentTargets): boolean {
  const floor = Math.max(300, (targets.cpaTarget || 100) * 2);
  return m.spend >= floor || m.impressions >= 1000;
}

export function analyzePerformanceV2(
  metrics: CampaignMetrics[],
  targets: AgentTargets,
  priorDaysCpa?: Record<string, number[]>,
  options?: OpsV2Options
): RecommendationDraft[] {
  const scalePct = options?.scalePct ?? 20;
  const killMult = options?.killMultiplier ?? 3;
  const softMult = options?.softCpaMultiplier ?? 1.5;
  const out: RecommendationDraft[] = [];

  for (const m of metrics) {
    if (m.status !== 'active') continue;
    const learning = learningProtected(m, targets);
    const history = priorDaysCpa?.[m.campaignId] || [];

    // Soft pause: 3 consecutive days above 1.5× CPA
    if (!learning && targets.cpaTarget && history.length >= 3 && hasSpendFloor(m, targets)) {
      const soft = targets.cpaTarget * softMult;
      if (history.every((c) => c > soft)) {
        out.push({
          source: 'performance',
          type: 'pause_cpa',
          severity: 'critical',
          title: `Auto-pause: ${m.campaignName}`,
          body: `CPA stayed above ₹${soft.toFixed(0)} (${softMult}× target ₹${targets.cpaTarget}) for 3 days. Pausing to protect budget.`,
          proposed_action: {
            action: 'pause_campaign',
            campaignId: m.campaignId,
            reason: 'cpa_3d_breach',
            threshold: soft,
          },
          meta_campaign_id: m.campaignId,
          auto_apply: true,
        });
      }
    } else if (learning && targets.cpaTarget && history.length >= 3) {
      out.push({
        source: 'performance',
        type: 'learning_protect',
        severity: 'info',
        title: `Learning protected: ${m.campaignName}`,
        body: `Early delivery — Ops will not pause yet (Meta learning-phase best practice).`,
        proposed_action: { action: 'wait_learning', campaignId: m.campaignId },
        meta_campaign_id: m.campaignId,
        auto_apply: false,
      });
    }

    // 3× Kill Rule (immediate recommend; auto if also soft streak)
    if (
      !learning &&
      targets.cpaTarget &&
      m.cpa != null &&
      m.cpa > targets.cpaTarget * killMult &&
      hasSpendFloor(m, targets) &&
      m.purchases >= 1
    ) {
      out.push({
        source: 'performance',
        type: 'kill_3x',
        severity: 'critical',
        title: `3× Kill Rule: ${m.campaignName}`,
        body: `CPA ₹${m.cpa.toFixed(0)} is > ${killMult}× target ₹${targets.cpaTarget}. Kill or rebuild creative/audience.`,
        proposed_action: {
          action: 'pause_campaign',
          campaignId: m.campaignId,
          reason: 'kill_3x',
          threshold: targets.cpaTarget * killMult,
        },
        meta_campaign_id: m.campaignId,
        auto_apply: false,
      });
    }

    if (!learning && m.impressions >= 2000 && m.ctr > 0 && m.ctr < 0.6) {
      out.push({
        source: 'performance',
        type: 'pause_low_ctr',
        severity: 'medium',
        title: `Low CTR on ${m.campaignName}`,
        body: `CTR ${m.ctr.toFixed(2)}% after ${m.impressions.toLocaleString()} impressions (benchmark ~0.6%+).`,
        proposed_action: { action: 'refresh_creatives', campaignId: m.campaignId },
        meta_campaign_id: m.campaignId,
        auto_apply: false,
      });
    }

    if (m.frequency >= 3.5 && m.ctr > 0 && m.ctr < 1.2) {
      out.push({
        source: 'performance',
        type: 'creative_fatigue',
        severity: 'medium',
        title: `Creative fatigue: ${m.campaignName}`,
        body: `Frequency ${m.frequency.toFixed(1)} with CTR ${m.ctr.toFixed(2)}%. Rotate creatives.`,
        proposed_action: { action: 'refresh_creatives', campaignId: m.campaignId },
        meta_campaign_id: m.campaignId,
        auto_apply: false,
      });
    }

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
          body: `Only ${(ratio * 100).toFixed(0)}% of ₹${m.budget} daily budget spent.`,
          proposed_action: { action: 'review_delivery', campaignId: m.campaignId },
          meta_campaign_id: m.campaignId,
        });
      }
    }

    const roasOk = targets.roasTarget
      ? m.roas != null && m.roas >= targets.roasTarget
      : m.roas != null && m.roas >= 2;
    const cpaOk = targets.cpaTarget
      ? m.cpa != null && m.cpa > 0 && m.cpa <= targets.cpaTarget
      : m.cpa != null && m.cpa > 0 && m.purchases > 0;

    if (!learning && hasSpendFloor(m, targets) && roasOk && cpaOk && m.budget && m.purchases >= 1) {
      const nextBudget = Math.round(m.budget * (1 + scalePct / 100));
      const cap = targets.dailyBudgetCap;
      const capped = cap ? Math.min(nextBudget, cap) : nextBudget;
      if (capped > m.budget) {
        out.push({
          source: 'performance',
          type: 'scale_budget',
          severity: 'info',
          title: `Scale +${scalePct}%: ${m.campaignName}`,
          body: `Winner: ROAS ${m.roas?.toFixed(2)}x, CPA ₹${m.cpa?.toFixed(0)}. Propose ₹${m.budget} → ₹${capped} (+${scalePct}%). Requires Confirm.`,
          proposed_action: {
            action: 'update_budget',
            campaignId: m.campaignId,
            previous_budget: m.budget,
            new_budget: capped,
            pct: scalePct,
          },
          meta_campaign_id: m.campaignId,
          auto_apply: false,
        });
      }
    }

    if (m.spend >= 500 && m.clicks >= 50 && m.purchases === 0 && m.add_to_cart === 0) {
      out.push({
        source: 'performance',
        type: 'tracking_gap',
        severity: 'high',
        title: `Tracking / Pixel gap: ${m.campaignName}`,
        body: `₹${m.spend.toFixed(0)} spend and ${m.clicks} clicks with zero ATC/Purchase. Enable CAPI + verify Pixel.`,
        proposed_action: { action: 'check_pixel', campaignId: m.campaignId },
        meta_campaign_id: m.campaignId,
      });
    }

    if (!learning && m.add_to_cart >= 5 && m.purchases === 0 && m.spend >= 400) {
      out.push({
        source: 'performance',
        type: 'conversion_funnel',
        severity: 'medium',
        title: `ATC but no purchases: ${m.campaignName}`,
        body: `${m.add_to_cart} ATC with 0 purchases. Check checkout / offer / payment.`,
        proposed_action: { action: 'review_funnel', campaignId: m.campaignId },
        meta_campaign_id: m.campaignId,
      });
    }

    if (
      !learning &&
      m.conversion_rate != null &&
      m.clicks >= 80 &&
      m.conversion_rate < 0.5 &&
      m.spend >= 400
    ) {
      out.push({
        source: 'performance',
        type: 'low_conversion_rate',
        severity: 'medium',
        title: `Low site conversion: ${m.campaignName}`,
        body: `CVR ${m.conversion_rate.toFixed(2)}% on ${m.clicks} clicks. Improve landing page / offer.`,
        proposed_action: { action: 'review_landing', campaignId: m.campaignId },
        meta_campaign_id: m.campaignId,
      });
    }
  }

  return out;
}

/** Kill / scale lists derived from metrics (for Health Score UI). */
export function buildKillScaleLists(
  metrics: CampaignMetrics[],
  targets: AgentTargets
): {
  killList: Array<{ id: string; name: string; reason: string; metric: string }>;
  scaleList: Array<{ id: string; name: string; reason: string; nextBudget?: number }>;
} {
  const killList: Array<{ id: string; name: string; reason: string; metric: string }> = [];
  const scaleList: Array<{ id: string; name: string; reason: string; nextBudget?: number }> = [];
  const cpaTarget = targets.cpaTarget || 100;
  const roasTarget = targets.roasTarget || 2;

  for (const m of metrics) {
    if (m.status !== 'active') continue;
    if (m.cpa != null && m.cpa > cpaTarget * 3 && m.spend >= Math.max(300, cpaTarget * 2)) {
      killList.push({
        id: m.campaignId,
        name: m.campaignName,
        reason: 'CPA exceeds 3× target',
        metric: `CPA ₹${m.cpa.toFixed(0)} vs target ₹${cpaTarget}`,
      });
    }
    if (
      m.roas != null &&
      m.roas >= roasTarget &&
      m.cpa != null &&
      m.cpa <= cpaTarget &&
      m.budget &&
      m.purchases >= 1
    ) {
      scaleList.push({
        id: m.campaignId,
        name: m.campaignName,
        reason: 'ROAS/CPA winners — propose +20%',
        nextBudget: Math.round(m.budget * 1.2),
        metric: `ROAS ${m.roas.toFixed(2)}x · CPA ₹${m.cpa.toFixed(0)}`,
      } as { id: string; name: string; reason: string; nextBudget?: number });
    }
  }

  return { killList, scaleList };
}
