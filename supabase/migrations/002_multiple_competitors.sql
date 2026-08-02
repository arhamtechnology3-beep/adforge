-- Allow multiple competitor URLs per campaign input
ALTER TABLE campaigns_input
  ADD COLUMN IF NOT EXISTS competitors JSONB DEFAULT '[]'::jsonb;

-- Backfill existing single competitor into the array
UPDATE campaigns_input
SET competitors = jsonb_build_array(
  jsonb_build_object('url', competitor_url, 'type', competitor_type)
)
WHERE competitor_url IS NOT NULL
  AND (competitors IS NULL OR competitors = '[]'::jsonb);
