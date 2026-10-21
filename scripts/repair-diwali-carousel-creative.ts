/**
 * Replace the live Diwali carousel creative with 1080×1080 cards and
 * turn off Stories/Reels, which cannot run a square carousel.
 *
 *   npx tsx scripts/repair-diwali-carousel-creative.ts
 */
import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { createAd, retrieveToken } from '../src/lib/meta';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

const CAMPAIGN_NAME = 'Diwali 1:1 · Product Pages';
const CAROUSEL_AD_ID = '772adbd7-be71-4485-a4ba-8f01f9c1f492';
const META_BASE = 'https://graph.facebook.com/v21.0';

async function graph(token: string, id: string, fields: string) {
  const res = await fetch(
    `${META_BASE}/${id}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`
  );
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json.error || json).slice(0, 500));
  return json;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const campaign = await admin
    .from('meta_campaigns')
    .select('store_id, launch_config, ad_set_id, meta_campaign_id, status')
    .eq('name', CAMPAIGN_NAME)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (campaign.error || !campaign.data) throw new Error(campaign.error?.message || 'active campaign missing');

  const account = await admin
    .from('ad_accounts')
    .select('meta_ad_account_id, access_token_encrypted, page_id')
    .eq('store_id', campaign.data.store_id)
    .maybeSingle();
  if (account.error || !account.data?.access_token_encrypted) {
    throw new Error(account.error?.message || 'Meta account missing');
  }
  const token = retrieveToken(account.data.access_token_encrypted);
  const adAccountId = account.data.meta_ad_account_id as string;
  const pageId = account.data.page_id as string;

  const metaAdIds: string[] = campaign.data.launch_config?.meta_ad_ids || [];
  if (!metaAdIds.length) throw new Error('No Meta ad ids on this campaign');

  const local = await admin
    .from('generated_ads')
    .select('headline, copy_text, image_url, media_payload')
    .eq('id', CAROUSEL_AD_ID)
    .single();
  if (local.error || !local.data) throw new Error(local.error?.message || 'carousel ad missing');

  const cards = (local.data.media_payload?.cards || [])
    .filter((card: { image_url?: string }) => card.image_url)
    .map((card: { image_url: string; headline?: string; link?: string; product_url?: string }) => ({
      image_url: card.image_url,
      headline: card.headline,
      link: card.link || card.product_url,
    }));

  const live = await graph(token, metaAdIds[0], 'id,name,adset_id,creative{object_story_spec}');
  const story = live.creative?.object_story_spec || {};
  const ctaType =
    story.link_data?.call_to_action?.type ||
    story.link_data?.child_attachments?.[0]?.call_to_action?.type ||
    'SHOP_NOW';
  const instagramUserId = story.instagram_user_id || null;

  const replaced = await createAd(
    token,
    adAccountId,
    live.adset_id,
    local.data.copy_text,
    local.data.image_url,
    pageId,
    cards[0]?.link,
    local.data.headline || 'Taste of Tradition',
    ctaType,
    undefined,
    cards,
    token,
    instagramUserId,
    { existingAdId: live.id }
  );

  const adset = await graph(token, live.adset_id, 'targeting');
  const targeting = { ...(adset.targeting || {}) };
  delete targeting.targeting_optimization;
  if (Array.isArray(targeting.facebook_positions)) {
    targeting.facebook_positions = targeting.facebook_positions.filter(
      (position: string) => position !== 'story'
    );
  }
  if (Array.isArray(targeting.instagram_positions)) {
    targeting.instagram_positions = targeting.instagram_positions.filter(
      (position: string) => position !== 'story' && position !== 'reels'
    );
  }
  targeting.targeting_automation = { advantage_audience: 0 };
  const placementBody = new URLSearchParams();
  placementBody.set('targeting', JSON.stringify(targeting));
  placementBody.set('access_token', token);
  const placementRes = await fetch(`${META_BASE}/${live.adset_id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: placementBody.toString(),
  });
  const placementJson = await placementRes.json();
  if (!placementRes.ok) {
    throw new Error(
      `Creative replaced (${replaced.creative_id}) but placements failed: ${JSON.stringify(placementJson.error || placementJson).slice(0, 400)}`
    );
  }

  console.log(
    JSON.stringify({
      ad_id: replaced.id,
      creative_id: replaced.creative_id,
      cards: cards.length,
      cta: ctaType,
      placements: 'facebook feed + instagram feed',
    })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
