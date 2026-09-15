import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  retrieveToken,
  pauseCampaign,
  updateCampaignBudget,
} from '@/lib/meta';
import { notifyAgentChange } from '@/lib/ops-agent/change-email';

type RecPayload = {
  source?: string;
  type?: string;
  severity?: string;
  title?: string;
  body?: string;
  proposed_action?: Record<string, unknown>;
  meta_campaign_id?: string | null;
};

function isEphemeralId(id: string) {
  return id.startsWith('live-') || id.startsWith('dry-');
}

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

  const userId = user.id;
  let body: { decision?: string; recommendation?: RecPayload } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const decision = body.decision as 'approve' | 'reject';
  if (!['approve', 'reject'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
  }

  const ephemeral = isEphemeralId(params.id);
  let rec: {
    id: string;
    user_id: string;
    meta_campaign_id: string | null;
    source: string;
    type: string;
    severity: string;
    title: string;
    body: string;
    proposed_action: Record<string, unknown>;
    status: string;
  } | null = null;

  if (ephemeral) {
    const payload = body.recommendation;
    if (!payload?.title || !payload?.type) {
      return NextResponse.json(
        { error: 'Live recommendation payload required' },
        { status: 400 }
      );
    }
    rec = {
      id: params.id,
      user_id: userId,
      meta_campaign_id: payload.meta_campaign_id || null,
      source: payload.source || 'performance',
      type: payload.type,
      severity: payload.severity || 'info',
      title: payload.title,
      body: payload.body || '',
      proposed_action: payload.proposed_action || {},
      status: 'pending',
    };
  } else {
    const { data, error } = await supabase
      .from('agent_recommendations')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (data.status !== 'pending') {
      return NextResponse.json({ error: 'Already resolved' }, { status: 409 });
    }
    rec = data;
  }

  if (!rec) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const action = rec.proposed_action || {};
  const actionName = String(action.action || rec.type || '');

  if (decision === 'reject') {
    if (ephemeral) {
      await supabase.from('agent_recommendations').insert({
        user_id: userId,
        meta_campaign_id: rec.meta_campaign_id,
        source: rec.source,
        type: rec.type,
        severity: rec.severity,
        title: rec.title,
        body: rec.body,
        proposed_action: rec.proposed_action,
        status: 'rejected',
        resolved_at: new Date().toISOString(),
      });
    } else {
      await supabase
        .from('agent_recommendations')
        .update({ status: 'rejected', resolved_at: new Date().toISOString() })
        .eq('id', rec.id);
    }
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  // Approve
  const { data: adAccount } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: profile } = await supabase
    .from('users')
    .select('email, name, email_reports_opt_in')
    .eq('id', userId)
    .maybeSingle();

  let beforeState: Record<string, unknown> = {};
  let afterState: Record<string, unknown> = {};
  let campaignName: string | null = null;
  let metaChanged = false;
  const campaignId =
    rec.meta_campaign_id ||
    (typeof action.campaignId === 'string' ? action.campaignId : null);

  try {
    if (adAccount?.access_token_encrypted && campaignId) {
      const { data: campaign } = await supabase
        .from('meta_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      campaignName = campaign?.name || null;
      const token = retrieveToken(adAccount.access_token_encrypted);

      if (actionName === 'pause_campaign' && campaign?.meta_campaign_id) {
        beforeState = { status: campaign.status, budget: campaign.budget };
        await pauseCampaign(token, campaign.meta_campaign_id);
        await supabase
          .from('meta_campaigns')
          .update({ status: 'paused' })
          .eq('id', campaign.id);
        afterState = { status: 'paused', budget: campaign.budget };
        metaChanged = true;
      }

      if (
        actionName === 'update_budget' &&
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
        metaChanged = true;
      }
    }
  } catch (err) {
    console.error('[Ops Confirm]', err);
    return NextResponse.json(
      { error: 'Failed to apply on Meta', detail: String(err) },
      { status: 502 }
    );
  }

  let storedId = rec.id;
  if (ephemeral) {
    const { data: inserted, error: insErr } = await supabase
      .from('agent_recommendations')
      .insert({
        user_id: userId,
        meta_campaign_id: campaignId,
        source: rec.source,
        type: rec.type,
        severity: rec.severity,
        title: rec.title,
        body: rec.body,
        proposed_action: rec.proposed_action,
        status: 'applied',
        resolved_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    storedId = inserted?.id || rec.id;
  } else {
    await supabase
      .from('agent_recommendations')
      .update({ status: 'applied', resolved_at: new Date().toISOString() })
      .eq('id', rec.id);
  }

  let emailSent = false;
  if (profile?.email && profile.email_reports_opt_in !== false && metaChanged) {
    const mailed = await notifyAgentChange({
      to: profile.email,
      userName: profile.name,
      title: rec.title,
      detail: rec.body,
      action: actionName,
      campaignName,
      before: beforeState,
      after: afterState,
      severity: rec.severity,
    });
    emailSent = !!mailed.success;
  }

  await supabase.from('agent_change_logs').insert({
    user_id: userId,
    meta_campaign_id: campaignId,
    recommendation_id: ephemeral ? null : storedId,
    action: actionName,
    title: rec.title,
    detail: rec.body,
    before_state: beforeState,
    after_state: afterState,
    email_sent: emailSent,
    email_to: profile?.email || null,
  });

  return NextResponse.json({
    ok: true,
    status: 'applied',
    email_sent: emailSent,
    meta_changed: metaChanged,
    message: metaChanged
      ? 'Applied on Meta.'
      : 'Acknowledged. No automatic Meta change for this recommendation type — follow the suggested steps.',
  });
}
