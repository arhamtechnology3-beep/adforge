/**
 * Launch Divyaprabha Sales/Purchase campaign from approved creatives,
 * then pause the Traffic campaign once Sales is ACTIVE on Meta.
 *
 * Dry-run (default): npx tsx scripts/launch-divyaprabha-sales.ts
 * Live:              CONFIRM_LIVE=1 npx tsx scripts/launch-divyaprabha-sales.ts
 */
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import {
  assertAdAccountCanCreateAds,
  createCampaign,
  createAdSet,
  ensureFacebookPageId,
  normalizeMetaAdAccountId,
  publishAdsToMeta,
  pauseCampaign,
  retrieveToken,
} from '../src/lib/meta';

const LIVE = process.env.CONFIRM_LIVE === '1';
const BRAND_HINT = /divyaprabha|ganpati/i;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const sb = createClient(url, key);

  const { data: accounts, error: accErr } = await sb
    .from('ad_accounts')
    .select('*')
    .not('access_token_encrypted', 'is', null)
    .order('connected_at', { ascending: false });
  if (accErr || !accounts?.length) {
    console.error('No ad accounts', accErr?.message);
    process.exit(1);
  }

  let account = accounts.find((a) => a.pixel_id) || accounts[0];
  const userId = account.user_id as string;

  const { data: camps } = await sb
    .from('meta_campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const traffic = (camps || []).find(
    (c) =>
      BRAND_HINT.test(String(c.name || '')) &&
      String(c.objective || '').includes('TRAFFIC') &&
      c.status !== 'archived'
  );
  const existingSales = (camps || []).find(
    (c) =>
      String(c.objective || '').includes('SALES') &&
      c.status !== 'archived' &&
      c.meta_campaign_id
  );

  const { data: ads } = await sb
    .from('generated_ads')
    .select('*, campaigns_input!inner(website_url, user_id)')
    .eq('campaigns_input.user_id', userId)
    .eq('status', 'approved')
    .limit(20);

  const usable = (ads || []).filter(
    (ad) =>
      ad.media_payload?.quality_valid !== false &&
      (!!ad.media_payload?.video_url ||
        (!!ad.image_url && !String(ad.image_url).includes('/api/ads/creative')))
  );

  console.log(
    JSON.stringify(
      {
        mode: LIVE ? 'LIVE' : 'DRY_RUN',
        userId,
        pixel_id: account.pixel_id,
        page_id: account.page_id,
        traffic: traffic
          ? { id: traffic.id, name: traffic.name, meta: traffic.meta_campaign_id, status: traffic.status }
          : null,
        existingSales: existingSales
          ? { id: existingSales.id, name: existingSales.name, meta: existingSales.meta_campaign_id }
          : null,
        approvedUsableAds: usable.length,
      },
      null,
      2
    )
  );

  if (!account.pixel_id && !process.env.META_PIXEL_ID) {
    console.error('BLOCKED: no Pixel on ad account — cannot launch Sales/Purchase');
    process.exit(1);
  }
  if (!usable.length) {
    console.error('BLOCKED: no approved usable creatives');
    process.exit(1);
  }

  if (existingSales?.meta_campaign_id) {
    console.log('Sales campaign already exists — skipping create.');
    if (LIVE && traffic?.meta_campaign_id && traffic.status === 'active') {
      const token = retrieveToken(account.access_token_encrypted);
      await pauseCampaign(token, traffic.meta_campaign_id);
      await sb.from('meta_campaigns').update({ status: 'paused' }).eq('id', traffic.id);
      console.log('Paused Traffic campaign', traffic.name);
    }
    return;
  }

  if (!LIVE) {
    console.log('Dry-run only. Re-run with CONFIRM_LIVE=1 to create Sales on Meta and pause Traffic.');
    return;
  }

  const token = retrieveToken(account.access_token_encrypted);
  const adAccountId = normalizeMetaAdAccountId(account.meta_ad_account_id);
  await assertAdAccountCanCreateAds(token, adAccountId);

  const campaignName = `Sales · Divyaprabha · ${new Date().toLocaleDateString('en-IN')}`;
  const destination =
    usable[0]?.campaigns_input?.website_url ||
    process.env.DEFAULT_AD_LINK ||
    'https://divyaprabhafoods.com';

  const campaign = await createCampaign(token, adAccountId, campaignName, 'OUTCOME_SALES');
  const adSet = await createAdSet(
    token,
    adAccountId,
    campaign.id,
    Number(traffic?.budget || 500),
    `${campaignName} · Prospecting`,
    {
      countries: ['IN'],
      age_min: 21,
      age_max: 55,
      locations: ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Pune'],
      interests: ['Online shopping', 'Gifting', 'Indian cuisine'],
    },
    {
      budgetType: 'daily',
      objective: 'OUTCOME_SALES',
      accessToken: token,
      pixelId: account.pixel_id || process.env.META_PIXEL_ID,
    }
  );

  const pageResolved = await ensureFacebookPageId({
    accessToken: token,
    storedPageId: account.page_id,
  });

  const published = await publishAdsToMeta({
    accessToken: token,
    adAccountId,
    adSetId: adSet.id,
    pageId: pageResolved.pageId,
    pageAccessToken: pageResolved.pageAccessToken,
    link: String(destination),
    ctaType: 'SHOP_NOW',
    ads: usable.slice(0, 5),
  });

  const { data: row, error: insErr } = await sb
    .from('meta_campaigns')
    .insert({
      user_id: userId,
      name: campaignName,
      objective: 'OUTCOME_SALES',
      budget: Number(traffic?.budget || 500),
      status: 'draft',
      meta_campaign_id: campaign.id,
      ad_set_id: adSet.id,
      website_url: destination,
      ad_ids: usable.slice(0, 5).map((a) => a.id),
      launch_config: {
        meta_ad_ids: published.metaAdIds,
        meta_synced: published.metaAdIds.length > 0,
        website_url: destination,
        cta: 'SHOP_NOW',
        playbook: 'subscriber-sales',
      },
    })
    .select('*')
    .maybeSingle();

  if (insErr) {
    console.error('DB insert failed', insErr.message);
  }

  console.log('Created Sales draft on Meta (PAUSED):', {
    meta_campaign_id: campaign.id,
    ad_set_id: adSet.id,
    ads: published.metaAdIds,
    db_id: row?.id,
    errors: published.errors,
  });
  console.log(
    'Confirm & set ACTIVE in AdForge / Ads Manager after Events Manager shows Purchase. Then re-run with CONFIRM_LIVE=1 to pause Traffic if still active.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
