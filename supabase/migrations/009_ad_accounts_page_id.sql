-- Store Facebook Page ID from Meta OAuth for ad creative publishing
ALTER TABLE ad_accounts
  ADD COLUMN IF NOT EXISTS page_id TEXT,
  ADD COLUMN IF NOT EXISTS page_name TEXT;

COMMENT ON COLUMN ad_accounts.page_id IS 'Facebook Page ID used as actor for Meta ads';
COMMENT ON COLUMN ad_accounts.page_name IS 'Facebook Page display name from OAuth';
