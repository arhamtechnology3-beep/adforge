import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import { checkTrialAccess } from '@/lib/trial-gate';
import {
  resolveCampaignInput,
  competitorsFromInput,
} from '@/lib/auth/campaign-input';
import {
  readDemoAds,
  persistDemoAds,
  normalizeDemoAd,
} from '@/lib/auth/demo-ads';
import {
  scrapeAllCompetitors,
  generateAdCopy,
  AD_ANGLES,
} from '@/lib/ai';
import {
  buildCreativeUrl,
  extractHeadline,
  extractPrimaryText,
  extractSubline,
  metaCtaForAngle,
  badgeForAngle,
  productSceneUrl,
  META_AD_FORMATS,
  type MetaAdFormat,
} from '@/lib/creatives';
import { buildReplicatedAds, type SelectedLibraryAdInput } from '@/lib/replicate-ads';
import { runCreativeEngine } from '@/lib/creative-engine';
import { bakeCreativeAsset, normalizePackshot } from '@/lib/creative-assets';
import { resolveAppOrigin } from '@/lib/app-url';
import { readDemoProducts, type Product } from '@/lib/product-catalog';
import type { ProductBrief } from '@/lib/creative-quality';
import {
  renderMotionTemplateVideo,
  type MotionVideoImage,
  type MotionVideoSuccess,
} from '@/lib/motion-video';
import { readFile } from 'fs/promises';
import path from 'path';
import type { AdMediaPayload } from '@/types/database';
import type { CompetitorEntry } from '@/types/database';
import {
  buildProductUrlCarouselAd,
  parseCarouselProductUrls,
  resolveCarouselProductUrls,
} from '@/lib/carousel-from-urls';
import { rankProductImageUrls, unwrapProxiedProductImage } from '@/lib/product-image-preference';

export const maxDuration = 300;

type AdRow = {
  campaign_input_id: string;
  variant_number: number;
  copy_text: string;
  image_url: string;
  status: 'pending';
  ad_format: MetaAdFormat;
  media_payload: AdMediaPayload;
  headline: string;
  angle: string;
};

async function bakeAdRows(
  rows: AdRow[],
  request: Request,
  ownerId: string,
  persistToStorage: boolean
): Promise<AdRow[]> {
  const origin = resolveAppOrigin(request);
  const bake = async (url: string, aspect: '1:1' | '9:16') =>
    (
      await bakeCreativeAsset({
        creativeUrl: url,
        origin,
        ownerId,
        expectedAspect: aspect,
        persistToStorage,
      })
    ).url;

  const output: AdRow[] = [];
  for (const row of rows) {
    try {
      const payload = { ...row.media_payload };
      if (payload.cards?.length) {
        // Product-URL carousels already use real store images — do not re-bake via /api/ads/creative
        if (payload.carousel_source === 'product_urls') {
          payload.cards = payload.cards.map((card) => ({ ...card }));
        } else {
          payload.cards = await Promise.all(
            payload.cards.map(async (card) => ({
              ...card,
              image_url: await bake(card.image_url, '1:1'),
            }))
          );
        }
      }
      if (payload.frames?.length) {
        payload.frames = await Promise.all(
          payload.frames.map(async (frame) => ({
            ...frame,
            image_url: await bake(frame.image_url, payload.aspect === '9:16' ? '9:16' : '1:1'),
          }))
        );
      }
      const aspect = row.ad_format === 'stories' ? '9:16' : '1:1';
      const imageUrl =
        payload.carousel_source === 'product_urls'
          ? payload.cards?.[0]?.image_url || row.image_url
          : payload.cards?.[0]?.image_url ||
            payload.frames?.[0]?.image_url ||
            (row.image_url ? await bake(row.image_url, aspect) : '');
      output.push({ ...row, image_url: imageUrl, media_payload: payload });
    } catch (error) {
      const packshot =
        (typeof row.media_payload?.primary_packshot === 'string' &&
          row.media_payload.primary_packshot) ||
        '';
      output.push({
        ...row,
        image_url: packshot || row.image_url,
        media_payload: {
          ...row.media_payload,
          primary_packshot: packshot || row.media_payload?.primary_packshot || null,
          quality_valid: Boolean(packshot),
          quality_score: Math.min(row.media_payload.quality_score ?? 55, packshot ? 70 : 40),
          quality_flags: [
            ...(row.media_payload.quality_flags || []),
            packshot
              ? 'Used approved product packshot after render failed'
              : `Render failed: ${error instanceof Error ? error.message : String(error)}`,
          ],
        },
      });
    }
  }
  return output;
}

async function renderMotionRows(
  rows: AdRow[],
  origin: string,
  product: ProductBrief,
  ownerId: string,
  persistToStorage: boolean
): Promise<AdRow[]> {
  const persist = async (result: MotionVideoSuccess) => {
    if (!persistToStorage) {
      return { videoUrl: result.videoUrl, posterUrl: result.posterUrl };
    }
    const { createServiceClient } = await import('@/lib/supabase/server');
    const admin = await createServiceClient();
    const videoName = path.basename(result.videoPath);
    const posterName = path.basename(result.posterPath);
    const [video, poster] = await Promise.all([
      readFile(path.join(process.cwd(), 'public', result.videoPath.replace(/^\//, ''))),
      readFile(path.join(process.cwd(), 'public', result.posterPath.replace(/^\//, ''))),
    ]);
    const videoPath = `${ownerId}/${videoName}`;
    const posterPath = `${ownerId}/${posterName}`;
    const [videoUpload, posterUpload] = await Promise.all([
      admin.storage
        .from('creative-assets')
        .upload(videoPath, video, { contentType: 'video/mp4', upsert: false }),
      admin.storage
        .from('creative-assets')
        .upload(posterPath, poster, { contentType: 'image/jpeg', upsert: false }),
    ]);
    if (videoUpload.error || posterUpload.error) {
      throw new Error(
        `Video storage failed: ${videoUpload.error?.message || posterUpload.error?.message}`
      );
    }
    return {
      videoUrl: admin.storage.from('creative-assets').getPublicUrl(videoPath).data.publicUrl,
      posterUrl: admin.storage.from('creative-assets').getPublicUrl(posterPath).data.publicUrl,
    };
  };

  const output: AdRow[] = [];
  for (const row of rows) {
    if (row.ad_format !== 'video') {
      output.push(row);
      continue;
    }
    const urls = (row.media_payload.frames || [])
      .map((frame) => frame.image_url)
      .filter(Boolean);
    const images: MotionVideoImage[] = urls.map((url) =>
      url.startsWith('/uploads/')
        ? { kind: 'local', path: url }
        : { kind: 'remote', url }
    );
    try {
      const result = await renderMotionTemplateVideo({
        images,
        aspect: row.media_payload.aspect === '9:16' ? '9:16' : '1:1',
        durationSeconds: 10,
        publicOrigin: origin,
        filenamePrefix: `${product.brandName}-${product.productName}`,
      });
      if (!result.ok) throw new Error(result.error);
      const persisted = await persist(result);
      output.push({
        ...row,
        image_url: persisted.posterUrl,
        media_payload: {
          ...row.media_payload,
          video_url: persisted.videoUrl,
          poster_url: persisted.posterUrl,
          duration_ms: Math.round(result.durationSeconds * 1000),
        },
      });
    } catch (error) {
      output.push({
        ...row,
        media_payload: {
          ...row.media_payload,
          quality_valid: false,
          quality_score: Math.min(row.media_payload.quality_score ?? 40, 40),
          quality_flags: [
            ...(row.media_payload.quality_flags || []),
            `Video render failed: ${error instanceof Error ? error.message : String(error)}`,
          ],
        },
      });
    }
  }
  return output;
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const trial = await checkTrialAccess(sessionUser);
  if (!trial.allowed) {
    return NextResponse.json({ error: trial.message, trial_expired: true }, { status: 402 });
  }

  const supabase = await createClient();
  const user = { id: sessionUser.id };

  const body = await request.json();
  const campaign_input_id = body.campaign_input_id as string;
  const selectedAds = (Array.isArray(body.selected_ads)
    ? body.selected_ads
    : []) as SelectedLibraryAdInput[];
  const selectedIds = Array.isArray(body.selected_competitor_ad_ids)
    ? (body.selected_competitor_ad_ids as string[])
    : [];
  const productId = typeof body.product_id === 'string' ? body.product_id : '';
  const requestedVariantCount = Math.max(
    1,
    Math.min(5, Number(body.generation_brief?.variant_count) || 3)
  );

  if (!campaign_input_id) {
    return NextResponse.json({ error: 'campaign_input_id required' }, { status: 400 });
  }
  if (!productId) {
    return NextResponse.json(
      { error: 'Select one approved product before generation' },
      { status: 400 }
    );
  }

  const { data: campaignInput } = await supabase
    .from('campaigns_input')
    .select('*')
    .eq('id', campaign_input_id)
    .eq('user_id', user.id)
    .single();

  const resolvedInput = sessionUser.isDemo
    ? await resolveCampaignInput(sessionUser, campaign_input_id)
    : campaignInput
      ? {
          id: campaignInput.id,
          user_id: campaignInput.user_id,
          website_url: campaignInput.website_url,
          competitors: (campaignInput.competitors as CompetitorEntry[]) || [],
          competitor_url: campaignInput.competitor_url,
          competitor_type: campaignInput.competitor_type,
          isDemo: false,
        }
      : null;

  if (!resolvedInput) {
    return NextResponse.json({ error: 'Campaign input not found' }, { status: 404 });
  }

  let product: Product | null = null;
  if (sessionUser.isDemo) {
    product = (await readDemoProducts()).find((item) => item.id === productId) || null;
  } else {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('user_id', user.id)
      .maybeSingle();
    product = (data as Product | null) || null;
  }
  if (!product || !product.is_active || !product.is_approved) {
    return NextResponse.json({ error: 'Approved product not found' }, { status: 404 });
  }
  if (!product.primary_packshot) {
    return NextResponse.json(
      { error: 'The selected product needs an approved primary packshot' },
      { status: 422 }
    );
  }

  const origin = resolveAppOrigin(request);
  const absoluteAsset = (value: string) =>
    value.startsWith('/') ? `${origin}${value}` : value;
  let primaryPackshot = product.primary_packshot;
  try {
    const normalized = await normalizePackshot(
      product.primary_packshot,
      sessionUser.id,
      !sessionUser.isDemo
    );
    primaryPackshot = normalized.url;
    if (primaryPackshot !== product.primary_packshot && !sessionUser.isDemo) {
      const nextPackshots = [
        primaryPackshot,
        ...product.packshots.filter((url) => url !== primaryPackshot && url !== product.primary_packshot),
      ];
      await supabase
        .from('products')
        .update({
          primary_packshot: primaryPackshot,
          packshots: nextPackshots,
        })
        .eq('id', product.id)
        .eq('user_id', user.id);
    }
  } catch (error) {
    console.warn(
      '[packshot-normalize]',
      error instanceof Error ? error.message : String(error)
    );
  }
  const productBrief: ProductBrief = {
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
    primaryPackshot: absoluteAsset(primaryPackshot),
    packshots: (product.packshots.length ? product.packshots : [product.primary_packshot]).map(
      absoluteAsset
    ),
  };

  // Pull live PDP images from carousel URLs early so Image / Stories / Video
  // use real storefront photos instead of a broken transparent cutout.
  const carouselProductUrlsEarly = parseCarouselProductUrls(body.carousel_product_urls);
  let resolvedCarouselProducts: Awaited<
    ReturnType<typeof resolveCarouselProductUrls>
  >['products'] = [];
  if (carouselProductUrlsEarly.length >= 1) {
    try {
      const resolved = await resolveCarouselProductUrls(carouselProductUrlsEarly);
      resolvedCarouselProducts = resolved.products;
      const storefront = rankProductImageUrls(
        resolved.products.map((item) => unwrapProxiedProductImage(item.image_url || ''))
      );
      if (storefront.length) {
        const ranked = rankProductImageUrls([
          ...storefront,
          productBrief.primaryPackshot,
          ...productBrief.packshots,
        ]);
        productBrief.packshots = ranked.map(absoluteAsset);
        productBrief.primaryPackshot = absoluteAsset(ranked[0]!);
        primaryPackshot = ranked[0]!;
      }
    } catch (error) {
      console.warn(
        '[carousel-storefront]',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  const productImages = productBrief.packshots;
  const brand = productBrief.brandName;
  const category = productBrief.category;
  const websiteContent = '';

  const competitors = competitorsFromInput(resolvedInput);

  const competitorIntel = await scrapeAllCompetitors(competitors, { fetchLiveAds: false });

  const resolvedSelected = selectedAds.filter((a) => a && (a.library_id || a.id));
  if (resolvedSelected.length === 0 && selectedIds.length > 0) {
    for (const comp of competitorIntel) {
      for (const ad of comp.live_meta_ads || []) {
        if (selectedIds.includes(ad.id) || selectedIds.includes(`lib_${ad.library_id}`)) {
          resolvedSelected.push({
            id: ad.id,
            library_id: ad.library_id,
            primary_text: ad.primary_text,
            headline: ad.headline,
            cta: ad.cta,
            ad_format: ad.ad_format,
            media_url: ad.media_url,
            performance_rating: ad.performance_rating,
            performance_label: ad.performance_label,
            brand: comp.brand,
          });
        }
      }
    }
  }

  const requestedFormats: MetaAdFormat[] = Array.isArray(body.generation_brief?.formats)
    ? body.generation_brief.formats.filter((format: unknown): format is MetaAdFormat =>
        ['single_image', 'carousel', 'stories', 'video'].includes(String(format))
      )
    : ['single_image', 'carousel', 'stories', 'video'];
  const carouselProductUrls = carouselProductUrlsEarly;
  const wantsProductUrlCarousel =
    requestedFormats.includes('carousel') && carouselProductUrls.length >= 2;
  const engineFormats = wantsProductUrlCarousel
    ? requestedFormats.filter((format) => format !== 'carousel')
    : requestedFormats;
  const carouselOnlyFromUrls =
    wantsProductUrlCarousel && engineFormats.length === 0;

  if (resolvedSelected.length === 0 && !carouselOnlyFromUrls) {
    const { buildAlgorithmSeedAds } = await import('@/lib/algorithm-seed-ads');
    const seeds = buildAlgorithmSeedAds(product);
    for (const ad of seeds) {
      resolvedSelected.push({
        id: ad.id,
        library_id: ad.library_id,
        primary_text: ad.primary_text,
        headline: ad.headline,
        cta: ad.cta,
        ad_format: ad.ad_format,
        media_url: ad.media_url,
        performance_rating: ad.performance_rating,
        performance_label: ad.performance_label,
        brand: product.brand_name,
      });
    }
  }

  if (resolvedSelected.length === 0 && !carouselOnlyFromUrls) {
    return NextResponse.json(
      { error: 'Could not build Meta-style creatives for this product. Approve a packshot and try again.' },
      { status: 400 }
    );
  }

  const useCreativeEngine = body.use_creative_engine !== false;
  const selectedDirectionIds = Array.isArray(body.selected_direction_ids)
    ? (body.selected_direction_ids as string[])
    : undefined;
  const selectedDirections = Array.isArray(body.selected_directions)
    ? body.selected_directions
    : undefined;
  const runAsync = body.async === true;

  if (runAsync) {
    const { creativeGenerationQueue } = await import('@/workers/queues');
    const job = await creativeGenerationQueue.add('generate-pack', {
      userId: sessionUser.id,
      isDemo: sessionUser.isDemo,
      payload: {
        campaign_input_id,
        product_id: productId,
        selected_ads: resolvedSelected,
        selected_direction_ids: selectedDirectionIds,
        generation_brief: body.generation_brief,
      },
    });
    return NextResponse.json({
      job_id: job.id,
      status: 'queued',
      poll_url: `/api/ads/generate/jobs/${job.id}`,
      note: 'Creative pack generation queued. Poll the job URL for status.',
    });
  }

  let ads: AdRow[] = [];
  let usedCreativeEngine = false;
  let carouselWarnings: string[] = [];

  if (wantsProductUrlCarousel) {
    const productsForCarousel =
      resolvedCarouselProducts.length >= 1
        ? resolvedCarouselProducts
        : (await resolveCarouselProductUrls(carouselProductUrls)).products;
    const built = buildProductUrlCarouselAd({
      campaignInputId: resolvedInput.id,
      products: productsForCarousel,
      brandName: brand,
      productId: product.id,
      variantNumber: 1,
    });
    carouselWarnings = built.warnings;
    if (!built.ad) {
      return NextResponse.json(
        {
          error:
            built.warnings.join(' ') ||
            'Could not build a carousel from the product URLs. Check that each page has a product image.',
          warnings: built.warnings,
        },
        { status: 422 }
      );
    }
    ads.push(built.ad as AdRow);
  }

  if (resolvedSelected.length > 0 && useCreativeEngine && engineFormats.length > 0) {
    usedCreativeEngine = true;
    const engine = await runCreativeEngine({
      campaignInputId: resolvedInput.id,
      product: productBrief,
      selectedAds: resolvedSelected.slice(0, requestedVariantCount),
      competitorNames: competitorIntel.map((c) => c.brand),
      language:
        typeof body.generation_brief?.language === 'string'
          ? body.generation_brief.language
          : 'English',
      tone:
        typeof body.generation_brief?.tone === 'string'
          ? body.generation_brief.tone
          : 'Trustworthy',
      formats: engineFormats,
      selectedDirectionIds,
      selectedDirections,
      origin,
      ownerId: sessionUser.id,
      persistToStorage: !sessionUser.isDemo,
      maxDirections: requestedVariantCount,
    });
    const engineAds = engine.ads as AdRow[];
    // Keep product-URL carousel first; renumber variants
    ads = [...ads, ...engineAds].map((ad, index) => ({
      ...ad,
      variant_number: index + 1,
    }));
    if (ads.length === 0) {
      return NextResponse.json(
        {
          error:
            'No creatives were produced. Re-plan directions and try again, or check that your product packshot loads correctly.',
        },
        { status: 422 }
      );
    }
  } else if (resolvedSelected.length > 0 && engineFormats.length > 0) {
    const replicated = await buildReplicatedAds({
      campaignInputId: resolvedInput.id,
      selected: resolvedSelected.slice(0, requestedVariantCount),
      brand,
      category,
      productImages,
      product: productBrief,
      language:
        typeof body.generation_brief?.language === 'string'
          ? body.generation_brief.language
          : 'English',
      tone:
        typeof body.generation_brief?.tone === 'string'
          ? body.generation_brief.tone
          : 'Trustworthy',
      formats: engineFormats,
      competitorBrand: competitorIntel[0]?.brand || null,
      competitorNames: competitorIntel.map((c) => c.brand),
    });
    ads = [...ads, ...replicated].map((ad, index) => ({
      ...ad,
      variant_number: index + 1,
    }));
  } else if (ads.length === 0) {
    const variants = await generateAdCopy(
      websiteContent,
      competitors,
      resolvedInput.website_url
    );

    let n = 0;
    const enriched = variants.map((variant) => {
      const angle = AD_ANGLES.find((a) => a.angle === variant.angle)?.angle || 'offer-led';
      const primaryText = extractPrimaryText(variant.copy_text);
      const headline = extractHeadline(variant.copy_text, brand);
      const subline = extractSubline(variant.copy_text, category, brand);
      const cta = metaCtaForAngle(angle);
      const badge = badgeForAngle(angle);
      const productImage = primaryPackshot;
      const sceneImage = productSceneUrl(category, angle, variant.variant_number * 17 + 42);
      return {
        variant,
        angle,
        primaryText,
        headline,
        subline,
        cta,
        badge,
        productImage,
        sceneImage,
      };
    });

    for (const item of enriched.slice(0, 4)) {
      n += 1;
      ads.push({
        campaign_input_id: resolvedInput.id,
        variant_number: n,
        copy_text: item.primaryText,
        image_url: buildCreativeUrl({
          brand,
          headline: item.headline,
          subline: item.subline,
          angle: item.angle,
          cta: item.cta,
          badge: item.badge,
          productImage: item.productImage,
          sceneImage: item.sceneImage,
          format: 'feed_1x1',
          adFormat: 'single_image',
          variant: n,
        }),
        status: 'pending',
        ad_format: 'single_image',
        media_payload: {
          placement: META_AD_FORMATS.single_image.placement,
          aspect: '1:1',
          product_images: item.productImage ? [item.productImage] : [],
        },
        headline: item.headline,
        angle: item.angle,
      });
    }

    for (const item of enriched.slice(4, 6)) {
      n += 1;
      ads.push({
        campaign_input_id: resolvedInput.id,
        variant_number: n,
        copy_text: item.primaryText,
        image_url: buildCreativeUrl({
          brand,
          headline: item.headline,
          subline: item.subline,
          angle: item.angle,
          cta: item.cta,
          badge: item.badge,
          productImage: item.productImage,
          sceneImage: item.sceneImage,
          format: 'story_9x16',
          adFormat: 'stories',
          variant: n,
        }),
        status: 'pending',
        ad_format: 'stories',
        media_payload: {
          placement: META_AD_FORMATS.stories.placement,
          aspect: '9:16',
          product_images: item.productImage ? [item.productImage] : [],
        },
        headline: item.headline,
        angle: item.angle,
      });
    }

    const carouselSources = [enriched[0], enriched[6] || enriched[1]].filter(Boolean);
    for (const item of carouselSources) {
      n += 1;
      const cardCount = Math.min(5, Math.max(3, productImages.length || 3));
      const cards = Array.from({ length: cardCount }, (_, i) => {
        const img = primaryPackshot;
        const cardHeadline =
          i === 0
            ? item.headline
            : extractSubline(item.primaryText, category, brand).split(' · ')[i - 1] ||
              `${brand} · Shop`;
        return {
            image_url: buildCreativeUrl({
              brand,
            headline: String(cardHeadline).slice(0, 40),
            subline: item.subline,
            angle: item.angle,
            cta: item.cta,
            badge: i === 0 ? item.badge : `CARD ${i + 1}`,
            productImage: img,
            sceneImage: img ? null : item.sceneImage,
            format: 'feed_1x1',
            adFormat: 'carousel',
            variant: n * 10 + i,
          }),
          headline: String(cardHeadline).slice(0, 40),
          description: item.subline,
        };
      });
      ads.push({
        campaign_input_id: resolvedInput.id,
        variant_number: n,
        copy_text: item.primaryText,
        image_url: cards[0]?.image_url || '',
        status: 'pending',
        ad_format: 'carousel',
        media_payload: {
          placement: META_AD_FORMATS.carousel.placement,
          aspect: '1:1',
          cards,
          product_images: productImages.slice(0, cardCount),
        },
        headline: item.headline,
        angle: item.angle,
      });
    }

    const videoSources = [enriched[2], enriched[8] || enriched[3]].filter(Boolean);
    for (const item of videoSources) {
      n += 1;
      const frameCount = Math.min(4, Math.max(3, productImages.length || 3));
      const frames = Array.from({ length: frameCount }, (_, i) => {
        const img = primaryPackshot;
        const frameHeadlines = [
          item.headline,
          item.subline.split(' · ')[0] || brand,
          item.subline.split(' · ')[1] || 'Shop authentic',
          item.cta,
        ];
        return {
            image_url: buildCreativeUrl({
              brand,
            headline: frameHeadlines[i] || item.headline,
            subline: item.subline,
            angle: item.angle,
            cta: item.cta,
            badge: i === 0 ? item.badge : 'WATCH',
            productImage: img,
            sceneImage: img ? null : item.sceneImage,
            format: 'feed_1x1',
            adFormat: 'video',
            variant: n * 10 + i,
          }),
          headline: frameHeadlines[i] || item.headline,
          duration_ms: 2200,
        };
      });
      ads.push({
        campaign_input_id: resolvedInput.id,
        variant_number: n,
        copy_text: item.primaryText,
        image_url: frames[0]?.image_url || '',
        status: 'pending',
        ad_format: 'video',
        media_payload: {
          placement: META_AD_FORMATS.video.placement,
          aspect: '1:1',
          frames,
          product_images: productImages.slice(0, frameCount),
        },
        headline: item.headline,
        angle: item.angle,
      });
    }
  }

  if (!usedCreativeEngine) {
    ads = await bakeAdRows(ads, request, sessionUser.id, !sessionUser.isDemo);
    ads = await renderMotionRows(
      ads,
      origin,
      productBrief,
      sessionUser.id,
      !sessionUser.isDemo
    );
  }

  if (sessionUser.isDemo) {
    const savedAds = ads.map((ad, i) => normalizeDemoAd(ad as unknown as Record<string, unknown>, i));
    const byFormat = savedAds.reduce<Record<string, number>>((acc, ad) => {
      const f = ad.ad_format || 'single_image';
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {});

    const response = NextResponse.json({
      ads: savedAds,
      count: savedAds.length,
      brand,
      category,
      product_images: productImages,
      competitor_intel: competitorIntel,
      selected_count: resolvedSelected.length,
      formats: byFormat,
      note: wantsProductUrlCarousel
        ? `Built a product-URL carousel with real store images${
            carouselWarnings.length ? ` (${carouselWarnings.length} URL(s) skipped)` : ''
          }.${
            resolvedSelected.length > 0
              ? ` Also generated ${
                  (savedAds?.length || 0) - (wantsProductUrlCarousel ? 1 : 0)
                } other format creatives.`
              : ''
          }`
        : resolvedSelected.length > 0
          ? `Generated ${savedAds?.length || 0} original creatives from selected directions using the product-safe creative engine.`
          : 'Review Image, Carousel, Stories & Video options — approve what you want to launch.',
      warnings: carouselWarnings.length ? carouselWarnings : undefined,
    });
    return persistDemoAds(response, savedAds);
  }

  const { createServiceClient } = await import('@/lib/supabase/server');
  const admin = await createServiceClient();
  await admin.from('generated_ads').delete().eq('campaign_input_id', resolvedInput.id);

  let { data: savedAds, error } = await supabase.from('generated_ads').insert(ads).select();

  if (error && /ad_format|media_payload|headline|angle/i.test(error.message)) {
    const legacy = ads.map(({ campaign_input_id, variant_number, copy_text, image_url, status }) => ({
      campaign_input_id,
      variant_number,
      copy_text,
      image_url,
      status,
    }));
    const retry = await supabase.from('generated_ads').insert(legacy).select();
    savedAds = (retry.data || []).map((row, i) => ({
      ...row,
      ad_format: ads[i]?.ad_format || 'single_image',
      media_payload: ads[i]?.media_payload || {},
      headline: ads[i]?.headline || null,
      angle: ads[i]?.angle || null,
    }));
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byFormat = (savedAds || []).reduce<Record<string, number>>((acc, ad) => {
    const f = (ad as AdRow).ad_format || 'single_image';
    acc[f] = (acc[f] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ads: savedAds,
    count: savedAds?.length || 0,
    brand,
    category,
    product_images: productImages,
    competitor_intel: competitorIntel,
    selected_count: resolvedSelected.length,
    formats: byFormat,
    note: wantsProductUrlCarousel
      ? `Built a product-URL carousel with real store images${
          carouselWarnings.length ? ` (${carouselWarnings.length} URL(s) skipped)` : ''
        }.`
      : resolvedSelected.length > 0
        ? `Generated ${savedAds?.length || 0} original creatives from selected directions using the product-safe creative engine.`
        : 'Review Image, Carousel, Stories & Video options — approve what you want to launch.',
    warnings: carouselWarnings.length ? carouselWarnings : undefined,
  });
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const campaignInputId = searchParams.get('campaign_input_id');

  const resolvedInput = await resolveCampaignInput(sessionUser, campaignInputId);
  if (!resolvedInput) {
    return NextResponse.json({ error: 'Campaign input not found' }, { status: 404 });
  }

  const competitors = competitorsFromInput(resolvedInput);
  const competitorIntel = await scrapeAllCompetitors(competitors, { fetchLiveAds: false });

  if (sessionUser.isDemo) {
    const ads = await readDemoAds();
    return NextResponse.json({
      ads,
      competitor_intel: competitorIntel,
      demo: true,
      note:
        competitors.length === 0
          ? 'Add competitors in Onboarding to load Ad Library ads.'
          : undefined,
    });
  }

  const supabase = await createClient();
  const { data: ads } = await supabase
    .from('generated_ads')
    .select('*')
    .eq('campaign_input_id', resolvedInput.id)
    .order('variant_number');

  return NextResponse.json({
    ads: ads || [],
    competitor_intel: competitorIntel,
  });
}
