-- Meta Optimize suite (Health Score, CAPI logs, A/B plans, audience specs)

CREATE TABLE IF NOT EXISTS optimize_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_kpi TEXT NOT NULL DEFAULT 'CPA',
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'running', 'completed', 'cancelled')),
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  results JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optimize_ab_tests_user ON optimize_ab_tests(user_id);

CREATE TABLE IF NOT EXISTS optimize_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INT NOT NULL,
  grade TEXT NOT NULL,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  dry_run BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optimize_health_user ON optimize_health_snapshots(user_id);

CREATE TABLE IF NOT EXISTS capi_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_id TEXT NOT NULL,
  dry_run BOOLEAN DEFAULT TRUE,
  ok BOOLEAN DEFAULT TRUE,
  estimated_emq NUMERIC,
  payload JSONB DEFAULT '{}'::jsonb,
  meta_response JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_user ON capi_event_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_capi_event_logs_event_id ON capi_event_logs(event_id);

CREATE TABLE IF NOT EXISTS optimize_audience_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optimize_audience_plans_user ON optimize_audience_plans(user_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS margin_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS aov_default NUMERIC,
  ADD COLUMN IF NOT EXISTS ltv_default NUMERIC;

-- RLS
ALTER TABLE optimize_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimize_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE capi_event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimize_audience_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY optimize_ab_tests_own ON optimize_ab_tests
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY optimize_health_own ON optimize_health_snapshots
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY capi_event_logs_own ON capi_event_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY optimize_audience_plans_own ON optimize_audience_plans
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
