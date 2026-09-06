import type { AgentTargets, CampaignMetrics, RecommendationDraft } from './types';

/**
 * Research-backed Meta ads rules (2025–2026 media-buyer norms):
 * - Protect learning: no CPA pause / budget scale until ~1,000 impressions
 *   or spend ≥ max(₹500, 2× CPA target) (avoid killing ads before ~50 events).
 * - Scale winners slowly: +15% budget only (larger jumps reset learning).
 * - Fatigue: frequency ≥ 3.5 with soft CTR → refresh creatives.
 * - Low CTR floor after enough impressions.
 * - Tracking gap when spend/clicks exist but zero ATC/Purchase (Pixel).
 * - Auto-pause only after 3 consecutive days above 1.5× CPA with spend floors.
 */

function learningProtected(m: CampaignMetrics, targets: AgentTargets): boolean {
  const spendFloor = Math.max(500, (targets.cpaTarget || 100) * 2);
  if (m.impressions < 1000 && m.spend < spendFloor) return true;
  // Few purchases relative to Meta’s ~50-event learning heuristic in a week
  if (m.purchases > 0 && m.purchases < 10 && m.impressions < 5000) return true;
  return false;
}

function hasSpendFloor(m: CampaignMetrics, targets: AgentTargets): boolean {
  const floor = Math.max(300, (targets.cpaTarget || 100) * 2);
  return m.spend >= floor || m.impressions >= 1000;
}

/** Pure performance rules — no Meta I/O */
export function analyzePerformance(
  metrics: CampaignMetrics[],
  targets: AgentTargets,
  priorDaysCpa?: Record<string, number[]>
): RecommendationDraft[] {
  const out: RecommendationDraft[] = [];

  for (const m of metrics) {
    if (m.status !== 'active') continue;
    const learning = learningProtected(m, targets);

    // --- Phase 2: pause losers (only after learning + spend floor) ---
    const history = priorDaysCpa?.[m.campaignId] || [];
    if (!learning && targets.cpaTarget && history.length >= 3 && hasSpendFloor(m, targets)) {
      const threshold = targets.cpaTarget * 1.5;
      if (history.every((c) => c > threshold)) {
        out.push({
          source: 'performance',
          type: 'pause_cpa',
          severity: 'critical',
          title: `Auto-pause: ${m.campaignName}`,
          body: `CPA stayed above ₹${threshold.toFixed(0)} (1.5× target ₹${targets.cpaTarget}) for 3 days with enough spend/impressions. Pausing to protect budget.`,
          proposed_action: {
            action: 'pause_campaign',
            campaignId: m.campaignId,
            reason: 'cpa_3d_breach',
            threshold,
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
        body: `CPA looks high but campaign is still in early delivery (<1,000 impressions or low spend). Ops Agent will not pause yet (Meta learning-phase best practice).`,
        proposed_action: { action: 'wait_learning', campaignId: m.campaignId },
        meta_campaign_id: m.campaignId,
        auto_apply: false,
      });
    }

    // Low CTR after enough volume
    if (!learning && m.impressions >= 2000 && m.ctr > 0 && m.ctr < 0.6) {
      out.push({
        source: 'performance',
        type: 'pause_low_ctr',
        severity: 'medium',
        title: `Low CTR on ${m.campaignName}`,
        body: `CTR ${m.ctr.toFixed(2)}% after ${m.impressions.toLocaleString()} impressions (benchmark ~0.6%+). Refresh creatives or pause weak ads.`,
        proposed_action: {
          action: 'refresh_creatives',
          campaignId: m.campaignId,
          threshold_ctr: 0.6,
        },
        meta_campaign_id: m.campaignId,
        auto_apply: false,
      });
    }

    // Creative fatigue (frequency ceiling ~3–4)
    if (m.frequency >= 3.5 && m.ctr > 0 && m.ctr < 1.2) {
      out.push({
        source: 'performance',
        type: 'creative_fatigue',
        severity: 'medium',
        title: `Creative fatigue: ${m.campaignName}`,
        body: `Frequency ${m.frequency.toFixed(1)} with CTR ${m.ctr.toFixed(2)}%. Rotate creatives within 10–14 days (or sooner on Reels).`,
        proposed_action: { action: 'refresh_creatives', campaignId: m.campaignId },
        meta_campaign_id: m.campaignId,
        auto_apply: false,
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
          body: `Only ${(ratio * 100).toFixed(0)}% of ₹${m.budget} daily budget spent. Check audience size, bids, or learning limited.`,
          proposed_action: { action: 'review_delivery', campaignId: m.campaignId },
          meta_campaign_id: m.campaignId,
        });
      }
    }

    // --- Phase 2: scale winners +15% (Confirm required; never during learning) ---
    const roasOk = targets.roasTarget
      ? m.roas != null && m.roas >= targets.roasTarget
      : m.roas != null && m.roas >= 2;
    const cpaOk = targets.cpaTarget
      ? m.cpa != null && m.cpa > 0 && m.cpa <= targets.cpaTarget
      : m.cpa != null && m.cpa > 0 && m.purchases > 0;

    if (
      !learning &&
      hasSpendFloor(m, targets) &&
      roasOk &&
      cpaOk &&
      m.budget &&
      m.purchases >= 1
    ) {
      const nextBudget = Math.round(m.budget * 1.15);
      const cap = targets.dailyBudgetCap;
      const capped = cap ? Math.min(nextBudget, cap) : nextBudget;
      if (capped > m.budget) {
        out.push({
          source: 'performance',
          type: 'scale_budget',
          severity: 'info',
          title: `Scale +15%: ${m.campaignName}`,
          body: `Winner: ROAS ${m.roas?.toFixed(2)}x, CPA ₹${m.cpa?.toFixed(0)}, ${m.purchases} purchase(s). Propose daily budget ₹${m.budget} → ₹${capped} (+15%, learning-safe). Requires Confirm.`,
          proposed_action: {
            action: 'update_budget',
            campaignId: m.campaignId,
            previous_budget: m.budget,
            new_budget: capped,
            pct: 15,
          },
          meta_campaign_id: m.campaignId,
          auto_apply: false,
        });
      }
    }

    // --- Phase 3: conversion / Pixel ---
    if (m.spend >= 500 && m.clicks >= 50 && m.purchases === 0 && m.add_to_cart === 0) {
      out.push({
        source: 'performance',
        type: 'tracking_gap',
        severity: 'high',
        title: `Tracking / Pixel gap: ${m.campaignName}`,
        body: `₹${m.spend.toFixed(0)} spend and ${m.clicks} clicks with zero Add-to-Cart or Purchases. Reconnect Meta so AdForge can auto-link your Pixel, and verify Shopify Pixel / Purchase events.`,
        proposed_action: { action: 'check_pixel', campaignId: m.campaignId },
        meta_campaign_id: m.campaignId,
      });
    }

    if (
      !learning &&
      m.add_to_cart >= 5 &&
      m.purchases === 0 &&
      m.spend >= 400
    ) {
      out.push({
        source: 'performance',
        type: 'conversion_funnel',
        severity: 'medium',
        title: `ATC but no purchases: ${m.campaignName}`,
        body: `${m.add_to_cart} Add-to-Cart with 0 purchases. Check checkout UX, payment methods, or switch Sales objective + Pixel Purchase optimization.`,
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
        body: `Conversion rate ${m.conversion_rate.toFixed(2)}% on ${m.clicks} clicks. Improve landing page / offer; Ops Agent will not scale until conversions improve.`,
        proposed_action: { action: 'review_landing', campaignId: m.campaignId },
        meta_campaign_id: m.campaignId,
      });
    }
  }

  return out;
}
