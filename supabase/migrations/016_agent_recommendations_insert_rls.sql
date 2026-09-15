-- Ops Acknowledge/Reject for live-* cards inserts into agent_recommendations.
-- 006 only had SELECT + UPDATE; INSERT was blocked by RLS for the user session.

CREATE POLICY agent_recs_insert_own ON agent_recommendations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow users to remove their own rows (optional cleanup / supersede)
CREATE POLICY agent_recs_delete_own ON agent_recommendations
  FOR DELETE
  USING (user_id = auth.uid());

-- Change logs written on confirm
ALTER TABLE agent_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_change_logs_select_own ON agent_change_logs
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY agent_change_logs_insert_own ON agent_change_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
