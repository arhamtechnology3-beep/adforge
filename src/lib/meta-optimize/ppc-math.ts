/** PPC financial calculators (CPA, ROAS, break-even, LTV:CAC, MER). */

export type PpcInputs = {
  aov: number;
  marginPct: number; // 0–100 contribution margin
  adSpend: number;
  revenue: number;
  purchases: number;
  clicks?: number;
  impressions?: number;
  ltv?: number | null;
  cac?: number | null;
};

export type PpcReport = {
  cpa: number | null;
  roas: number | null;
  mer: number | null;
  breakEvenCpa: number;
  breakEvenRoas: number;
  targetCpa: number;
  targetRoas: number;
  ltvCac: number | null;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  contributionProfit: number;
  notes: string[];
};

export function breakEvenCpa(aov: number, marginPct: number): number {
  return Math.max(0, aov * (marginPct / 100));
}

export function breakEvenRoas(marginPct: number): number {
  if (marginPct <= 0) return Infinity;
  return 100 / marginPct;
}

export function computePpcMath(input: PpcInputs): PpcReport {
  const notes: string[] = [];
  const beCpa = breakEvenCpa(input.aov, input.marginPct);
  const beRoas = breakEvenRoas(input.marginPct);
  const cpa =
    input.purchases > 0 ? input.adSpend / input.purchases : input.adSpend > 0 ? null : 0;
  const roas = input.adSpend > 0 ? input.revenue / input.adSpend : null;
  const mer = input.adSpend > 0 ? input.revenue / input.adSpend : null; // same as ROAS when revenue is attributed; MER often uses total store revenue
  const cpc =
    input.clicks && input.clicks > 0 ? input.adSpend / input.clicks : null;
  const cpm =
    input.impressions && input.impressions > 0
      ? (input.adSpend / input.impressions) * 1000
      : null;
  const ctr =
    input.impressions && input.impressions > 0 && input.clicks != null
      ? (input.clicks / input.impressions) * 100
      : null;

  // Conservative targets: stay 20% under break-even CPA / above break-even ROAS
  const targetCpa = beCpa * 0.8;
  const targetRoas = beRoas === Infinity ? 3 : beRoas * 1.25;

  const cac = input.cac ?? cpa;
  const ltv = input.ltv ?? null;
  const ltvCac = ltv != null && cac != null && cac > 0 ? ltv / cac : null;

  const contributionProfit =
    input.revenue * (input.marginPct / 100) - input.adSpend;

  if (cpa != null && cpa > beCpa) {
    notes.push(`CPA ₹${cpa.toFixed(0)} is above break-even ₹${beCpa.toFixed(0)} — unprofitable at current margin.`);
  }
  if (roas != null && roas < beRoas) {
    notes.push(`ROAS ${roas.toFixed(2)}x is below break-even ${beRoas.toFixed(2)}x.`);
  }
  if (ltvCac != null && ltvCac < 3) {
    notes.push(`LTV:CAC ${ltvCac.toFixed(2)} is below healthy 3:1 — tighten CPA or raise LTV.`);
  }
  if (contributionProfit < 0) {
    notes.push(`Contribution after ads is negative (₹${contributionProfit.toFixed(0)}).`);
  }

  return {
    cpa,
    roas,
    mer,
    breakEvenCpa: beCpa,
    breakEvenRoas: beRoas === Infinity ? 999 : beRoas,
    targetCpa,
    targetRoas,
    ltvCac,
    cpc,
    cpm,
    ctr,
    contributionProfit,
    notes,
  };
}

/** Forecast daily budget needed to hit N purchases at target CPA. */
export function budgetForPurchases(purchasesPerDay: number, targetCpa: number): number {
  return Math.max(0, Math.round(purchasesPerDay * targetCpa));
}
