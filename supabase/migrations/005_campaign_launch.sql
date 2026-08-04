-- Campaign launch metadata (selected creatives, destination, name)
ALTER TABLE meta_campaigns
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS ad_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS launch_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN meta_campaigns.ad_ids IS 'Approved generated_ads selected for this campaign';
COMMENT ON COLUMN meta_campaigns.launch_config IS 'Audience, placements, format mix, Meta sync status';
