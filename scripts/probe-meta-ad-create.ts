/**
 * Live Meta Marketing API probe for the connected AdForge ad account.
 * Does NOT print tokens. Creates PAUSED objects and deletes the campaign after.
 *
 * Usage:
 *   npx tsx scripts/probe-meta-ad-create.ts
 *   npx tsx scripts/probe-meta-ad-create.ts 10213649183959119
 */
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import {
  createAd,
  createAdSet,
  createCampaign,
  deleteMetaCampaign,
  describeAdAccountBlocker,
  getAdAccountStatus,
  getAdAccounts,
  normalizeMetaAdAccountId,
  retrieveToken,
} from '../src/lib/meta';

const META_API_VERSION = 'v21.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

async function main() {
  const preferAccount = String(process.argv[2] || '10213649183959119').replace(/^act_/, '');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase env');
  }
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('Missing ENCRYPTION_KEY');
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: rows, error } = await sb
    .from('ad_accounts')
    .select(
      'user_id, meta_ad_account_id, access_token_encrypted, page_id, page_name, pixel_id, pixel_name'
    )
    .not('access_token_encrypted', 'is', null)
    .order('connected_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  if (!rows?.length) throw new Error('No connected ad_accounts in Supabase');

  const match =
    rows.find((r) =>
      String(r.meta_ad_account_id || '')
        .replace(/^act_/, '')
        .includes(preferAccount)
    ) || rows[0];

  const token = retrieveToken(match.access_token_encrypted);
  console.log('[probe] Using AdForge connection user_id=', match.user_id);
  console.log('[probe] Stored meta_ad_account_id=', match.meta_ad_account_id);
  console.log('[probe] Stored page=', match.page_name, match.page_id);
  console.log('[probe] Preferred probe account=', preferAccount);

  const accounts = await getAdAccounts(token);
  console.log(
    '[probe] Visible ad accounts:',
    accounts.map((a) => ({
      id: String(a.id).replace(/^act_/, ''),
      name: a.name,
      status: a.account_status,
      blocker: describeAdAccountBlocker(a.account_status),
      tz: a.timezone_name,
    }))
  );

  const target =
    accounts.find((a) => String(a.id).replace(/^act_/, '') === preferAccount) ||
    accounts.find(
      (a) =>
        String(a.id).replace(/^act_/, '') ===
        String(match.meta_ad_account_id || '').replace(/^act_/, '')
    );

  if (!target?.id) {
    throw new Error(`Target ad account ${preferAccount} not visible to this token`);
  }

  const actId = normalizeMetaAdAccountId(target.id);
  const status = await getAdAccountStatus(token, actId);
  console.log('[probe] Target account status:', status);
  console.log('[probe] Blocker:', describeAdAccountBlocker(status.account_status));

  // Funding / capability probe (best-effort)
  const fundRes = await fetch(
    `${META_BASE}/${actId}?fields=id,name,account_status,disable_reason,funding_source_details,business,currency,timezone_name&access_token=${encodeURIComponent(token)}`
  );
  const fundJson = await fundRes.json();
  console.log(
    '[probe] Account details:',
    JSON.stringify(
      {
        id: fundJson.id,
        name: fundJson.name,
        account_status: fundJson.account_status,
        disable_reason: fundJson.disable_reason,
        currency: fundJson.currency,
        timezone_name: fundJson.timezone_name,
        funding: fundJson.funding_source_details,
        business: fundJson.business,
        error: fundJson.error,
      },
      null,
      2
    )
  );

  const pageId = String(match.page_id || process.env.META_PAGE_ID || '').trim();
  if (!pageId) throw new Error('No page_id on connection — set Page in AdForge first');

  const imageUrl =
    process.env.PROBE_IMAGE_URL ||
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png';

  console.log('[probe] Creating PAUSED campaign → ad set → ad (will delete campaign after)…');
  let campaignId: string | null = null;
  try {
    const campaign = await createCampaign(
      token,
      actId,
      `AdForge Probe ${new Date().toISOString().slice(0, 19)}`,
      'OUTCOME_TRAFFIC'
    );
    campaignId = campaign.id;
    console.log('[probe] Campaign OK', campaignId);

    const adSet = await createAdSet(
      token,
      actId,
      campaignId!,
      100,
      `AdForge Probe Ad set`,
      {
        countries: ['IN'],
        age_min: 18,
        age_max: 65,
      },
      {
        budgetType: 'daily',
        objective: 'OUTCOME_TRAFFIC',
        accessToken: token,
      }
    );
    console.log('[probe] Ad set OK', adSet.id);

    const ad = await createAd(
      token,
      actId,
      adSet.id,
      'Probe primary text — AdForge end-to-end test',
      imageUrl,
      pageId,
      'https://divyaprabhafoods.com',
      'Probe headline',
      'SHOP_NOW'
    );
    console.log('[probe] Ad OK', ad);
    console.log('\nRESULT: PASS — Meta accepted campaign/ad set/ad create on this account.\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[probe] Create failed:', msg);
    console.log('\nRESULT: FAIL — Meta rejected create. This is a Meta account/API restriction, not AdForge payload only.');
    console.log('Next: In Ads Manager for this exact act ID, click Review and publish if shown, check Account Quality / security prompts, ensure Page is usable on this ad account.\n');
    process.exitCode = 1;
  } finally {
    if (campaignId) {
      try {
        await deleteMetaCampaign(token, campaignId);
        console.log('[probe] Cleaned up probe campaign', campaignId);
      } catch (cleanupErr) {
        console.warn('[probe] Cleanup failed', cleanupErr);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
