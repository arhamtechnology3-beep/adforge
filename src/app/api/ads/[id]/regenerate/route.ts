import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { readDemoAds, persistDemoAds } from '@/lib/auth/demo-ads';
import { readDemoProducts, type Product } from '@/lib/product-catalog';
import { buildReplicatedAds } from '@/lib/replicate-ads';
import {
  bakeCreativeAsset,
  normalizePackshot,
  persistCreativeFile,
} from '@/lib/creative-assets';
import { evaluateCreativeQuality, type ProductBrief } from '@/lib/creative-quality';
import { resolveAppOrigin } from '@/lib/app-url';
import { renderMotionTemplateVideo, type MotionVideoImage } from '@/lib/motion-video';
import type { GeneratedAd } from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 240;

function briefFromProduct(product: Product, origin: string): ProductBrief {
  const absolute = (url: string) => (url.startsWith('/') ? `${origin}${url}` : url);
  if (!product.primary_packshot) throw new Error('Product needs a primary packshot');
  return {
    id: product.id,
    brandName: product.brand_name,
    productName: product.product_name,
    category: product.category || 'Products',
    description: product.description || undefined,
    benefits: product.benefits,
    ingredients: product.ingredients,
    price: product.price || undefined,
    offer: product.offer || undefined,
    productUrl: product.product_url || undefined,
    approvedClaims: product.approved_claims,
    prohibitedClaims: product.prohibited_claims,
    primaryPackshot: absolute(product.primary_packshot),
    packshots: (product.packshots.length ? product.packshots : [product.primary_packshot]).map(
      absolute
    ),
  };
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const mode = ['copy', 'visual', 'all', 'duplicate'].includes(body.mode)
    ? body.mode
    : 'all';
  const productId = String(body.product_id || '');
  if (!productId) {
    return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
  }

  const supabase = await createClient();
  let existing: GeneratedAd | null = null;
  let product: Product | null = null;
  let demoAds: GeneratedAd[] = [];
  if (user.isDemo) {
    demoAds = await readDemoAds();
    existing = demoAds.find((ad) => ad.id === params.id) || null;
    product = (await readDemoProducts()).find((item) => item.id === productId) || null;
  } else {
    const [adResult, productResult] = await Promise.all([
      supabase.from('generated_ads').select('*').eq('id', params.id).maybeSingle(),
      supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);
    existing = (adResult.data as GeneratedAd | null) || null;
    product = (productResult.data as Product | null) || null;
  }
  if (!existing) return NextResponse.json({ error: 'Creative not found' }, { status: 404 });
  if (!product?.is_active || !product.is_approved) {
    return NextResponse.json({ error: 'Approved product not found' }, { status: 404 });
  }

  const origin = resolveAppOrigin(request);
  if (product.primary_packshot) {
    try {
      const normalized = await normalizePackshot(product.primary_packshot, user.id, !user.isDemo);
      product = {
        ...product,
        primary_packshot: normalized.url,
        packshots: [
          normalized.url,
          ...product.packshots.filter((url) => url !== product!.primary_packshot),
        ],
      };
    } catch (error) {
      console.warn(
        '[packshot-normalize]',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  const productBrief = briefFromProduct(product, origin);
  const sourceId = existing.media_payload?.source_library_id || existing.id;
  const sourceFormat =
    existing.ad_format === 'stories' ? 'single_image' : existing.ad_format || 'single_image';
  const generated = await buildReplicatedAds({
    campaignInputId: existing.campaign_input_id,
    selected: [
      {
        id: sourceId,
        library_id: sourceId,
        headline: existing.media_payload?.source_headline || existing.headline || '',
        primary_text: existing.media_payload?.source_primary_text || existing.copy_text,
        cta: 'SHOP_NOW',
        ad_format: sourceFormat,
        media_url: existing.media_payload?.source_media_url || null,
        brand: existing.media_payload?.source_brand || null,
      },
    ],
    brand: productBrief.brandName,
    category: productBrief.category,
    productImages: productBrief.packshots,
    product: productBrief,
    language: typeof body.language === 'string' ? body.language : 'English',
    tone: typeof body.tone === 'string' ? body.tone : 'Trustworthy',
    formats: [existing.ad_format || 'single_image'],
    template: [
      'hero-product',
      'offer-card',
      'benefit-proof',
      'recipe-lifestyle',
      'variety-grid',
    ].includes(body.template)
      ? body.template
      : undefined,
    competitorBrand: existing.media_payload?.source_brand || null,
    competitorNames: existing.media_payload?.source_brand
      ? [existing.media_payload.source_brand]
      : [],
  });
  let candidate =
    generated.find((ad) => ad.ad_format === existing.ad_format) || generated[0];
  if (!candidate) {
    return NextResponse.json({ error: 'Could not regenerate creative' }, { status: 500 });
  }

  if (mode === 'copy') {
    candidate = {
      ...candidate,
      image_url: existing.image_url || '',
      media_payload: { ...candidate.media_payload, ...existing.media_payload },
    };
  } else {
    const aspect = candidate.ad_format === 'stories' ? '9:16' : '1:1';
    const bake = async (url: string, expectedAspect: '1:1' | '9:16') =>
      (
        await bakeCreativeAsset({
          creativeUrl: url,
          origin,
          ownerId: user.id,
          expectedAspect,
          persistToStorage: !user.isDemo,
        })
      ).url;
    if (candidate.media_payload.cards?.length) {
      candidate.media_payload.cards = await Promise.all(
        candidate.media_payload.cards.map(async (card) => ({
          ...card,
          image_url: await bake(card.image_url, '1:1'),
        }))
      );
    }
    if (candidate.media_payload.frames?.length) {
      candidate.media_payload.frames = await Promise.all(
        candidate.media_payload.frames.map(async (frame) => ({
          ...frame,
          image_url: await bake(frame.image_url, '9:16'),
        }))
      );
    }
    candidate.image_url =
      candidate.media_payload.cards?.[0]?.image_url ||
      candidate.media_payload.frames?.[0]?.image_url ||
      (candidate.image_url ? await bake(candidate.image_url, aspect) : '');
    if (candidate.ad_format === 'video' && candidate.media_payload.frames?.length) {
      const images: MotionVideoImage[] = candidate.media_payload.frames.map((frame) =>
        frame.image_url.startsWith('/uploads/')
          ? { kind: 'local', path: frame.image_url }
          : { kind: 'remote', url: frame.image_url }
      );
      const video = await renderMotionTemplateVideo({
        images,
        aspect: '9:16',
        durationSeconds: 10,
        publicOrigin: origin,
        filenamePrefix: product.product_name,
      });
      if (video.ok) {
        const [videoUrl, posterUrl] = user.isDemo
          ? [video.videoUrl, video.posterUrl]
          : await Promise.all([
              persistCreativeFile({
                publicPath: video.videoPath,
                ownerId: user.id,
                contentType: 'video/mp4',
              }),
              persistCreativeFile({
                publicPath: video.posterPath,
                ownerId: user.id,
                contentType: 'image/jpeg',
              }),
            ]);
        candidate.image_url = posterUrl;
        candidate.media_payload.video_url = videoUrl;
        candidate.media_payload.poster_url = posterUrl;
        candidate.media_payload.duration_ms = video.durationSeconds * 1000;
      }
    }
  }

  if (mode === 'visual') {
    candidate.copy_text = existing.copy_text;
    candidate.headline = existing.headline || candidate.headline;
  }
  const quality = evaluateCreativeQuality({
    headline: candidate.headline,
    primaryText: candidate.copy_text,
    imageUrl: candidate.image_url,
    product: productBrief,
    competitorNames: existing.media_payload?.source_brand
      ? [existing.media_payload.source_brand]
      : [],
  });
  candidate.media_payload = {
    ...existing.media_payload,
    ...candidate.media_payload,
    quality_score: quality.score,
    quality_flags: quality.flags,
    quality_valid: quality.valid,
  };

  if (user.isDemo) {
    const index = demoAds.findIndex((ad) => ad.id === existing!.id);
    const saved: GeneratedAd = {
      ...existing,
      ...candidate,
      id: mode === 'duplicate' ? randomUUID() : existing.id,
      variant_number:
        mode === 'duplicate'
          ? Math.max(0, ...demoAds.map((ad) => ad.variant_number)) + 1
          : existing.variant_number,
      status: 'pending',
      created_at: mode === 'duplicate' ? new Date().toISOString() : existing.created_at,
    };
    if (mode === 'duplicate') demoAds.push(saved);
    else demoAds[index] = saved;
    return persistDemoAds(NextResponse.json({ ad: saved }), demoAds);
  }

  const payload = {
    campaign_input_id: candidate.campaign_input_id,
    variant_number:
      mode === 'duplicate' ? existing.variant_number + 1000 : existing.variant_number,
    copy_text: candidate.copy_text,
    image_url: candidate.image_url,
    status: 'pending',
    ad_format: candidate.ad_format,
    media_payload: candidate.media_payload,
    headline: candidate.headline,
    angle: candidate.angle,
  };
  const query =
    mode === 'duplicate'
      ? supabase.from('generated_ads').insert(payload)
      : supabase.from('generated_ads').update(payload).eq('id', existing.id);
  const { data, error } = await query.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ad: data });
}
