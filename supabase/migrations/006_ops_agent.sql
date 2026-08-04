-- Ops Agent + Reports Hub + Meta Policy Guard

-- Expanded performance snapshots
ALTER TABLE performance_snapshots
  ADD COLUMN IF NOT EXISTS reach INT,
  ADD COLUMN IF NOT EXISTS clicks INT,
  ADD COLUMN IF NOT EXISTS cpm NUMERIC,
  ADD COLUMN IF NOT EXISTS frequency NUMERIC,
  ADD COLUMN IF NOT EXISTS purchases NUMERIC,
  ADD COLUMN IF NOT EXISTS add_to_cart NUMERIC,
  ADD COLUMN IF NOT EXISTS initiate_checkout NUMERIC,
  ADD COLUMN IF NOT EXISTS cost_per_purchase NUMERIC,
  ADD COLUMN IF NOT EXISTS roas NUMERIC,
  ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS video_views NUMERIC,
  ADD COLUMN IF NOT EXISTS engagement_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS revenue NUMERIC,
  ADD COLUMN IF NOT EXISTS raw_insights JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS breakdowns JSONB DEFAULT '{}'::jsonb;

-- User prefs for email reports + agent targets
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_reports_opt_in BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS report_channel TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS roas_target NUMERIC,
  ADD COLUMN IF NOT EXISTS daily_budget_cap NUMERIC,
  ADD COLUMN IF NOT EXISTS agent_settings JSONB DEFAULT '{}'::jsonb;

-- Agent runs (morning / midday / afternoon / evening)
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('morning', 'midday', 'afternoon', 'evening', 'manual')),
  status TEXT NOT NULL DEFAULT 'completed',
  summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON agent_runs(created_at DESC);

-- Agent recommendations (performance + policy)
CREATE TABLE IF NOT EXISTS agent_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meta_campaign_id UUID REFERENCES meta_campaigns(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'performance' CHECK (source IN ('performance', 'policy')),
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'info')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  proposed_action JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_recs_user_id ON agent_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_recs_status ON agent_recommendations(status);

-- Versioned Meta policy norms pack
CREATE TABLE IF NOT EXISTS meta_policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  effective_at TIMESTAMPTZ DEFAULT NOW(),
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'info')),
  pattern TEXT,
  pattern_text TEXT,
  match_fields TEXT[] DEFAULT ARRAY['copy_text', 'headline'],
  match_statuses TEXT[] DEFAULT ARRAY[]::TEXT[],
  remediation TEXT NOT NULL DEFAULT 'recommend',
  remediation_copy TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_policy_rules_version ON meta_policy_rules(version);

-- Policy scan audit log
CREATE TABLE IF NOT EXISTS meta_policy_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meta_campaign_id UUID REFERENCES meta_campaigns(id) ON DELETE SET NULL,
  ad_id UUID REFERENCES generated_ads(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES meta_policy_rules(id) ON DELETE SET NULL,
  matched BOOLEAN DEFAULT FALSE,
  action_taken TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_policy_scans_user_id ON meta_policy_scans(user_id);

-- Seed policy pack v1
INSERT INTO meta_policy_rules (version, category, severity, pattern, pattern_text, remediation, remediation_copy)
VALUES
  ('v1', 'personal_attributes', 'high',
   '(you are|you''re|are you)\s+(fat|ugly|poor|broke|overweight|depressed)',
   'Personal attributes targeting claims',
   'auto_pause',
   'Paused: Meta disallows personal attribute claims in ads.'),
  ('v1', 'health_before_after', 'high',
   '(before\s*(and|&|/)\s*after|lose\s+\d+\s*(kg|kilo|lbs)|miracle\s+cure|guaranteed\s+weight)',
   'Health/weight before-after or miracle claims',
   'auto_pause',
   'Paused: health transformation claims risk account restriction.'),
  ('v1', 'income_guarantees', 'critical',
   '(guaranteed\s+(income|profit|returns)|earn\s+₹?\s*\d+\s*(lakh|crore|/day)|get\s+rich\s+quick)',
   'Unrealistic income / guaranteed returns',
   'auto_pause',
   'Paused: income guarantees violate Meta advertising standards.'),
  ('v1', 'misleading_urgency', 'medium',
   '(last\s+chance\s+ever|only\s+1\s+left\s+worldwide|act\s+now\s+or\s+lose\s+forever)',
   'Misleading urgency / scarcity spam',
   'recommend',
   'Soften urgency language to avoid policy flags.'),
  ('v1', 'caps_spam', 'medium',
   '([A-Z]{12,}|!!!{2,}|₹₹₹+)',
   'Excessive caps / punctuation spam',
   'recommend',
   'Reduce caps and repeated punctuation for Meta best practices.'),
  ('v1', 'restricted_crypto', 'high',
   '(crypto\s+guaranteed|bitcoin\s+double|nft\s+guaranteed\s+profit)',
   'Restricted financial / crypto claims',
   'auto_pause',
   'Paused: restricted financial claims.'),
  ('v1', 'disapproval_status', 'critical',
   NULL,
   'Ad effective_status DISAPPROVED or WITH_ISSUES',
   'auto_pause',
   'Paused: Meta disapproval / delivery issues detected.');

-- RLS
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_policy_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_runs_select_own ON agent_runs FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY agent_recs_select_own ON agent_recommendations FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY agent_recs_update_own ON agent_recommendations FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY meta_policy_rules_select_all ON meta_policy_rules FOR SELECT
  USING (true);
CREATE POLICY meta_policy_scans_select_own ON meta_policy_scans FOR SELECT
  USING (user_id = auth.uid());
