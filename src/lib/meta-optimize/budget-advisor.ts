import type { OptimizeCampaignInput, OptimizeTargets } from './types';
import { breakEvenCpa, breakEvenRoas } from './ppc-math';

export type BudgetAdvice = {
  recommendedModel: 'CBO' | 'ABO' | 'hybrid';
  biddingStrategy: 'LOWEST_COST' | 'COST_CAP' | 'BID_CAP' | 'ROAS_GOAL';
  allocation: {
    prospectingPct: number;
    retargetingPct: number;
    testingPct: number;
  };
  perCampaign: Array<{
    id: string;
    name: string;
    action: 'kill' | 'scale' | 'hold' | 'test';
    suggestedDailyBudget: number | null;
    rationale: string;
  }>;
  notes: string[];
};

/**
 * 70/20/10 prospecting / retargeting / testing + CBO vs ABO + bid strategy.
 */
export function adviseBudget(input: {
  campaigns: OptimizeCampaignInput[];
  targets: OptimizeTargets;
  totalDailyBudget?: number | null;
}): BudgetAdvice {
  const notes: string[] = [];
  const active = input.campaigns.filter((c) => c.status === 'active');
  const cpaTarget =
    input.targets.cpaTarget ||
    (input.targets.aov && input.targets.marginPct != null
      ? breakEvenCpa(input.targets.aov, input.targets.marginPct) * 0.8
      : 100);
  const roasTarget =
    input.targets.roasTarget ||
    (input.targets.marginPct != null
      ? breakEvenRoas(input.targets.marginPct) * 1.25
      : 2.5);

  const total =
    input.totalDailyBudget ||
    active.reduce((s, c) => s + (c.dailyBudget || 0), 0) ||
    1000;

  // Prefer CBO when ≥3 ad sets worth of campaigns and testing is limited
  const recommendedModel: BudgetAdvice['recommendedModel'] =
    active.length >= 3 ? 'CBO' : active.length === 1 ? 'ABO' : 'hybrid';

  let biddingStrategy: BudgetAdvice['biddingStrategy'] = 'LOWEST_COST';
  if (input.targets.roasTarget && input.targets.roasTarget >= 2) {
    biddingStrategy = 'ROAS_GOAL';
  } else if (cpaTarget > 0 && active.some((c) => c.cpa != null && c.cpa > cpaTarget)) {
    biddingStrategy = 'COST_CAP';
  }

  if (recommendedModel === 'CBO') {
    notes.push('Use Advantage Campaign Budget (CBO) so Meta reallocates to winning ad sets.');
  } else {
    notes.push('Keep ABO while learning; consolidate into CBO once you have clear winners.');
  }
  notes.push(`Target CPA ≈ ₹${cpaTarget.toFixed(0)}, target ROAS ≈ ${roasTarget.toFixed(2)}x.`);
  notes.push('Allocation rule: 70% prospecting · 20% retargeting · 10% creative tests.');

  const perCampaign = active.map((c) => {
    const budget = c.dailyBudget;
    if (c.cpa != null && c.cpa > cpaTarget * 3 && c.spend >= Math.max(300, cpaTarget * 2)) {
      return {
        id: c.id,
        name: c.name,
        action: 'kill' as const,
        suggestedDailyBudget: 0,
        rationale: `CPA ₹${c.cpa.toFixed(0)} > 3× target — kill`,
      };
    }
    if (
      c.roas != null &&
      c.roas >= roasTarget &&
      c.cpa != null &&
      c.cpa <= cpaTarget &&
      budget
    ) {
      return {
        id: c.id,
        name: c.name,
        action: 'scale' as const,
        suggestedDailyBudget: Math.round(budget * 1.2),
        rationale: `Winner — scale +20% (cap at account limit)`,
      };
    }
    if (c.purchases === 0 && c.spend < cpaTarget * 2) {
      return {
        id: c.id,
        name: c.name,
        action: 'test' as const,
        suggestedDailyBudget: Math.max(budget || 0, Math.round(cpaTarget * 2)),
        rationale: 'Still in test — fund ≥ 2× CPA/day',
      };
    }
    return {
      id: c.id,
      name: c.name,
      action: 'hold' as const,
      suggestedDailyBudget: budget,
      rationale: 'Hold — monitor learning & creative fatigue',
    };
  });

  return {
    recommendedModel,
    biddingStrategy,
    allocation: { prospectingPct: 70, retargetingPct: 20, testingPct: 10 },
    perCampaign,
    notes: [
      ...notes,
      `Suggested daily pool ₹${total}: prospecting ₹${Math.round(total * 0.7)}, retargeting ₹${Math.round(total * 0.2)}, testing ₹${Math.round(total * 0.1)}.`,
    ],
  };
}
