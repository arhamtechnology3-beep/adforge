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

function guide(
  what: string,
  why: string,
  confirmDoes: string,
  recommend: string
) {
  return { what, why, confirmDoes, recommend };
}

function withGuide(
  draft: RecommendationDraft,
  g: ReturnType<typeof guide>
): RecommendationDraft {
  return {
    ...draft,
    body: `${draft.body}\n\nWhat this means: ${g.what}\nWhy it matters: ${g.why}\nIf you Confirm: ${g.confirmDoes}\nSuggested decision: ${g.recommend}`,
    proposed_action: { ...draft.proposed_action, ...g },
  };
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
        out.push(
          withGuide(
            {
              source: 'performance',
              type: 'pause_cpa',
              severity: 'critical',
              title: `Auto-pause: ${m.campaignName}`,
              body: `CPA stayed above ₹${soft.toFixed(0)} (${softMult}× target ₹${targets.cpaTarget}) for 3 days.`,
              proposed_action: {
                action: 'pause_campaign',
                campaignId: m.campaignId,
                reason: 'cpa_3d_breach',
                threshold: soft,
              },
              meta_campaign_id: m.campaignId,
              auto_apply: true,
            },
            guide(
              'This campaign has been expensive vs your CPA target for 3 days in a row.',
              'Continuing spend likely wastes budget until creative/audience changes.',
              'Pauses the campaign on Meta immediately and marks it paused in AdForge.',
              'Confirm only if you agree to stop delivery now. Reject to keep it live.'
            )
          )
        );
      }
    } else if (learning && targets.cpaTarget && history.length >= 3) {
      out.push(
        withGuide(
          {
            source: 'performance',
            type: 'learning_protect',
            severity: 'info',
            title: `Learning protected: ${m.campaignName}`,
            body: `Early delivery — Ops will not pause yet (Meta learning-phase best practice).`,
            proposed_action: { action: 'wait_learning', campaignId: m.campaignId },
            meta_campaign_id: m.campaignId,
            auto_apply: false,
          },
          guide(
            'Campaign is still in early learning / low data.',
            'Pausing too early resets learning and can raise CPA later.',
            'No Meta change — Confirm only acknowledges this note.',
            'Usually Reject is unnecessary; Confirm to dismiss after reading.'
          )
        )
      );
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
      out.push(
        withGuide(
          {
            source: 'performance',
            type: 'kill_3x',
            severity: 'critical',
            title: `3× Kill Rule: ${m.campaignName}`,
            body: `CPA ₹${m.cpa.toFixed(0)} is > ${killMult}× target ₹${targets.cpaTarget}.`,
            proposed_action: {
              action: 'pause_campaign',
              campaignId: m.campaignId,
              reason: 'kill_3x',
              threshold: targets.cpaTarget * killMult,
            },
            meta_campaign_id: m.campaignId,
            auto_apply: false,
          },
          guide(
            'Cost per purchase is more than 3× your target after enough spend.',
            'Industry rule of thumb: kill or rebuild rather than keep funding losers.',
            'Pauses the campaign on Meta.',
            'Confirm to pause. Reject if you are testing a new offer/creative on purpose.'
          )
        )
      );
    }

    if (!learning && m.impressions >= 2000 && m.ctr > 0 && m.ctr < 0.6) {
      out.push(
        withGuide(
          {
            source: 'performance',
            type: 'pause_low_ctr',
            severity: 'medium',
            title: `Low CTR on ${m.campaignName}`,
            body: `CTR ${m.ctr.toFixed(2)}% after ${m.impressions.toLocaleString()} impressions (benchmark ~0.6%+).`,
            proposed_action: { action: 'refresh_creatives', campaignId: m.campaignId },
            meta_campaign_id: m.campaignId,
            auto_apply: false,
          },
          guide(
            'People are seeing the ad but rarely clicking.',
            'Weak hooks/creatives waste impressions and raise CPC.',
            'No Meta pause — Confirm marks this as acknowledged so you can refresh creatives in Ads.',
            'Confirm after you plan a creative refresh. Reject if CTR is acceptable for your niche.'
          )
        )
      );
    }

    if (m.frequency >= 3.5 && m.ctr > 0 && m.ctr < 1.2) {
      out.push(
        withGuide(
          {
            source: 'performance',
            type: 'creative_fatigue',
            severity: 'medium',
            title: `Creative fatigue: ${m.campaignName}`,
            body: `Frequency ${m.frequency.toFixed(1)} with CTR ${m.ctr.toFixed(2)}%.`,
            proposed_action: { action: 'refresh_creatives', campaignId: m.campaignId },
            meta_campaign_id: m.campaignId,
            auto_apply: false,
          },
          guide(
            'Same people are seeing the ad too often and engagement is soft.',
            'Fatigue drives higher CPC and lower CTR over time.',
            'No Meta pause — Confirm acknowledges; rotate creatives in Ad Generation / Ads Manager.',
            'Confirm once you schedule new creatives.'
          )
        )
      );
    }

    if (m.budget && m.budget > 0) {
      const daySpend = m.spendToday != null ? m.spendToday : m.spend;
      const ratio = daySpend / m.budget;
      const days = m.daysCovered || 1;
      if (ratio > 1.15) {
        out.push(
          withGuide(
            {
              source: 'performance',
              type: 'pacing_over',
              severity: 'high',
              title: `Over-pacing: ${m.campaignName}`,
              body: `Today’s spend ₹${daySpend.toFixed(0)} is ${(ratio * 100).toFixed(0)}% of daily budget ₹${m.budget} (lifetime window ₹${m.spend.toFixed(0)} across ${days} day${days === 1 ? '' : 's'}).`,
              proposed_action: {
                action: 'review_budget',
                campaignId: m.campaignId,
                daily_budget: m.budget,
                spend_today: daySpend,
                spend_total: m.spend,
              },
              meta_campaign_id: m.campaignId,
            },
            guide(
              'Delivery is spending faster than your set daily budget for the latest day.',
              'Can exhaust budget early and miss evening traffic, or signal account-level overspend.',
              'Does not change Meta automatically. Confirm = you reviewed pacing (optional: lower budget in Ads Manager).',
              'Confirm if intentional. Reject if you still need to investigate in Ads Manager.'
            )
          )
        );
      } else if (ratio < 0.4 && m.impressions > 500) {
        out.push(
          withGuide(
            {
              source: 'performance',
              type: 'pacing_under',
              severity: 'medium',
              title: `Under-delivery: ${m.campaignName}`,
              body: `Only ${(ratio * 100).toFixed(0)}% of ₹${m.budget} daily budget spent today (₹${daySpend.toFixed(0)}).`,
              proposed_action: {
                action: 'review_delivery',
                campaignId: m.campaignId,
                daily_budget: m.budget,
                spend_today: daySpend,
              },
              meta_campaign_id: m.campaignId,
            },
            guide(
              'Ads are not using most of the daily budget yet.',
              'Audience too narrow, bid too low, or learning / payment / schedule limits.',
              'No Meta change on Confirm — acknowledge after you check Ads Manager delivery.',
              'Confirm after checking why delivery is limited.'
            )
          )
        );
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
        out.push(
          withGuide(
            {
              source: 'performance',
              type: 'scale_budget',
              severity: 'info',
              title: `Scale +${scalePct}%: ${m.campaignName}`,
              body: `Winner: ROAS ${m.roas?.toFixed(2)}x, CPA ₹${m.cpa?.toFixed(0)}. Propose ₹${m.budget} → ₹${capped} (+${scalePct}%).`,
              proposed_action: {
                action: 'update_budget',
                campaignId: m.campaignId,
                previous_budget: m.budget,
                new_budget: capped,
                pct: scalePct,
              },
              meta_campaign_id: m.campaignId,
              auto_apply: false,
            },
            guide(
              'Campaign is beating your ROAS/CPA targets with enough data.',
              'Gradual +20% scales reduce learning reset vs big jumps.',
              `Raises ad set daily budget on Meta from ₹${m.budget} to ₹${capped}.`,
              'Confirm only if you want to spend more. Reject to keep current budget.'
            )
          )
        );
      }
    }

    if (m.spend >= 500 && m.clicks >= 50 && m.purchases === 0 && m.add_to_cart === 0) {
      out.push(
        withGuide(
          {
            source: 'performance',
            type: 'tracking_gap',
            severity: 'high',
            title: `Tracking / Pixel gap: ${m.campaignName}`,
            body: `₹${m.spend.toFixed(0)} spend and ${m.clicks} clicks with zero ATC/Purchase.`,
            proposed_action: { action: 'check_pixel', campaignId: m.campaignId },
            meta_campaign_id: m.campaignId,
          },
          guide(
            'Meta is not recording AddToCart/Purchase (or this is a Traffic campaign not optimized for sales).',
            'Without events, Sales optimization and true ROAS are blind. Traffic campaigns often show this.',
            'No Meta pause. Confirm = you acknowledge and will verify Pixel/CAPI or switch to Sales objective.',
            'Confirm after checking Events Manager. Reject if you intentionally run Traffic-only.'
          )
        )
      );
    }

    if (!learning && m.add_to_cart >= 5 && m.purchases === 0 && m.spend >= 400) {
      out.push(
        withGuide(
          {
            source: 'performance',
            type: 'conversion_funnel',
            severity: 'medium',
            title: `ATC but no purchases: ${m.campaignName}`,
            body: `${m.add_to_cart} ATC with 0 purchases.`,
            proposed_action: { action: 'review_funnel', campaignId: m.campaignId },
            meta_campaign_id: m.campaignId,
          },
          guide(
            'Shoppers add to cart but do not complete checkout.',
            'Usually offer, shipping, payment, or trust issues — not only ads.',
            'No Meta change. Confirm acknowledges after you review checkout.',
            'Confirm once you have a funnel fix plan.'
          )
        )
      );
    }

    if (
      !learning &&
      m.conversion_rate != null &&
      m.clicks >= 80 &&
      m.conversion_rate < 0.5 &&
      m.spend >= 400
    ) {
      out.push(
        withGuide(
          {
            source: 'performance',
            type: 'low_conversion_rate',
            severity: 'medium',
            title: `Low site conversion: ${m.campaignName}`,
            body: `CVR ${m.conversion_rate.toFixed(2)}% on ${m.clicks} clicks (spend ₹${m.spend.toFixed(0)}).`,
            proposed_action: { action: 'review_landing', campaignId: m.campaignId },
            meta_campaign_id: m.campaignId,
          },
          guide(
            'Clicks are arriving but almost nobody converts on site.',
            'Landing mismatch, slow page, weak offer, or Traffic objective without Purchase tracking.',
            'No Meta pause. Confirm = you will improve landing/offer or move to Sales campaigns.',
            'Confirm after reviewing the landing URL. Reject if Traffic-only is the goal.'
          )
        )
      );
    }
  }

  // Healthy active campaigns with delivery but no triggers — still surface a monitoring pulse.
  const hasActionable = out.some((r) => r.source === 'performance' && r.type !== 'monitoring');
  if (!hasActionable) {
    for (const m of metrics) {
      if (m.status !== 'active' || m.spend <= 0) continue;
      out.push(
        withGuide(
          {
            source: 'performance',
            type: 'monitoring',
            severity: 'info',
            title: `Monitoring: ${m.campaignName}`,
            body: `₹${Math.round(m.spend)} spend · CTR ${m.ctr.toFixed(2)}% · ${m.impressions.toLocaleString()} imps. No kill/scale triggers.`,
            proposed_action: { action: 'hold', campaignId: m.campaignId },
            meta_campaign_id: m.campaignId,
            auto_apply: false,
          },
          guide(
            'Campaign is delivering without kill/scale alerts.',
            'Keep watching CTR, CPC, and (for Sales) purchases before changing budget.',
            'No Meta change — Confirm dismisses this status note.',
            'Safe to Confirm once read.'
          )
        )
      );
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
