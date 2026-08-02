export type PlanTier = 'starter' | 'growth' | 'scale';
export type CompetitorType = 'website' | 'facebook' | 'instagram';
export type AdStatus = 'pending' | 'approved' | 'rejected';
export type CampaignStatus = 'draft' | 'active' | 'paused';
export type ReportChannel = 'whatsapp' | 'email';

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_opt_in: boolean;
  plan_tier: PlanTier;
  trial_ends_at: string | null;
  cpa_target: number | null;
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
  created_at: string;
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
}

export interface ReportLog {
  id: string;
  user_id: string;
  sent_at: string;
  channel: ReportChannel;
  report_type: string;
}
