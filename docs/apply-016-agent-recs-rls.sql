-- Apply in Supabase SQL Editor (required for Ops Acknowledge on live-* cards).
-- Source: supabase/migrations/016_agent_recommendations_insert_rls.sql

DROP POLICY IF EXISTS agent_recs_insert_own ON agent_recommendations;
CREATE POLICY agent_recs_insert_own ON agent_recommendations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS agent_recs_delete_own ON agent_recommendations;
CREATE POLICY agent_recs_delete_own ON agent_recommendations
  FOR DELETE
  USING (user_id = auth.uid());

ALTER TABLE agent_change_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_change_logs_select_own ON agent_change_logs;
CREATE POLICY agent_change_logs_select_own ON agent_change_logs
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS agent_change_logs_insert_own ON agent_change_logs;
CREATE POLICY agent_change_logs_insert_own ON agent_change_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
