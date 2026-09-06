-- Ops Agent Phase 1–3: Meta Pixel on ad accounts + agent change audit/emails

ALTER TABLE ad_accounts
  ADD COLUMN IF NOT EXISTS pixel_id TEXT,
  ADD COLUMN IF NOT EXISTS pixel_name TEXT;

CREATE TABLE IF NOT EXISTS agent_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meta_campaign_id UUID REFERENCES meta_campaigns(id) ON DELETE SET NULL,
  recommendation_id UUID REFERENCES agent_recommendations(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  before_state JSONB DEFAULT '{}'::jsonb,
  after_state JSONB DEFAULT '{}'::jsonb,
  email_sent BOOLEAN DEFAULT FALSE,
  email_to TEXT,
  screenshot_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_change_logs_user_id ON agent_change_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_change_logs_created_at ON agent_change_logs(created_at DESC);
