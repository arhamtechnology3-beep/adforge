-- Store Meta ad account timezone (display + India warning). Immutable on Meta side.

ALTER TABLE ad_accounts
  ADD COLUMN IF NOT EXISTS timezone_id INT,
  ADD COLUMN IF NOT EXISTS timezone_name TEXT,
  ADD COLUMN IF NOT EXISTS timezone_offset_hours_utc NUMERIC;

COMMENT ON COLUMN ad_accounts.timezone_name IS 'Meta ad account timezone_name (e.g. America/Los_Angeles or Asia/Kolkata)';
COMMENT ON COLUMN ad_accounts.timezone_id IS 'Meta timezone_id (1 = America/Los_Angeles, 71 = Asia/Kolkata)';
