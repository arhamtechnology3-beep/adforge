import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import { resolveMetaConnection } from '@/lib/auth/demo-meta';
import {
  buildDemoCampaign,
  getDemoCampaign,
  upsertDemoCampaign,
} from '@/lib/auth/demo-campaigns';
import type { MetaCampaign } from '@/types/database';

function copyName(name: string | null): string {
  const base = (name || 'Campaign').replace(/\s·\s*copy(?:\s\d+)?$/i, '').trim();
  return `${base} · copy`.slice(0, 120);
}

function draftLaunchConfig(source: Record<string, unknown> | null | undefined) {
  const next = { ...(source || {}) };
  delete next.meta_ad_ids;
  delete next.activated_locally;
  delete next.activated_at;
  delete next.note;
  next.duplicated_at = new Date().toISOString();
  return next;
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let source: MetaCampaign | null = null;
  if (user.isDemo) {
    source = await getDemoCampaign(params.id, user.id);
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from('meta_campaigns')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();
    source = (data as MetaCampaign | null) || null;
  }

  if (!source) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const launchConfig = draftLaunchConfig(source.launch_config as Record<string, unknown>);
  const name = copyName(source.name);

  if (user.isDemo) {
    const campaign = await upsertDemoCampaign(
      buildDemoCampaign({
        userId: user.id,
        name,
        website_url: source.website_url,
        budget: Number(source.budget || 500),
        objective: source.objective || 'OUTCOME_SALES',
        status: 'draft',
        ad_ids: source.ad_ids || [],
        launch_config: launchConfig,
      }),
      user.id
    );
    return NextResponse.json({
      campaign,
      message: `Draft “${name}” created. Confirm & Launch when you want it live.`,
    });
  }

  const metaConnection = await resolveMetaConnection(user);
  const insertRow: Record<string, unknown> = {
    user_id: user.id,
    ...(source.store_id || metaConnection?.store_id
      ? { store_id: source.store_id || metaConnection?.store_id }
      : {}),
    meta_campaign_id: null,
    ad_set_id: null,
    budget: Number(source.budget || 500),
    objective: source.objective || 'OUTCOME_SALES',
    status: 'draft',
    name,
    website_url: source.website_url,
    ad_ids: source.ad_ids || [],
    launch_config: launchConfig,
  };

  const supabase = await createClient();
  let { data, error } = await supabase.from('meta_campaigns').insert(insertRow).select().single();

  if (error && /name|website_url|ad_ids|launch_config|store_id/i.test(error.message)) {
    const retry = await supabase
      .from('meta_campaigns')
      .insert({
        user_id: user.id,
        meta_campaign_id: null,
        ad_set_id: null,
        budget: Number(source.budget || 500),
        objective: source.objective || 'OUTCOME_SALES',
        status: 'draft',
      })
      .select()
      .single();
    data = retry.data
      ? {
          ...retry.data,
          name,
          website_url: source.website_url,
          ad_ids: source.ad_ids || [],
          launch_config: launchConfig,
        }
      : null;
    error = retry.error;
  }

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Could not duplicate campaign' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    campaign: data,
    message: `Draft “${name}” created. Confirm & Launch when you want it live.`,
  });
}
