-- Persist last successful Meta Ad Library fetch per competitor (any URL the user adds).
-- Used when live Playwright/API fetch fails on Hostinger.

CREATE TABLE IF NOT EXISTS competitor_library_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competitor_key TEXT NOT NULL,
  competitor_url TEXT,
  domain TEXT,
  meta_page_id TEXT,
  brand TEXT,
  library_url TEXT,
  ads JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetch_method TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, competitor_key)
);

CREATE INDEX IF NOT EXISTS idx_competitor_library_cache_user
  ON competitor_library_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_competitor_library_cache_page
  ON competitor_library_cache(meta_page_id);

ALTER TABLE competitor_library_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY competitor_library_cache_own ON competitor_library_cache
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
