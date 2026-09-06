import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  activateCampaignTree,
  createCampaign,
  createAdSet,
  ensureFacebookPageId,
  publishAdsToMeta,
} from '@/lib/meta';
import type { PlacementToggles } from '@/lib/meta-campaign';
import { genderToMetaGenders, isHttpsWebsiteUrl, normalizeWebsiteCta } from '@/lib/meta-campaign';
import { getSessionUser } from '@/lib/auth/session';
import {
  metaAccessToken,
  metaConnectionIsLive,
  resolveMetaConnection,
} from '@/lib/auth/demo-meta';
import { readDemoAds } from '@/lib/auth/demo-ads';
import { getDemoCampaign, upsertDemoCampaign } from '@/lib/auth/demo-campaigns';
import type { GeneratedAd, MetaCampaign } from '@/types/database';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let campaign: MetaCampaign | null = null;

  if (sessionUser.isDemo) {
    campaign = await getDemoCampaign(params.id, sessionUser.id);
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from('meta_campaigns')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', sessionUser.id)
      .single();
    campaign = data;
  }

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  if (campaign.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft campaigns can be confirmed' },
      { status: 400 }
    );
  }

  const metaConnection = await resolveMetaConnection(sessionUser);
  const metaReady = metaConnectionIsLive(metaConnection);

  // Local-only: no Meta connected — activate in-app
  if (!metaReady || !metaConnection) {
    const launchConfig = {
      ...(campaign.launch_config || {}),
      activated_locally: true,
      activated_at: new Date().toISOString(),
      note: 'Marked active in-app. Connect Meta to publish to Facebook/Instagram.',
    };
    const updated: MetaCampaign = { ...campaign, status: 'active', launch_config: launchConfig };

    if (sessionUser.isDemo) {
      await upsertDemoCampaign(updated, sessionUser.id);
    } else {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('meta_campaigns')
        .update({ status: 'active', launch_config: launchConfig })
        .eq('id', params.id)
        .select()
        .single();
      if (error) {
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
        campaign: data,
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
    const token = metaAccessToken(metaConnection);
    const adAccountId = metaConnection.meta_ad_account_id!;
    let metaCampaignId = campaign.meta_campaign_id;
    let metaAdSetId = campaign.ad_set_id;
    const launchConfig = (campaign.launch_config || {}) as Record<string, unknown>;
    const audience = (launchConfig.audience || {}) as Record<string, unknown>;
    const budgetType = (launchConfig.budget_type as 'daily' | 'lifetime') || 'daily';
    let metaAdIds = Array.isArray(launchConfig.meta_ad_ids)
      ? (launchConfig.meta_ad_ids as string[])
      : [];

    const name = campaign.name || `Campaign ${Date.now()}`;

    if (!metaCampaignId) {
      const created = await createCampaign(
        token,
        adAccountId,
        name,
        campaign.objective || 'OUTCOME_TRAFFIC'
      );
      metaCampaignId = created.id;
    }

    if (!metaAdSetId) {
      if (!metaCampaignId) {
        throw new Error('Meta campaign id missing after create');
      }
      const adSet = await createAdSet(
        token,
        adAccountId,
        metaCampaignId,
        Number(campaign.budget || 500),
        `${name} · Ad set`,
        {
          countries: (audience.countries as string[]) || ['IN'],
          age_min: Number(audience.age_min) || 18,
          age_max: Number(audience.age_max) || 65,
          genders: genderToMetaGenders(audience.gender as string),
          locations: audience.locations as string[] | undefined,
          interests: audience.interests as string[] | undefined,
          placements: audience.placements as PlacementToggles | undefined,
          start_date: audience.start_date as string | null,
          end_date: audience.end_date as string | null,
        },
        {
          budgetType,
          objective: campaign.objective || 'OUTCOME_TRAFFIC',
          accessToken: token,
          pixelId: metaConnection.pixel_id || process.env.META_PIXEL_ID || null,
        }
      );
      metaAdSetId = adSet.id;
    }

    // Always create ads when prior sync left an empty ad set
    if (!metaAdIds.length) {
      const adIds: string[] = campaign.ad_ids || [];
      let ads: GeneratedAd[] = [];
      if (adIds.length) {
        if (sessionUser.isDemo) {
          const demoAds = await readDemoAds();
          ads = demoAds.filter((ad) => adIds.includes(ad.id) && ad.status === 'approved');
        } else {
          const supabase = await createClient();
          const { data } = await supabase
            .from('generated_ads')
            .select('*')
            .in('id', adIds)
            .eq('status', 'approved');
          ads = (data || []) as GeneratedAd[];
        }
      }

      if (!ads.length) {
        return NextResponse.json(
          {
            error:
              'No approved creatives linked to this campaign. Go back to Ads step, select approved ads, and Create again.',
          },
          { status: 422 }
        );
      }

      const websiteLink =
        (typeof campaign.website_url === 'string' && campaign.website_url) ||
        (typeof launchConfig.website_url === 'string' && launchConfig.website_url) ||
        '';
      if (!isHttpsWebsiteUrl(websiteLink)) {
        return NextResponse.json(
          {
            error:
              'Set a valid https:// Shopify/store website URL on the campaign before Confirm. Ads must send traffic to your website.',
          },
          { status: 422 }
        );
      }

      const pageResolved = await ensureFacebookPageId({
        accessToken: token,
        storedPageId: metaConnection.page_id,
      });
      if (pageResolved.source === 'live' && !sessionUser.isDemo) {
        const supabasePages = await createClient();
        await supabasePages
          .from('ad_accounts')
          .update({
            page_id: pageResolved.pageId,
            page_name: pageResolved.pageName || null,
          })
          .eq('user_id', sessionUser.id);
      }

      const published = await publishAdsToMeta({
        accessToken: token,
        adAccountId,
        adSetId: metaAdSetId!,
        pageId: pageResolved.pageId,
        link: websiteLink,
        ctaType: normalizeWebsiteCta(String(launchConfig.cta || audience.cta || 'SHOP_NOW')),
        linkDescription: (audience.link_description as string) || undefined,
        ads,
      });
      metaAdIds = published.metaAdIds;
      if (!metaAdIds.length) {
        return NextResponse.json(
          {
            error:
              published.errors[0] ||
              'Meta campaign/ad set exist but ads could not be created. Reconnect Facebook, then Confirm again.',
            meta_ad_errors: published.errors,
          },
          { status: 502 }
        );
      }
    }

    await activateCampaignTree({
      accessToken: token,
      campaignId: metaCampaignId!,
      adSetId: metaAdSetId,
      adIds: metaAdIds,
    });

    const updatedLaunchConfig = {
      ...launchConfig,
      meta_live: true,
      meta_synced: true,
      meta_ad_ids: metaAdIds,
      activated_at: new Date().toISOString(),
    };

    const updated: MetaCampaign = {
      ...campaign,
      meta_campaign_id: metaCampaignId,
      ad_set_id: metaAdSetId,
      status: 'active',
      launch_config: updatedLaunchConfig,
    };

    if (sessionUser.isDemo) {
      await upsertDemoCampaign(updated, sessionUser.id);
    } else {
      const supabase = await createClient();
      const { data } = await supabase
        .from('meta_campaigns')
        .update({
          status: 'active',
          meta_campaign_id: metaCampaignId,
          ad_set_id: metaAdSetId,
          launch_config: updatedLaunchConfig,
        })
        .eq('id', params.id)
        .select()
        .single();
      return NextResponse.json({
        campaign: data || updated,
        meta_live: true,
        message: `Campaign is live on Meta with ${metaAdIds.length} ad(s) (Campaign → Ad set → Ad). Open Ads Manager to review; fix Billing if Delivery shows Payment error.`,
      });
    }

    return NextResponse.json({
      campaign: updated,
      meta_live: true,
      message: `Campaign is live on Meta with ${metaAdIds.length} ad(s) (Campaign → Ad set → Ad). Open Ads Manager to review; fix Billing if Delivery shows Payment error.`,
    });
  } catch (err) {
    console.error('[Campaign Confirm]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Activation failed' },
      { status: 500 }
    );
  }
}
