-- Allow users to delete their own generated ads (needed for Regenerate)
CREATE POLICY generated_ads_delete_own ON generated_ads FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM campaigns_input ci
    WHERE ci.id = generated_ads.campaign_input_id AND ci.user_id = auth.uid()
  ));
