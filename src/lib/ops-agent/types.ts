import type { AgentRecSeverity, InsightBreakdowns } from '@/types/database';

export const META_POLICY_PACK_VERSION = 'v1';

export type RecommendationDraft = {
  source: 'performance' | 'policy';
  type: string;
  severity: AgentRecSeverity;
  title: string;
  body: string;
  proposed_action: Record<string, unknown>;
  meta_campaign_id?: string | null;
  auto_apply?: boolean;
};

export type CampaignMetrics = {
  campaignId: string;
  campaignName: string;
  status: string;
  budget: number | null;
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
  add_to_cart: number;
  initiate_checkout: number;
  conversion_rate: number | null;
  video_views: number;
  engagement_rate: number | null;
  revenue: number;
  reach: number;
};

export type AgentTargets = {
  cpaTarget: number | null;
  roasTarget: number | null;
  dailyBudgetCap: number | null;
};

export type SnapshotRow = CampaignMetrics & {
  date: string;
  breakdowns?: InsightBreakdowns;
};

export type CreativeRow = {
  id: string;
  name: string;
  format: string;
  spend: number;
  ctr: number;
  cpc: number;
  cpa: number | null;
  frequency: number;
  copy_text?: string;
  headline?: string;
};
