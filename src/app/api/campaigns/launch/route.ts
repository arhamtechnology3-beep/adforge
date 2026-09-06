import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createCampaign,
  createAdSet,
  ensureFacebookPageId,
  publishAdsToMeta,
} from '@/lib/meta';
import { genderToMetaGenders, isHttpsWebsiteUrl, normalizeWebsiteCta } from '@/lib/meta-campaign';
import { getSessionUser } from '@/lib/auth/session';
import { checkTrialAccess } from '@/lib/trial-gate';
import {
  metaConnectionIsLive,
  metaAccessToken,
  resolveMetaConnection,
} from '@/lib/auth/demo-meta';
import { readDemoAds } from '@/lib/auth/demo-ads';
import { buildDemoCampaign, readDemoCampaigns, upsertDemoCampaign } from '@/lib/auth/demo-campaigns';

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_SALES: 'Conversions',
  OUTCOME_AWARENESS: 'Brand Awareness',
  OUTCOME_ENGAGEMENT: 'Engagement',
};

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const trial = await checkTrialAccess(user);
  if (!trial.allowed) {
    return NextResponse.json({ error: trial.message, trial_expired: true }, { status: 402 });
  }

  const supabase = await createClient();
  const body = await request.json();
  const {
    ad_ids,
    budget,
    objective,
    website_url,
    name,
    cta,
    audience = { countries: ['IN'], age_min: 18, age_max: 65 },
    budget_type = 'daily',
  } = body;

  if (!ad_ids?.length || !budget || !objective) {
    return NextResponse.json(
      { error: 'Select at least one approved ad, set budget and objective' },
      { status: 400 }
    );
  }

  if (Number(budget) < 100) {
    return NextResponse.json({ error: 'Minimum daily budget is ₹100' }, { status: 400 });
  }

  let ads: Array<{
    id: string;
    copy_text?: string | null;
    headline?: string | null;
    image_url?: string | null;
    ad_format?: string | null;
    status?: string;
    media_payload?: { cards?: Array<{ image_url: string; headline?: string; description?: string; link?: string }> };
    campaigns_input?: { website_url?: string | null; user_id?: string };
  }> = [];

  if (user.isDemo) {
    const demoAds = await readDemoAds();
    ads = demoAds.filter((ad) => ad_ids.includes(ad.id) && ad.status === 'approved');
  } else {
    const { data } = await supabase
      .from('generated_ads')
      .select('*, campaigns_input!inner(website_url, user_id)')
      .in('id', ad_ids)
      .eq('status', 'approved');
    ads = data || [];
  }

  if (!ads?.length) {
    return NextResponse.json({ error: 'No approved ads found' }, { status: 400 });
  }

  const destination =
    website_url ||
    ads[0]?.campaigns_input?.website_url ||
    process.env.DEFAULT_AD_LINK ||
    null;

  const formatMix = ads.reduce<Record<string, number>>((acc, ad) => {
    const f = ad.ad_format || 'single_image';
    acc[f] = (acc[f] || 0) + 1;
    return acc;
  }, {});

  const campaignName =
    name?.trim() ||
    `${OBJECTIVE_LABELS[objective] || 'Campaign'} · ${new Date().toLocaleDateString('en-IN')}`;

  const metaConnection = await resolveMetaConnection(user);
  const metaReady = metaConnectionIsLive(metaConnection);

  if (metaReady && !isHttpsWebsiteUrl(destination)) {
    return NextResponse.json(
      {
        error:
          'Enter your Shopify/store https:// website URL. AdForge only publishes website traffic ads (not WhatsApp).',
      },
      { status: 422 }
    );
  }

  let metaCampaignId: string | null = null;
  let metaAdSetId: string | null = null;
  let metaSyncError: string | null = null;
  const metaAdIds: string[] = [];

  if (metaReady && metaConnection) {
    try {
      const token = metaAccessToken(metaConnection);
      const adAccountId = metaConnection.meta_ad_account_id!;

      const campaign = await createCampaign(token, adAccountId, campaignName, objective);
      metaCampaignId = campaign.id;

      const genders = genderToMetaGenders(audience?.gender);

      const adSet = await createAdSet(
        token,
        adAccountId,
        campaign.id,
        Number(budget),
        `${campaignName} · Ad set`,
        {
          countries: audience?.countries || ['IN'],
          age_min: Number(audience?.age_min) || 18,
          age_max: Number(audience?.age_max) || 65,
          genders,
          locations: audience?.locations,
          interests: audience?.interests,
          placements: audience?.placements,
          start_date: audience?.start_date,
          end_date: audience?.end_date,
        },
        {
          budgetType: budget_type,
          objective,
          accessToken: token,
          pixelId: metaConnection.pixel_id || process.env.META_PIXEL_ID || null,
        }
      );
      metaAdSetId = adSet.id;

      const pageResolved = await ensureFacebookPageId({
        accessToken: token,
        storedPageId: metaConnection.page_id,
      });
      const pageId = pageResolved.pageId;
      if (pageResolved.source === 'live' && !user.isDemo) {
        await supabase
          .from('ad_accounts')
          .update({
            page_id: pageResolved.pageId,
            page_name: pageResolved.pageName || null,
          })
          .eq('user_id', user.id);
      }
      const link = String(destination);
      const ctaType = normalizeWebsiteCta(String(cta || audience?.cta || 'SHOP_NOW'));
      const linkDescription = audience?.link_description || undefined;

      const published = await publishAdsToMeta({
        accessToken: token,
        adAccountId,
        adSetId: adSet.id,
        pageId,
        link,
        ctaType,
        linkDescription,
        ads,
      });
      metaAdIds.push(...published.metaAdIds);
      if (!published.metaAdIds.length) {
        throw new Error(
          published.errors[0] ||
            'Campaign and ad set were created on Meta, but no ads were created. Check Page access and creative images, then Confirm again.'
        );
      }
      if (published.errors.length) {
        console.warn('[Campaign Launch Meta] partial ad errors', published.errors);
        metaSyncError = `Some ads failed: ${published.errors.slice(0, 2).join(' | ')}`;
      }
    } catch (err) {
      console.error('[Campaign Launch Meta]', err);
      metaSyncError = err instanceof Error ? err.message : 'Meta API sync failed';
    }
  }

  const adsSynced = metaAdIds.length > 0;
  const launchConfig = {
    audience,
    budget_type,
    cta: normalizeWebsiteCta(cta || audience?.cta || 'SHOP_NOW'),
    website_url: destination,
    format_mix: formatMix,
    meta_synced: !!metaCampaignId && adsSynced && !metaSyncError,
    meta_sync_error: metaSyncError,
    meta_ad_ids: metaAdIds,
    ad_count: ads.length,
  };

  // Demo session: ads use non-UUID ids (demo-ad-…) and user_id is not in auth.users.
  // Persist locally — never insert into Postgres UUID columns.
  if (user.isDemo) {
    const metaCampaign = await upsertDemoCampaign(
      buildDemoCampaign({
        userId: user.id,
        name: campaignName,
        website_url: destination,
        budget: Number(budget),
        objective,
        status: 'draft',
        ad_ids,
        meta_campaign_id: metaCampaignId,
        ad_set_id: metaAdSetId,
        launch_config: launchConfig,
      })
    );

    return NextResponse.json({
      campaign: metaCampaign,
      meta_connected: metaReady,
      meta_synced: !!metaCampaignId && adsSynced && !metaSyncError,
      meta_sync_error: metaSyncError,
      message: metaCampaignId && adsSynced
        ? metaSyncError
          ? `Draft on Meta with ${metaAdIds.length} ad(s). Warning: ${metaSyncError.slice(0, 160)}`
          : 'Draft created on Meta (PAUSED). Confirm to go live.'
        : metaReady
          ? `Local draft saved. Meta sync failed${metaSyncError ? `: ${metaSyncError.slice(0, 180)}` : ''} — try Confirm later or Create again.`
          : 'Local draft saved. Connect Meta, then Confirm & Launch to go live.',
    });
  }

  const insertRow: Record<string, unknown> = {
    user_id: user.id,
    meta_campaign_id: metaCampaignId,
    ad_set_id: metaAdSetId,
    budget: Number(budget),
    objective,
    status: 'draft',
    name: campaignName,
    website_url: destination,
    ad_ids,
    launch_config: launchConfig,
  };

  let { data: metaCampaign, error } = await supabase
    .from('meta_campaigns')
    .insert(insertRow)
    .select()
    .single();

  // Fallback if migration 005 not applied
  if (error && /name|website_url|ad_ids|launch_config/i.test(error.message)) {
    const legacy = {
      user_id: user.id,
      meta_campaign_id: metaCampaignId,
      ad_set_id: metaAdSetId,
      budget: Number(budget),
      objective,
      status: 'draft' as const,
    };
    const retry = await supabase.from('meta_campaigns').insert(legacy).select().single();
    metaCampaign = retry.data
      ? {
          ...retry.data,
          name: campaignName,
          website_url: destination,
          ad_ids,
          launch_config: launchConfig,
        }
      : null;
    error = retry.error;
  }

  if (error || !metaCampaign) {
    return NextResponse.json(
      { error: error?.message || 'Failed to save campaign draft' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    campaign: metaCampaign,
    meta_connected: metaReady,
    meta_synced: !!metaCampaignId && adsSynced && !metaSyncError,
    meta_sync_error: metaSyncError,
    message: metaCampaignId && adsSynced
      ? metaSyncError
        ? `Draft on Meta with ${metaAdIds.length} ad(s). Warning: ${metaSyncError.slice(0, 160)}`
        : 'Draft created on Meta (PAUSED). Confirm to go live.'
      : metaReady
        ? `Local draft saved. Meta sync failed${metaSyncError ? `: ${metaSyncError.slice(0, 180)}` : ''} — Confirm will retry creating ads.`
        : 'Local draft saved. Connect Meta, then Confirm & Launch to go live.',
  });
}

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const metaConnection = await resolveMetaConnection(user);
  const metaConnected = metaConnectionIsLive(metaConnection);

  if (user.isDemo) {
    const campaigns = await readDemoCampaigns(user.id);
    return NextResponse.json({
      campaigns,
      meta_connected: metaConnected,
      meta_account_id: metaConnection?.meta_ad_account_id || null,
      meta_account_name: metaConnection?.meta_ad_account_name || null,
    });
  }

  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from('meta_campaigns')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    campaigns: campaigns || [],
    meta_connected: metaConnected,
    meta_account_id: metaConnection?.meta_ad_account_id || null,
  });
}
