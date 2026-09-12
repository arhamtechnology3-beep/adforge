/**
 * Inspect a Meta ad + Page Instagram linkage for IG preview issues.
 * Usage: npx tsx scripts/probe-ad-instagram-fields.ts [adId]
 */
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import { retrieveToken } from '../src/lib/meta';

const META_BASE = 'https://graph.facebook.com/v21.0';

async function g(pathAndQuery: string) {
  const r = await fetch(`${META_BASE}${pathAndQuery}`);
  const j = await r.json();
  if (j?.error) {
    return {
      error: {
        message: j.error.message,
        type: j.error.type,
        code: j.error.code,
        error_subcode: j.error.error_subcode,
      },
    };
  }
  return j;
}

function redact(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (k, v) =>
      k === 'access_token' || String(k).includes('token') ? '[redacted]' : v
    )
  );
}

async function main() {
  const adId = process.argv[2] || '120246251987480139';
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: accounts } = await sb
    .from('ad_accounts')
    .select('*')
    .not('access_token_encrypted', 'is', null)
    .order('connected_at', { ascending: false })
    .limit(1);
  if (!accounts?.[0]) throw new Error('No Meta connection');
  const account = accounts[0];
  const token = retrieveToken(account.access_token_encrypted);
  const pageId = account.page_id || '119876281205616';

  const fields = [
    'id,name,status,effective_status,configured_status',
    'creative{id,name,object_story_spec,asset_feed_spec,image_url,thumbnail_url,instagram_permalink_url,effective_instagram_media_id,effective_object_story_id,actor_id,instagram_actor_id,instagram_user_id,product_set_id,object_type,call_to_action_type,status}',
    'adset{id,name,status,targeting,promoted_object,optimization_goal,billing_event,daily_budget,lifetime_budget,destination_type,instagram_user_id,instagram_actor_id}',
    'campaign{id,name,objective,status}',
  ].join(',');

  const ad = await g(`/${adId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`);
  console.log('=== AD ===');
  console.log(JSON.stringify(redact(ad), null, 2));

  const oss = ad?.creative?.object_story_spec || {};
  console.log('\n=== CREATIVE CHECKLIST ===');
  console.log(
    JSON.stringify(
      {
        page_id: oss.page_id || null,
        has_instagram_actor_id: Boolean(oss.instagram_actor_id),
        instagram_actor_id: oss.instagram_actor_id || null,
        has_instagram_user_id: Boolean(oss.instagram_user_id),
        instagram_user_id: oss.instagram_user_id || null,
        creative_instagram_actor_id: ad?.creative?.instagram_actor_id || null,
        creative_instagram_user_id: ad?.creative?.instagram_user_id || null,
        effective_instagram_media_id: ad?.creative?.effective_instagram_media_id || null,
        carousel_cards: Array.isArray(oss.link_data?.child_attachments)
          ? oss.link_data.child_attachments.length
          : 0,
        has_picture_or_hash: Boolean(
          oss.link_data?.picture ||
            oss.link_data?.image_hash ||
            oss.link_data?.child_attachments?.[0]?.image_hash ||
            oss.link_data?.child_attachments?.[0]?.picture
        ),
        cta: oss.link_data?.call_to_action?.type || ad?.creative?.call_to_action_type || null,
        link: oss.link_data?.link || null,
        headline: oss.link_data?.name || null,
        message_len: String(oss.link_data?.message || '').length,
        adset_instagram_user_id: ad?.adset?.instagram_user_id || null,
        adset_instagram_actor_id: ad?.adset?.instagram_actor_id || null,
        publisher_platforms: ad?.adset?.targeting?.publisher_platforms || null,
        instagram_positions: ad?.adset?.targeting?.instagram_positions || null,
        facebook_positions: ad?.adset?.targeting?.facebook_positions || null,
        destination_type: ad?.adset?.destination_type || null,
        optimization_goal: ad?.adset?.optimization_goal || null,
        campaign_objective: ad?.campaign?.objective || null,
      },
      null,
      2
    )
  );

  const pages = await g(
    `/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=50&access_token=${encodeURIComponent(token)}`
  );
  const match =
    (pages.data || []).find((p: { id: string }) => p.id === pageId) ||
    (pages.data || [])[0];
  console.log('\n=== PAGE MATCH ===');
  console.log(
    JSON.stringify(
      {
        pageId,
        matchId: match?.id,
        matchName: match?.name,
        ig: match?.instagram_business_account || null,
      },
      null,
      2
    )
  );

  if (match?.access_token) {
    const pageTok = match.access_token as string;
    const igFields = await g(
      `/${pageId}?fields=id,name,instagram_business_account{id,username,name},page_backed_instagram_accounts{id,username},connected_instagram_account&access_token=${encodeURIComponent(pageTok)}`
    );
    console.log('\n=== PAGE TOKEN IG FIELDS ===');
    console.log(JSON.stringify(redact(igFields), null, 2));

    const act = String(account.meta_ad_account_id).replace(/^act_/, '');
    const igActors = await g(
      `/act_${act}/instagram_accounts?fields=id,username&access_token=${encodeURIComponent(token)}`
    );
    console.log('\n=== AD ACCOUNT instagram_accounts ===');
    console.log(JSON.stringify(redact(igActors), null, 2));

    const igActors2 = await g(
      `/act_${act}/assigned_instagram_accounts?fields=id,username&access_token=${encodeURIComponent(token)}`
    );
    console.log('\n=== AD ACCOUNT assigned_instagram_accounts ===');
    console.log(JSON.stringify(redact(igActors2), null, 2));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
