-- One subscription (users.plan_tier + Razorpay) can own several stores.
-- Each store keeps its own website, catalog, Meta connection, campaigns, and ops targets.

CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Store',
  website_url TEXT,
  cpa_target NUMERIC,
  roas_target NUMERIC,
  daily_budget_cap NUMERIC,
  agent_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  margin_pct NUMERIC,
  aov_default NUMERIC,
  ltv_default NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY stores_select_own ON stores FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY stores_insert_own ON stores FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY stores_update_own ON stores FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY stores_delete_own ON stores FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One store per existing subscriber, copying the brand they already run.
INSERT INTO stores (
  user_id, name, website_url, cpa_target, roas_target, daily_budget_cap,
  agent_settings, margin_pct, aov_default, ltv_default
)
SELECT DISTINCT ON (u.id)
  u.id,
  COALESCE(
    NULLIF(btrim(bp.brand_name), ''),
    NULLIF(btrim(u.name), ''),
    split_part(COALESCE(u.email, 'store'), '@', 1)
  ),
  COALESCE(NULLIF(btrim(bp.website_url), ''), ci.website_url),
  u.cpa_target,
  u.roas_target,
  u.daily_budget_cap,
  COALESCE(u.agent_settings, '{}'::jsonb),
  u.margin_pct,
  u.aov_default,
  u.ltv_default
FROM users u
LEFT JOIN brand_profiles bp ON bp.user_id = u.id
LEFT JOIN LATERAL (
  SELECT website_url
  FROM campaigns_input c
  WHERE c.user_id = u.id
  ORDER BY c.created_at DESC
  LIMIT 1
) ci ON true
WHERE NOT EXISTS (SELECT 1 FROM stores s WHERE s.user_id = u.id)
ORDER BY u.id, bp.created_at DESC NULLS LAST;

-- New signups get a store alongside the user profile.
CREATE OR REPLACE FUNCTION public.handle_new_user_store()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stores (
    user_id, name, cpa_target, roas_target, daily_budget_cap, agent_settings
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.name), ''), split_part(COALESCE(NEW.email, 'store'), '@', 1), 'Store'),
    NEW.cpa_target,
    NEW.roas_target,
    NEW.daily_budget_cap,
    COALESCE(NEW.agent_settings, '{}'::jsonb)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created_store ON public.users;
CREATE TRIGGER on_user_created_store
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_store();

-- Attach store_id and point existing rows at that user's store.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brand_profiles',
    'products',
    'campaigns_input',
    'ad_accounts',
    'meta_campaigns',
    'competitor_library_cache',
    'optimize_ab_tests',
    'optimize_health_snapshots',
    'capi_event_logs',
    'optimize_audience_plans',
    'agent_runs',
    'agent_recommendations',
    'meta_policy_scans',
    'agent_change_logs',
    'generation_jobs',
    'creative_usage',
    'creative_memory',
    'report_logs'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE',
      t
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_store_id ON %I(store_id)', t, t);
    EXECUTE format(
      'UPDATE %I child SET store_id = s.id FROM stores s WHERE child.store_id IS NULL AND child.user_id = s.user_id',
      t
    );
  END LOOP;
END $$;

-- One brand profile and one Meta connection per store (not per user).
ALTER TABLE brand_profiles DROP CONSTRAINT IF EXISTS brand_profiles_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_profiles_store_id ON brand_profiles(store_id);

DROP INDEX IF EXISTS idx_ad_accounts_user_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_accounts_store_id_unique ON ad_accounts(store_id);

ALTER TABLE competitor_library_cache
  DROP CONSTRAINT IF EXISTS competitor_library_cache_user_id_competitor_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_library_cache_store_key
  ON competitor_library_cache(store_id, competitor_key);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brand_profiles',
    'products',
    'campaigns_input',
    'ad_accounts',
    'meta_campaigns'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN store_id SET NOT NULL', t);
    EXCEPTION
      WHEN not_null_violation THEN NULL;
      WHEN others THEN
        IF SQLERRM ILIKE '%contains null%' OR SQLERRM ILIKE '%not-null%' THEN
          NULL;
        ELSE
          RAISE;
        END IF;
    END;
  END LOOP;
END $$;
