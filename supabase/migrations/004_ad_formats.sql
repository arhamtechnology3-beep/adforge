-- Multi-format Meta creatives (image / carousel / stories / video)
ALTER TABLE generated_ads
  ADD COLUMN IF NOT EXISTS ad_format TEXT NOT NULL DEFAULT 'single_image',
  ADD COLUMN IF NOT EXISTS media_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS angle TEXT;

CREATE INDEX IF NOT EXISTS idx_generated_ads_ad_format ON generated_ads(ad_format);

COMMENT ON COLUMN generated_ads.ad_format IS 'single_image | carousel | stories | video';
COMMENT ON COLUMN generated_ads.media_payload IS 'Carousel cards, video frames, placement specs';
