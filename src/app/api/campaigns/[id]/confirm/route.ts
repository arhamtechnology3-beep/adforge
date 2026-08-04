import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  retrieveToken,
  activateCampaign,
  isTokenExpired,
  createCampaign,
  createAdSet,
  createAd,
} from '@/lib/meta';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: campaign } = await supabase
    .from('meta_campaigns')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  if (campaign.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft campaigns can be confirmed' },
      { status: 400 }
    );
  }

  const { data: adAccount } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const metaReady =
    !!adAccount?.access_token_encrypted &&
    !!adAccount?.meta_ad_account_id &&
    !isTokenExpired(adAccount.token_expires_at);

  // Demo / local path: no Meta connected — activate locally with clear flag
  if (!metaReady) {
    const launchConfig = {
      ...(campaign.launch_config || {}),
      activated_locally: true,
      activated_at: new Date().toISOString(),
      note: 'Marked active in-app. Connect Meta to publish to Facebook/Instagram.',
    };

    const { data: updated, error } = await supabase
      .from('meta_campaigns')
      .update({ status: 'active', launch_config: launchConfig })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      // Column may not exist
      const retry = await supabase
        .from('meta_campaigns')
        .update({ status: 'active' })
        .eq('id', params.id)
        .select()
        .single();
      return NextResponse.json({
        campaign: retry.data,
        meta_live: false,
        message:
          'Campaign marked active in-app. Connect Meta Ad Account to publish live on Facebook & Instagram.',
      });
    }

    return NextResponse.json({
      campaign: updated,
      meta_live: false,
      message:
        'Campaign marked active in-app. Connect Meta Ad Account to publish live on Facebook & Instagram.',
    });
  }

  try {
    const token = retrieveToken(adAccount!.access_token_encrypted!);
    let metaCampaignId = campaign.meta_campaign_id;

    // If draft was local-only, push to Meta now before activating
    if (!metaCampaignId) {
      const name = campaign.name || `Campaign ${Date.now()}`;
      const created = await createCampaign(
        token,
        adAccount!.meta_ad_account_id!,
        name,
        campaign.objective || 'OUTCOME_TRAFFIC'
      );
      metaCampaignId = created.id;

      const adSet = await createAdSet(
        token,
        adAccount!.meta_ad_account_id!,
        created.id,
        Number(campaign.budget || 500),
        `${name} · Ad set`
      );

      const adIds: string[] = campaign.ad_ids || [];
      if (adIds.length) {
        const { data: ads } = await supabase
          .from('generated_ads')
          .select('*')
          .in('id', adIds)
          .eq('status', 'approved');

        const pageId = process.env.META_PAGE_ID || 'me';
        const link = campaign.website_url || process.env.DEFAULT_AD_LINK || 'https://example.com';

        for (const ad of ads || []) {
          await createAd(
            token,
            adAccount!.meta_ad_account_id!,
            adSet.id,
            ad.copy_text,
            ad.image_url || '',
            pageId,
            link,
            ad.headline || undefined
          );
        }
      }

      await supabase
        .from('meta_campaigns')
        .update({
          meta_campaign_id: metaCampaignId,
          ad_set_id: adSet.id,
        })
        .eq('id', params.id);
    }

    await activateCampaign(token, metaCampaignId!);

    const { data: updated } = await supabase
      .from('meta_campaigns')
      .update({
        status: 'active',
        launch_config: {
          ...(campaign.launch_config || {}),
          meta_live: true,
          activated_at: new Date().toISOString(),
        },
      })
      .eq('id', params.id)
      .select()
      .single();

    return NextResponse.json({
      campaign: updated,
      meta_live: true,
      message: 'Campaign is now live on Meta!',
    });
  } catch (err) {
    console.error('[Campaign Confirm]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Activation failed' },
      { status: 500 }
    );
  }
}
