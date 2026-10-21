import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import { getDemoCampaign, upsertDemoCampaign } from '@/lib/auth/demo-campaigns';
import { normalizeWebsiteCta } from '@/lib/meta-campaign';
import type { MetaCampaign } from '@/types/database';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 120);
  const budget = Number(body.budget);
  const objective = String(body.objective || '').trim();
  const adIds = Array.isArray(body.ad_ids) ? body.ad_ids.map(String) : null;

  if (!name || !objective || !Number.isFinite(budget) || budget < 100) {
    return NextResponse.json(
      { error: 'Name, objective, and a budget of at least ₹100 are required' },
      { status: 400 }
    );
  }
  if (!adIds?.length) {
    return NextResponse.json({ error: 'Select at least one approved ad' }, { status: 400 });
  }

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

  if (!source) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (source.status !== 'draft') {
    return NextResponse.json(
      { error: 'Live campaigns cannot be edited. Duplicate one to change a copy.' },
      { status: 400 }
    );
  }

  const audience = (body.audience || {}) as Record<string, unknown>;
  const previous = (source.launch_config || {}) as Record<string, unknown>;
  const previousAds = [...(source.ad_ids || [])].sort().join(',');
  const nextAds = [...adIds].sort().join(',');
  const launchConfig: Record<string, unknown> = {
    ...previous,
    audience,
    budget_type: body.budget_type === 'lifetime' ? 'lifetime' : 'daily',
    cta: normalizeWebsiteCta(String(body.cta || audience.cta || 'SHOP_NOW')),
    website_url: body.website_url || source.website_url,
    ad_count: adIds.length,
  };
  if (previousAds !== nextAds) {
    delete launchConfig.meta_ad_ids;
    launchConfig.meta_synced = false;
  }

  const website = typeof body.website_url === 'string' ? body.website_url : source.website_url;
  const updated: MetaCampaign = {
    ...source,
    name,
    budget,
    objective,
    website_url: website,
    ad_ids: adIds,
    launch_config: launchConfig,
    status: 'draft',
  };

  if (user.isDemo) {
    await upsertDemoCampaign(updated, user.id);
    return NextResponse.json({
      campaign: updated,
      message: `Draft “${name}” updated.`,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('meta_campaigns')
    .update({
      name,
      budget,
      objective,
      website_url: website,
      ad_ids: adIds,
      launch_config: launchConfig,
      status: 'draft',
    })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Could not save campaign' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    campaign: data,
    message: `Draft “${name}” updated.`,
  });
}
