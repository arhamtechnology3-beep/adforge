/**
 * Complete Meta ads for drafts that have campaign/ad set but no ads
 * (common after Hostinger auth-lock). Runs from this machine's network.
 *
 * Usage: npx tsx scripts/complete-meta-draft-ads.ts
 */
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import {
  ensureFacebookPageId,
  publishAdsToMeta,
  retrieveToken,
} from '../src/lib/meta';

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: accounts, error: accErr } = await sb
    .from('ad_accounts')
    .select('*')
    .not('access_token_encrypted', 'is', null)
    .order('connected_at', { ascending: false })
    .limit(5);
  if (accErr) throw new Error(accErr.message);
  if (!accounts?.length) throw new Error('No Meta connection in DB');

  const account = accounts[0];
  const token = retrieveToken(account.access_token_encrypted);
  const userId = account.user_id;
  const adAccountId = account.meta_ad_account_id;
  console.log('[complete] user=', userId, 'ad_account=', adAccountId);

  const { data: campaigns, error: cErr } = await sb
    .from('meta_campaigns')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .not('meta_campaign_id', 'is', null)
    .not('ad_set_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
  if (cErr) throw new Error(cErr.message);

  const pending = (campaigns || []).filter((c) => {
    const cfg = (c.launch_config || {}) as { meta_ad_ids?: string[] };
    return !Array.isArray(cfg.meta_ad_ids) || cfg.meta_ad_ids.length === 0;
  });

  console.log('[complete] draft campaigns needing ads:', pending.length);
  if (!pending.length) {
    console.log('[complete] Nothing to do.');
    return;
  }

  const pageResolved = await ensureFacebookPageId({
    accessToken: token,
    storedPageId: account.page_id,
  });
  console.log('[complete] page=', pageResolved.pageName, pageResolved.pageId);

  for (const campaign of pending) {
    const cfg = (campaign.launch_config || {}) as Record<string, unknown>;
    const adIds = (campaign.ad_ids || []) as string[];
    const website =
      String(campaign.website_url || cfg.website_url || '').trim() ||
      'https://divyaprabhafoods.com';
    const cta = String(cfg.cta || 'SHOP_NOW');

    console.log('\n[complete] campaign', campaign.name, campaign.id);
    console.log('  meta_campaign_id=', campaign.meta_campaign_id);
    console.log('  ad_set_id=', campaign.ad_set_id);
    console.log('  ad_ids=', adIds.length);

    if (!adIds.length) {
      console.log('  skip: no linked generated ads');
      continue;
    }

    const { data: ads } = await sb
      .from('generated_ads')
      .select('copy_text,headline,image_url,media_payload,status')
      .in('id', adIds)
      .eq('status', 'approved');

    if (!ads?.length) {
      console.log('  skip: no approved creatives');
      continue;
    }

    const published = await publishAdsToMeta({
      accessToken: token,
      adAccountId,
      adSetId: campaign.ad_set_id,
      pageId: pageResolved.pageId,
      pageAccessToken: pageResolved.pageAccessToken,
      link: website,
      ctaType: cta,
      ads,
    });

    console.log('  created ads:', published.metaAdIds);
    if (published.errors.length) console.log('  errors:', published.errors);

    if (published.metaAdIds.length) {
      const nextCfg = {
        ...cfg,
        meta_synced: true,
        meta_sync_error: published.errors.length
          ? `Some ads failed: ${published.errors.slice(0, 2).join(' | ')}`
          : null,
        meta_ad_account_id: adAccountId,
        meta_ad_ids: published.metaAdIds,
        completed_via: 'local_complete_script',
        completed_at: new Date().toISOString(),
      };
      const { error: uErr } = await sb
        .from('meta_campaigns')
        .update({ launch_config: nextCfg })
        .eq('id', campaign.id);
      if (uErr) console.warn('  DB update failed', uErr.message);
      else console.log('  DB updated with meta_ad_ids');
    }
  }

  console.log('\n[complete] Done. In AdForge use Confirm & Launch to activate PAUSED ads.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
