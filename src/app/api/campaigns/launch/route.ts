import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  retrieveToken,
  createCampaign,
  createAdSet,
  createAd,
} from '@/lib/meta';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ad_ids, budget, objective } = await request.json();

  if (!ad_ids?.length || !budget || !objective) {
    return NextResponse.json(
      { error: 'ad_ids, budget, and objective are required' },
      { status: 400 }
    );
  }

  const { data: ads } = await supabase
    .from('generated_ads')
    .select('*, campaigns_input!inner(*)')
    .in('id', ad_ids)
    .eq('status', 'approved');

  if (!ads?.length) {
    return NextResponse.json({ error: 'No approved ads found' }, { status: 400 });
  }

  const { data: adAccount } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!adAccount?.access_token_encrypted || !adAccount.meta_ad_account_id) {
    return NextResponse.json(
      { error: 'Meta ad account not connected. Complete onboarding first.' },
      { status: 400 }
    );
  }

  try {
    const token = retrieveToken(adAccount.access_token_encrypted);
    const adAccountId = adAccount.meta_ad_account_id;

    const campaign = await createCampaign(
      token,
      adAccountId,
      `Campaign ${Date.now()}`,
      objective
    );

    const adSet = await createAdSet(
      token,
      adAccountId,
      campaign.id,
      budget,
      `AdSet ${Date.now()}`
    );

    const pageId = process.env.META_PAGE_ID || 'me';
    for (const ad of ads) {
      await createAd(
        token,
        adAccountId,
        adSet.id,
        ad.copy_text,
        ad.image_url || '',
        pageId
      );
    }

    const { data: metaCampaign, error } = await supabase
      .from('meta_campaigns')
      .insert({
        user_id: user.id,
        meta_campaign_id: campaign.id,
        ad_set_id: adSet.id,
        budget,
        objective,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      campaign: metaCampaign,
      message: 'Campaign created as draft. Confirm to launch.',
    });
  } catch (err) {
    console.error('[Campaign Launch]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Launch failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: campaigns } = await supabase
    .from('meta_campaigns')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ campaigns: campaigns || [] });
}
