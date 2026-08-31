export type PlanTier = 'starter' | 'growth' | 'scale';
export type CompetitorType = 'website' | 'facebook' | 'instagram';
export type AdStatus = 'pending' | 'approved' | 'rejected';
export type AdFormat = 'single_image' | 'carousel' | 'stories' | 'video';
export type CampaignStatus = 'draft' | 'active' | 'paused';
export type ReportChannel = 'email' | 'whatsapp';
export type AgentSlot = 'morning' | 'midday' | 'afternoon' | 'evening' | 'manual';
export type AgentRecSource = 'performance' | 'policy';
export type AgentRecSeverity = 'critical' | 'high' | 'medium' | 'info';
export type AgentRecStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'expired';

export interface CarouselCard {
  image_url: string;
  headline: string;
  description?: string;
}

export interface VideoFrame {
  image_url: string;
  headline: string;
  duration_ms?: number;
}

export interface AdMediaPayload {
  placement?: string;
  aspect?: string;
  cards?: CarouselCard[];
  frames?: VideoFrame[];
  product_images?: string[];
  /** Competitor Library ad this creative replicates */
  source_library_id?: string | null;
  source_headline?: string | null;
  source_primary_text?: string | null;
  source_brand?: string | null;
  replicate?: boolean;
  manual?: boolean;
  creative_brief?: {
    mood?: string;
    counter_hook?: string;
    layout?: string;
    scene_provider?: string;
  };
  video_url?: string | null;
  scene_provider?: string | null;
}

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_opt_in: boolean;
  email_reports_opt_in: boolean;
  report_channel: ReportChannel;
  plan_tier: PlanTier;
  trial_ends_at: string | null;
  cpa_target: number | null;
  roas_target: number | null;
  daily_budget_cap: number | null;
  agent_settings: Record<string, unknown>;
  report_frequency: string;
  razorpay_subscription_id: string | null;
  razorpay_customer_id: string | null;
  created_at: string;
}

export interface AdAccount {
  id: string;
  user_id: string;
  meta_ad_account_id: string | null;
  access_token_encrypted: string | null;
  token_expires_at: string | null;
  connected_at: string;
}

export interface CompetitorEntry {
  url: string;
  type: CompetitorType;
  /** Facebook Page ID from Ad Library (e.g. FarmDidi = 108788791719221) */
  meta_page_id?: string | null;
}

export interface CampaignInput {
  id: string;
  user_id: string;
  website_url: string;
  competitor_url: string | null;
  competitor_type: CompetitorType | null;
  competitors: CompetitorEntry[];
  created_at: string;
}

export interface GeneratedAd {
  id: string;
  campaign_input_id: string;
  variant_number: number;
  copy_text: string;
  image_url: string | null;
  status: AdStatus;
  ad_format: AdFormat;
  media_payload: AdMediaPayload;
  headline: string | null;
  angle: string | null;
  created_at: string;
}

export interface MetaCampaign {
  id: string;
  user_id: string;
  meta_campaign_id: string | null;
  ad_set_id: string | null;
  budget: number | null;
  objective: string | null;
  status: CampaignStatus;
  name: string | null;
  website_url: string | null;
  ad_ids: string[];
  launch_config: Record<string, unknown>;
  created_at: string;
}

export interface InsightBreakdowns {
  placement?: Array<{ name: string; spend: number; impressions?: number; ctr?: number }>;
  age?: Array<{ name: string; spend: number; purchases?: number }>;
  gender?: Array<{ name: string; spend: number }>;
  device?: Array<{ name: string; spend: number; ctr?: number }>;
  geo?: Array<{ name: string; spend: number }>;
  audience?: Array<{ name: string; spend: number; cpa?: number; roas?: number }>;
}

export interface PerformanceSnapshot {
  id: string;
  meta_campaign_id: string;
  date: string;
  cpc: number | null;
  cpa: number | null;
  ctr: number | null;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  cpm: number | null;
  frequency: number | null;
  purchases: number | null;
  add_to_cart: number | null;
  initiate_checkout: number | null;
  cost_per_purchase: number | null;
  roas: number | null;
  conversion_rate: number | null;
  video_views: number | null;
  engagement_rate: number | null;
  revenue: number | null;
  raw_insights: Record<string, unknown>;
  breakdowns: InsightBreakdowns;
}

export interface ReportLog {
  id: string;
  user_id: string;
  sent_at: string;
  channel: ReportChannel;
  report_type: string;
}

export interface AgentRun {
  id: string;
  user_id: string | null;
  slot: AgentSlot;
  status: string;
  summary: Record<string, unknown>;
  created_at: string;
}

export interface AgentRecommendation {
  id: string;
  user_id: string;
  meta_campaign_id: string | null;
  source: AgentRecSource;
  type: string;
  severity: AgentRecSeverity;
  title: string;
  body: string;
  proposed_action: Record<string, unknown>;
  status: AgentRecStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface MetaPolicyRule {
  id: string;
  version: string;
  effective_at: string;
  category: string;
  severity: AgentRecSeverity;
  pattern: string | null;
  pattern_text: string | null;
  match_fields: string[];
  match_statuses: string[];
  remediation: string;
  remediation_copy: string | null;
  enabled: boolean;
}

export interface MetaPolicyScan {
  id: string;
  user_id: string;
  meta_campaign_id: string | null;
  ad_id: string | null;
  rule_id: string | null;
  matched: boolean;
  action_taken: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
