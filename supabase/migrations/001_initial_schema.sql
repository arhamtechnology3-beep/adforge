-- Facebook Meta Ads SaaS — Initial Schema
-- Run this in Supabase SQL Editor or via supabase db push

-- Enums
CREATE TYPE plan_tier AS ENUM ('starter', 'growth', 'scale');
CREATE TYPE competitor_type AS ENUM ('website', 'facebook', 'instagram');
CREATE TYPE ad_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused');
CREATE TYPE report_channel AS ENUM ('whatsapp', 'email');

-- Users (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  whatsapp_opt_in BOOLEAN DEFAULT TRUE,
  plan_tier plan_tier DEFAULT 'starter',
  trial_ends_at TIMESTAMPTZ,
  cpa_target NUMERIC,
  report_frequency TEXT DEFAULT 'weekly',
  razorpay_subscription_id TEXT,
  razorpay_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ad Accounts (Meta connection)
CREATE TABLE ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meta_ad_account_id TEXT,
  access_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ad_accounts_user_id ON ad_accounts(user_id);
CREATE UNIQUE INDEX idx_ad_accounts_user_id_unique ON ad_accounts(user_id);

-- Campaign Inputs (onboarding data)
CREATE TABLE campaigns_input (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  website_url TEXT NOT NULL,
  competitor_url TEXT,
  competitor_type competitor_type,
  competitors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_input_user_id ON campaigns_input(user_id);

-- Generated Ads
CREATE TABLE generated_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_input_id UUID NOT NULL REFERENCES campaigns_input(id) ON DELETE CASCADE,
  variant_number INT NOT NULL,
  copy_text TEXT NOT NULL,
  image_url TEXT,
  status ad_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generated_ads_campaign_input_id ON generated_ads(campaign_input_id);

-- Meta Campaigns
CREATE TABLE meta_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meta_campaign_id TEXT,
  ad_set_id TEXT,
  budget NUMERIC,
  objective TEXT,
  status campaign_status DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meta_campaigns_user_id ON meta_campaigns(user_id);

-- Performance Snapshots
CREATE TABLE performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_campaign_id UUID NOT NULL REFERENCES meta_campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  cpc NUMERIC,
  cpa NUMERIC,
  ctr NUMERIC,
  spend NUMERIC,
  impressions INT,
  UNIQUE(meta_campaign_id, date)
);

CREATE INDEX idx_performance_snapshots_meta_campaign_id ON performance_snapshots(meta_campaign_id);

-- Report Logs
CREATE TABLE report_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  channel report_channel NOT NULL,
  report_type TEXT NOT NULL
);

CREATE INDEX idx_report_logs_user_id ON report_logs(user_id);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, trial_ends_at, plan_tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NOW() + INTERVAL '7 days',
    'starter'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns_input ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_logs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY users_select_own ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth.uid() = id);

-- Ad accounts policies
CREATE POLICY ad_accounts_select_own ON ad_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ad_accounts_insert_own ON ad_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ad_accounts_update_own ON ad_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ad_accounts_delete_own ON ad_accounts FOR DELETE USING (auth.uid() = user_id);

-- Campaigns input policies
CREATE POLICY campaigns_input_select_own ON campaigns_input FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY campaigns_input_insert_own ON campaigns_input FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY campaigns_input_update_own ON campaigns_input FOR UPDATE USING (auth.uid() = user_id);

-- Generated ads policies (via campaign_input ownership)
CREATE POLICY generated_ads_select_own ON generated_ads FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM campaigns_input ci
    WHERE ci.id = generated_ads.campaign_input_id AND ci.user_id = auth.uid()
  ));
CREATE POLICY generated_ads_insert_own ON generated_ads FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaigns_input ci
    WHERE ci.id = generated_ads.campaign_input_id AND ci.user_id = auth.uid()
  ));
CREATE POLICY generated_ads_update_own ON generated_ads FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM campaigns_input ci
    WHERE ci.id = generated_ads.campaign_input_id AND ci.user_id = auth.uid()
  ));

-- Meta campaigns policies
CREATE POLICY meta_campaigns_select_own ON meta_campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY meta_campaigns_insert_own ON meta_campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY meta_campaigns_update_own ON meta_campaigns FOR UPDATE USING (auth.uid() = user_id);

-- Performance snapshots policies (via meta_campaign ownership)
-- IMPORTANT: qualify performance_snapshots.meta_campaign_id — otherwise Postgres
-- resolves meta_campaign_id to meta_campaigns.meta_campaign_id (TEXT) and fails with
-- "operator does not exist: uuid = text"
CREATE POLICY performance_snapshots_select_own ON performance_snapshots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM meta_campaigns mc
    WHERE mc.id = performance_snapshots.meta_campaign_id AND mc.user_id = auth.uid()
  ));
CREATE POLICY performance_snapshots_insert_own ON performance_snapshots FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM meta_campaigns mc
    WHERE mc.id = performance_snapshots.meta_campaign_id AND mc.user_id = auth.uid()
  ));

-- Report logs policies
CREATE POLICY report_logs_select_own ON report_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY report_logs_insert_own ON report_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
