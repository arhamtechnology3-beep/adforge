/**
 * Upload the 1:1 Diwali creatives and create a draft campaign.
 * Each product ad stores its own Shop Now URL.
 *
 *   npx tsx scripts/seed-diwali-1x1-campaign.ts
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

const CAMPAIGN_NAME = 'Diwali 1:1 · Product Pages';
const STORE_HOME = 'https://divyaprabhafoods.com';
const ASSETS = path.join(
  process.env.HOME || '',
  '.cursor/projects/Users-apple-Documents-Facebook-Meta-Ads/assets'
);

const CREATIVES = [
  {
    file: 'Diwali_Gor_Keri_Pickle_Celebration-54256999-6573-46ad-a67f-b6ece4bb553b.jpg',
    headline: 'Gor Keri Ki Mithaas',
    product: 'Gor Keri | Jaggery Mango Achar',
    url: 'https://divyaprabhafoods.com/products/gor-keri-pickle-jaggery-mango-achar-gujarati',
    copy: 'Gor Keri ki mithaas, Diwali ka khaas ehsaas! Jaggery mango pickle from Divyaprabha Foods — sweet, tangy, and ready for the festive thali. ₹699. Shop now.',
  },
  {
    file: 'Diwali_Mango_Pickle_Celebration-18382e49-540a-4bf9-91b9-da5587ee1bfd.jpg',
    headline: 'Diwali Ka Swad',
    product: 'Homemade Mango Pickle | Aam ka Achar',
    url: 'https://divyaprabhafoods.com/products/mango-pickle-traditional-keri-achar-gujarati',
    copy: 'Diwali ka swad, Special Mango ke saath! Homemade mango pickle from Divyaprabha Foods — the taste of a Saurashtra thali. ₹699. Shop now.',
  },
  {
    file: 'Diwali_Ki_Thaali__Katka_Keri_Pickle-991e2d8c-125e-430c-9be1-220dd5e9a3f0.jpg',
    headline: 'Diwali Ki Thaali',
    product: 'Katka Keri Pickle | Homemade Gujarati Mango Achar',
    url: 'https://divyaprabhafoods.com/products/katka-keri-pickle-homemade-gujarati-mango-achar',
    copy: 'Diwali ki thaali, Katka Keri se bane nirali! Crunchy homemade mango pickle from Divyaprabha Foods. ₹699. Shop now.',
  },
  {
    file: 'Diwali_Ki_Khushiyaan__Chhundo_Mithaas-2c0d465e-222b-45c5-8a5d-5aa7ca52d5f2.jpg',
    headline: 'Diwali Ki Khushiyaan',
    product: 'Chhundo | Sweet Shredded Mango Achar',
    url: 'https://divyaprabhafoods.com/products/chhundo-pickle-sweet-shredded-mango-achar-gujarati',
    copy: 'Diwali ki khushiyaan, Special Chhundo ki mithaas! Sweet shredded mango achar from Divyaprabha Foods. ₹699. Shop now.',
  },
  {
    file: 'Diwali_Chana_Keri_Methi_Pickle_Feast__1_-cf8a4e32-6bbf-4e68-98c3-893bd0a915ff.jpg',
    headline: 'Diwali Ka Jashn',
    product: 'Methia Keri | Chana Keri Methi Achar',
    url: 'https://divyaprabhafoods.com/products/chana-keri-methi-pickle-gujarati-methia-achar',
    copy: 'Diwali ka jashn, Chana Keri Methi ke sang! Festive methia keri from Divyaprabha Foods. ₹699. Shop now.',
  },
  {
    file: 'Diwali_Sweet_Mango_Pickle_Celebration__1_-344b1a98-373a-4775-9791-0ae6cc26914a.jpg',
    headline: 'Diwali Ki Mithaas',
    product: 'Meethi Keri | Sweet Mango Achar',
    url: 'https://divyaprabhafoods.com/products/sweet-mango-pickle-meethi-keri-achar-homemade',
    copy: 'Diwali ki mithaas, Sweet Mango ke saath! Meethi keri from Divyaprabha Foods — mild, golden, and made for the festive table. ₹699. Shop now.',
  },
  {
    file: 'Diwali_Flavours__Gunda_Keri_Pickle-b2c6a323-7825-474c-b776-ce5102d6f09a.jpg',
    headline: 'Diwali Ke Rang',
    product: 'Gunda Keri | Lasode ka Achar',
    url: 'https://divyaprabhafoods.com/products/gunda-keri-pickle-lasode-ka-achar-gujarati',
    copy: 'Diwali ke rang, Gunda Keri ke sang! Lasode mango pickle from Divyaprabha Foods. ₹699. Shop now.',
  },
  {
    file: 'Diwali_Flavours_of_Tradition__1_-6c577543-059a-4897-889d-8c209690b887.jpg',
    headline: 'Taste of Tradition',
    product: 'All Divyaprabha pickles',
    url: 'https://divyaprabhafoods.com/collections/all',
    copy: 'This Diwali, bring home the taste of tradition. Shop the full Divyaprabha Foods range — Gor Keri, Special Mango, Katka Keri, Chhundo, Chana Keri Methi, Sweet Mango, and Gunda Keri. ₹699.',
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL or service role key');

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: stores, error: storeError } = await admin
    .from('stores')
    .select('id, user_id, name, website_url')
    .ilike('website_url', '%divyaprabha%');
  if (storeError) throw new Error(storeError.message);
  const store = stores?.[0];
  if (!store) throw new Error('No Divyaprabha store found');

  const { data: existing } = await admin
    .from('meta_campaigns')
    .select('id, name, status, ad_ids')
    .eq('user_id', store.user_id)
    .eq('name', CAMPAIGN_NAME)
    .limit(1);
  if (existing?.length) {
    console.log(
      JSON.stringify({
        skipped: true,
        campaign_id: existing[0].id,
        ads: existing[0].ad_ids?.length || 0,
      })
    );
    return;
  }

  const { data: inputs, error: inputError } = await admin
    .from('campaigns_input')
    .select('id, website_url, store_id')
    .eq('user_id', store.user_id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (inputError) throw new Error(inputError.message);

  let campaignInputId = inputs?.[0]?.id as string | undefined;
  if (!campaignInputId) {
    const created = await admin
      .from('campaigns_input')
      .insert({
        user_id: store.user_id,
        store_id: store.id,
        website_url: STORE_HOME,
      })
      .select('id')
      .single();
    if (created.error || !created.data) {
      throw new Error(created.error?.message || 'Could not create campaign input');
    }
    campaignInputId = created.data.id;
  }

  const { data: lastVariant } = await admin
    .from('generated_ads')
    .select('variant_number')
    .eq('campaign_input_id', campaignInputId)
    .order('variant_number', { ascending: false })
    .limit(1);
  let variant = Number(lastVariant?.[0]?.variant_number || 0);

  const adIds: string[] = [];
  for (const creative of CREATIVES) {
    const filePath = path.join(ASSETS, creative.file);
    const bytes = readFileSync(filePath);
    variant += 1;
    const objectPath = `${store.user_id}/diwali-1x1/${variant}-${creative.headline
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.jpg`;
    const uploaded = await admin.storage.from('creative-assets').upload(objectPath, bytes, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: true,
    });
    if (uploaded.error) throw new Error(`Upload ${creative.headline}: ${uploaded.error.message}`);
    const imageUrl = admin.storage.from('creative-assets').getPublicUrl(objectPath).data.publicUrl;

    const inserted = await admin
      .from('generated_ads')
      .insert({
        campaign_input_id: campaignInputId,
        variant_number: variant,
        copy_text: creative.copy,
        image_url: imageUrl,
        status: 'approved',
        ad_format: 'single_image',
        headline: creative.headline,
        angle: 'diwali-1x1',
        media_payload: {
          manual: true,
          aspect: '1:1',
          placement: 'feed',
          destination_url: creative.url,
          product_name: creative.product,
          product_images: [imageUrl],
          carousel_source: 'manual',
        },
      })
      .select('id')
      .single();
    if (inserted.error || !inserted.data) {
      throw new Error(inserted.error?.message || `Insert failed for ${creative.headline}`);
    }
    adIds.push(inserted.data.id);
    console.log(`ad ${creative.headline} → ${creative.url}`);
  }

  const { data: prior } = await admin
    .from('meta_campaigns')
    .select('budget, objective, launch_config')
    .eq('user_id', store.user_id)
    .ilike('name', '%diwali%')
    .order('created_at', { ascending: false })
    .limit(1);
  const priorConfig = (prior?.[0]?.launch_config || {}) as Record<string, unknown>;
  const audience =
    priorConfig.audience && typeof priorConfig.audience === 'object'
      ? priorConfig.audience
      : {
          countries: ['IN'],
          age_min: 18,
          age_max: 65,
          gender: 'all',
          cta: 'SHOP_NOW',
        };

  const campaign = await admin
    .from('meta_campaigns')
    .insert({
      user_id: store.user_id,
      store_id: store.id,
      name: CAMPAIGN_NAME,
      website_url: STORE_HOME,
      budget: Number(prior?.[0]?.budget || 500),
      objective: prior?.[0]?.objective || 'OUTCOME_SALES',
      status: 'draft',
      meta_campaign_id: null,
      ad_set_id: null,
      ad_ids: adIds,
      launch_config: {
        audience,
        budget_type: priorConfig.budget_type || 'daily',
        cta: 'SHOP_NOW',
        website_url: STORE_HOME,
        format_mix: { single_image: adIds.length },
        meta_synced: false,
        ad_count: adIds.length,
        note: '1:1 Diwali creatives. Each ad uses its own product URL.',
      },
    })
    .select('id, name, status')
    .single();
  if (campaign.error || !campaign.data) {
    throw new Error(campaign.error?.message || 'Campaign insert failed');
  }

  console.log(
    JSON.stringify({
      campaign_id: campaign.data.id,
      name: campaign.data.name,
      status: campaign.data.status,
      ads: adIds.length,
      store: store.name,
    })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
