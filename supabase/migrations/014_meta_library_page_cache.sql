-- Shared Meta Ad Library creatives by page/domain (any user can read).
-- Hostinger often cannot run Chromium; after one successful fetch (or seed),
-- all accounts get previous real Library ads for that competitor page.

CREATE TABLE IF NOT EXISTS meta_library_page_cache (
  competitor_key TEXT PRIMARY KEY,
  competitor_url TEXT,
  domain TEXT,
  meta_page_id TEXT,
  brand TEXT,
  library_url TEXT,
  ads JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetch_method TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_library_page_cache_page
  ON meta_library_page_cache(meta_page_id);

ALTER TABLE meta_library_page_cache ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read shared Library cache (service role writes).
DO $$ BEGIN
  CREATE POLICY meta_library_page_cache_read ON meta_library_page_cache
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
