-- Reports Sync upserts the same campaign/date row. Without UPDATE, the
-- logged-in user (anon key + RLS) cannot refresh today's snapshot.

CREATE POLICY performance_snapshots_update_own ON performance_snapshots FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM meta_campaigns mc
    WHERE mc.id = performance_snapshots.meta_campaign_id AND mc.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meta_campaigns mc
    WHERE mc.id = performance_snapshots.meta_campaign_id AND mc.user_id = auth.uid()
  ));
