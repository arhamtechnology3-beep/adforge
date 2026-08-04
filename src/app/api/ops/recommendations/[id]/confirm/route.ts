import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  retrieveToken,
  pauseCampaign,
  updateCampaignBudget,
} from '@/lib/meta';

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

  try {
    if (adAccount?.access_token_encrypted && rec.meta_campaign_id) {
      const { data: campaign } = await supabase
        .from('meta_campaigns')
        .select('*')
        .eq('id', rec.meta_campaign_id)
        .single();

      const token = retrieveToken(adAccount.access_token_encrypted);

      if (action.action === 'pause_campaign' && campaign?.meta_campaign_id) {
        await pauseCampaign(token, campaign.meta_campaign_id);
        await supabase
          .from('meta_campaigns')
          .update({ status: 'paused' })
          .eq('id', campaign.id);
      }

      if (
        action.action === 'update_budget' &&
        campaign?.ad_set_id &&
        typeof action.new_budget === 'number'
      ) {
        await updateCampaignBudget(token, campaign.ad_set_id, action.new_budget);
        await supabase
          .from('meta_campaigns')
          .update({ budget: action.new_budget })
          .eq('id', campaign.id);
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

  return NextResponse.json({ ok: true, status: 'applied' });
}
