/** A/B test design for Meta Experiments (planner → structure for runner). */

export type AbHypothesis = {
  variable: 'creative' | 'headline' | 'cta' | 'audience' | 'landing' | 'offer' | 'placement';
  control: string;
  variant: string;
  expectedLiftPct: number; // e.g. 20 = +20% CTR/CVR
};

export type AbPlanInput = {
  hypothesis: AbHypothesis;
  baselineConversionRate: number; // 0–1 e.g. 0.02
  dailyConversions?: number;
  dailyVisitors?: number;
  confidence?: number; // default 0.95
  power?: number; // default 0.8
  mdePct?: number; // minimum detectable effect override
};

export type AbPlan = {
  hypothesisStatement: string;
  sampleSizePerArm: number;
  totalSampleSize: number;
  estimatedDays: number | null;
  confidence: number;
  power: number;
  mdePct: number;
  metaExperimentType: 'AB_TEST' | 'HOLDOUT' | 'CONVERSION_LIFT';
  setupSteps: string[];
  pitfalls: string[];
  status: 'planned';
};

/**
 * Approximate two-proportion sample size per arm.
 * Uses normal approximation; good enough for media planning.
 */
export function sampleSizePerArm(
  p1: number,
  mdeRelative: number,
  confidence = 0.95,
  power = 0.8
): number {
  const p2 = Math.min(0.99, p1 * (1 + mdeRelative));
  const zAlpha = confidence >= 0.99 ? 2.576 : confidence >= 0.95 ? 1.96 : 1.645;
  const zBeta = power >= 0.9 ? 1.282 : power >= 0.8 ? 0.84 : 0.67;
  const pBar = (p1 + p2) / 2;
  const numerator =
    Math.pow(zAlpha + zBeta, 2) * (2 * pBar * (1 - pBar));
  const denom = Math.pow(p2 - p1, 2) || 1e-8;
  return Math.max(100, Math.ceil(numerator / denom));
}

export function designAbTest(input: AbPlanInput): AbPlan {
  const confidence = input.confidence ?? 0.95;
  const power = input.power ?? 0.8;
  const mdePct = input.mdePct ?? Math.max(10, input.hypothesis.expectedLiftPct);
  const mdeRel = mdePct / 100;
  const p1 = Math.min(0.5, Math.max(0.001, input.baselineConversionRate));
  const n = sampleSizePerArm(p1, mdeRel, confidence, power);

  let estimatedDays: number | null = null;
  if (input.dailyConversions && input.dailyConversions > 0) {
    // conversions ≈ visitors * CVR; we need n visitors per arm
    const dailyVisitors =
      input.dailyVisitors || input.dailyConversions / p1;
    estimatedDays = Math.ceil((n * 2) / Math.max(1, dailyVisitors));
  } else if (input.dailyVisitors && input.dailyVisitors > 0) {
    estimatedDays = Math.ceil((n * 2) / input.dailyVisitors);
  }

  const h = input.hypothesis;
  const hypothesisStatement = `If we change ${h.variable} from “${h.control}” to “${h.variant}”, then primary metric will improve by ~${h.expectedLiftPct}% because the variant better matches audience intent.`;

  return {
    hypothesisStatement,
    sampleSizePerArm: n,
    totalSampleSize: n * 2,
    estimatedDays,
    confidence,
    power,
    mdePct,
    metaExperimentType:
      h.variable === 'audience' || h.variable === 'placement'
        ? 'AB_TEST'
        : h.variable === 'offer'
          ? 'CONVERSION_LIFT'
          : 'AB_TEST',
    setupSteps: [
      'Create Meta Experiments A/B test (not dual ad sets fighting each other).',
      'Split budget 50/50; keep targeting & bid strategy identical except the tested variable.',
      `Run until ≥ ${n} results per arm (or ${estimatedDays ?? 'N'} days).`,
      'Do not edit creatives mid-test; that invalidates learning.',
      'Declare a single primary KPI before launch (CTR, CPC, CPA, or ROAS).',
    ],
    pitfalls: [
      'Peaking too early (<100 conversions/arm) leads to false winners.',
      'Testing multiple variables at once confounds results.',
      'Ending when one arm “looks good” without sample size is peeking bias.',
      'Audience overlap between campaigns pollutes Meta Experiments.',
    ],
    status: 'planned',
  };
}

export type AbTestRecord = AbPlan & {
  id: string;
  name: string;
  createdAt: string;
  primaryKpi: string;
};
