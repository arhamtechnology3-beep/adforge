/** Shared types for Meta optimize suite (Health Score, Ops v2, CAPI, A/B, etc.) */

export type PillarId = 'tracking' | 'creative' | 'structure' | 'audience';

export type CheckSeverity = 'critical' | 'high' | 'medium' | 'info';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'na';

export type OptimizeCheck = {
  id: string;
  pillar: PillarId;
  title: string;
  description: string;
  weight: number;
  severity: CheckSeverity;
};

export type CheckResult = OptimizeCheck & {
  status: CheckStatus;
  score: number; // 0–100 for this check
  evidence: string;
  recommendation?: string;
};

export type HealthScoreReport = {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  pillars: Record<
    PillarId,
    { score: number; weight: number; checks: CheckResult[] }
  >;
  quickWins: CheckResult[];
  killList: Array<{ id: string; name: string; reason: string; metric: string }>;
  scaleList: Array<{ id: string; name: string; reason: string; nextBudget?: number }>;
  generatedAt: string;
};

export type OptimizeCampaignInput = {
  id: string;
  name: string;
  status: string;
  objective?: string | null;
  budgetType?: 'CBO' | 'ABO' | 'unknown';
  biddingStrategy?: string | null;
  dailyBudget: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  cpa: number | null;
  roas: number | null;
  frequency: number;
  purchases: number;
  addToCart: number;
  initiateCheckout: number;
  conversionRate: number | null;
  revenue: number;
  reach: number;
  learningLimited?: boolean;
  hasLookalike?: boolean;
  hasExclusions?: boolean;
  attributionWindow?: string | null;
};

export type OptimizeCreativeInput = {
  id: string;
  name: string;
  format: string;
  headline?: string;
  primaryText?: string;
  spend: number;
  ctr: number;
  cpa: number | null;
  frequency: number;
  conceptCluster?: string;
};

export type TrackingSignals = {
  pixelConnected: boolean;
  pixelId?: string | null;
  capiEnabled: boolean;
  emqScore?: number | null; // 0–10
  dedupRate?: number | null; // 0–1
  domainVerified?: boolean;
  eventsSeen: string[];
  purchaseEvents7d?: number;
};

export type OptimizeTargets = {
  cpaTarget: number | null;
  roasTarget: number | null;
  dailyBudgetCap: number | null;
  aov?: number | null;
  marginPct?: number | null; // 0–100
  ltv?: number | null;
};

export type OptimizeAccountInput = {
  campaigns: OptimizeCampaignInput[];
  creatives: OptimizeCreativeInput[];
  tracking: TrackingSignals;
  targets: OptimizeTargets;
  priorDaysCpa?: Record<string, number[]>;
  websiteUrl?: string | null;
  brandName?: string | null;
};
