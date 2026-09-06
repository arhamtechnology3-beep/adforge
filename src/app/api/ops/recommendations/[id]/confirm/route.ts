import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  retrieveToken,
  pauseCampaign,
  updateCampaignBudget,
} from '@/lib/meta';
import { notifyAgentChange } from '@/lib/ops-agent/change-email';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const decision = body.decision as 'approve' | 'reject';

  if (!['approve', 'reject'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
  }

  if (String(params.id).startsWith('dry-')) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      status: decision === 'approve' ? 'applied' : 'rejected',
      message: 'Dry-run recommendation — Connect Meta + run migrations for live apply.',
    });
  }

  const { data: rec, error } = await supabase
    .from('agent_recommendations')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !rec) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (rec.status !== 'pending') {
    return NextResponse.json({ error: 'Already resolved' }, { status: 409 });
  }

  if (decision === 'reject') {
    await supabase
      .from('agent_recommendations')
      .update({ status: 'rejected', resolved_at: new Date().toISOString() })
      .eq('id', rec.id);
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  const action = rec.proposed_action || {};
  const { data: adAccount } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from('users')
    .select('email, name, email_reports_opt_in')
    .eq('id', user.id)
    .maybeSingle();

  let beforeState: Record<string, unknown> = {};
  let afterState: Record<string, unknown> = {};
  let campaignName: string | null = null;

  try {
    if (adAccount?.access_token_encrypted && rec.meta_campaign_id) {
      const { data: campaign } = await supabase
        .from('meta_campaigns')
        .select('*')
        .eq('id', rec.meta_campaign_id)
        .single();

      campaignName = campaign?.name || null;
      const token = retrieveToken(adAccount.access_token_encrypted);

      if (action.action === 'pause_campaign' && campaign?.meta_campaign_id) {
        beforeState = { status: campaign.status, budget: campaign.budget };
        await pauseCampaign(token, campaign.meta_campaign_id);
        await supabase
          .from('meta_campaigns')
          .update({ status: 'paused' })
          .eq('id', campaign.id);
        afterState = { status: 'paused', budget: campaign.budget };
      }

      if (
        action.action === 'update_budget' &&
        campaign?.ad_set_id &&
        typeof action.new_budget === 'number'
      ) {
        beforeState = { status: campaign.status, budget: campaign.budget };
        await updateCampaignBudget(token, campaign.ad_set_id, action.new_budget);
        await supabase
          .from('meta_campaigns')
          .update({ budget: action.new_budget })
          .eq('id', campaign.id);
        afterState = {
          status: campaign.status,
          budget: action.new_budget,
          previous_budget: campaign.budget,
        };
      }
    }
  } catch (err) {
    console.error('[Ops Confirm]', err);
    return NextResponse.json(
      { error: 'Failed to apply on Meta', detail: String(err) },
      { status: 502 }
    );
  }

  await supabase
    .from('agent_recommendations')
    .update({ status: 'applied', resolved_at: new Date().toISOString() })
    .eq('id', rec.id);

  let emailSent = false;
  if (profile?.email && profile.email_reports_opt_in !== false) {
    const mailed = await notifyAgentChange({
      to: profile.email,
      userName: profile.name,
      title: rec.title,
      detail: rec.body,
      action: String(action.action || rec.type),
      campaignName,
      before: beforeState,
      after: afterState,
      severity: rec.severity,
    });
    emailSent = !!mailed.success;
  }

  await supabase.from('agent_change_logs').insert({
    user_id: user.id,
    meta_campaign_id: rec.meta_campaign_id || null,
    recommendation_id: rec.id,
    action: String(action.action || rec.type),
    title: rec.title,
    detail: rec.body,
    before_state: beforeState,
    after_state: afterState,
    email_sent: emailSent,
    email_to: profile?.email || null,
  });

  return NextResponse.json({ ok: true, status: 'applied', email_sent: emailSent });
}
