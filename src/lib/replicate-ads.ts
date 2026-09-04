import {
  buildCreativeUrl,
  extractHeadline,
  extractPrimaryText,
  extractSubline,
  metaCtaForAngle,
  badgeForAngle,
  META_AD_FORMATS,
  type MetaAdFormat,
} from '@/lib/creatives';
import type { AdMediaPayload } from '@/types/database';
import type { MetaAdLibraryAd } from '@/lib/ai';
import { scrubCompetitorBrands, scrubHeadline } from '@/lib/brand-scrub';
import { buildCreativeBrief } from '@/lib/creative-brief';
import { generateSceneImage } from '@/lib/creative-providers';
import {
  evaluateCreativeQuality,
  type ProductBrief,
} from '@/lib/creative-quality';
import { generateGroundedConcepts } from '@/lib/grounded-copy';
import type { GroundedConcept } from '@/lib/grounded-copy';

export type SelectedLibraryAdInput = Pick<
  MetaAdLibraryAd,
  | 'id'
  | 'library_id'
  | 'primary_text'
  | 'headline'
  | 'cta'
  | 'ad_format'
  | 'media_url'
  | 'performance_rating'
  | 'performance_label'
> & { brand?: string | null };

export type ReplicatedAdRow = {
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

function adaptCopyForBrand(
  competitorText: string,
  brand: string,
  category: string,
  competitorNames: Array<string | null | undefined> = []
): string {
  let text = (competitorText || '').trim();
  if (!text) {
    return `Discover ${brand}'s ${category}. Authentic quality your customers will love. Shop now.`;
  }
  text = scrubCompetitorBrands(text, brand, competitorNames);
  return extractPrimaryText(text);
}

function adaptHeadline(
  competitorHeadline: string,
  brand: string,
  category: string,
  competitorNames: Array<string | null | undefined> = []
): string {
  const h = (competitorHeadline || '').trim();
  if (!h || /\{\{/.test(h)) {
    return extractHeadline(`${brand} ${category}`, brand).slice(0, 40);
  }
  const scrubbed = scrubHeadline(h, brand, competitorNames);
  return extractHeadline(scrubbed, brand).slice(0, 40);
}

export async function buildReplicatedAds(opts: {
  campaignInputId: string;
  selected: SelectedLibraryAdInput[];
  brand: string;
  category: string;
  productImages: string[];
  product?: ProductBrief | null;
  language?: string;
  tone?: string;
  template?: GroundedConcept['template'];
  formats?: MetaAdFormat[];
  competitorBrand?: string | null;
  competitorNames?: Array<string | null | undefined>;
}): Promise<ReplicatedAdRow[]> {
  const {
    campaignInputId,
    selected,
    brand,
    category,
    productImages: scrapedProductImages,
    product,
    language,
    tone,
    template,
    formats,
    competitorBrand,
    competitorNames = [],
  } = opts;

  const names = [
    competitorBrand,
    ...competitorNames,
    ...selected.map((s) => s.brand),
  ];
  const productImages = product?.packshots?.length
    ? product.packshots
    : scrapedProductImages;
  const selectedSources = selected.slice(0, 8);
  const groundedConcepts = product
    ? await generateGroundedConcepts(
        product,
        selectedSources,
        names.filter(Boolean) as string[],
        { language, tone }
      )
    : [];

  const ads: ReplicatedAdRow[] = [];
  let n = 0;

  for (const [sourceIndex, src] of selectedSources.entries()) {
    const angle = 'competitor-beat';
    const grounded = groundedConcepts[sourceIndex];
    const primaryText =
      grounded?.primaryText || adaptCopyForBrand(src.primary_text, brand, category, names);
    const headline =
      grounded?.headline || adaptHeadline(src.headline, brand, category, names);
    const subline =
      grounded?.subline ||
      scrubCompetitorBrands(extractSubline(primaryText, category, brand), brand, names);
    const cta =
      grounded?.cta ||
      scrubCompetitorBrands(src.cta || metaCtaForAngle(angle), brand, names).replace(
        /_/g,
        ' '
      ) ||
      metaCtaForAngle(angle);
    const badge = badgeForAngle(angle);
    // One approved hero packshot stays pinned across every placement for this concept.
    const productImage = product?.primaryPackshot || productImages[0] || null;

    const brief = buildCreativeBrief({
      brand,
      category,
      competitorAd: src,
      productName: product?.productName || category,
    });
    const templateChoices = [
      grounded?.template || brief.layoutStyle,
      'hero-product',
      'benefit-proof',
      'recipe-lifestyle',
      'variety-grid',
      'offer-card',
    ].filter((value, index, all) => value && all.indexOf(value) === index);
    const creativeTemplate =
      template || templateChoices[sourceIndex % templateChoices.length] || 'hero-product';

    const [feedScene, storyScene] = await Promise.all([
      generateSceneImage({
        brief,
        category,
        angle,
        seed: (n + 1) * 19 + 7,
        aspect: '1:1',
        productImageUrl: productImage,
        brand,
        headline,
      }),
      generateSceneImage({
        brief,
        category,
        angle,
        seed: (n + 1) * 31 + 11,
        aspect: '9:16',
        productImageUrl: productImage,
        brand,
        headline,
      }),
    ]);

    const useAiFeed = feedScene.isFinalCreative === true;
    const useAiStory = storyScene.isFinalCreative === true;

    const sceneImage = feedScene.url;
    const sourceMeta: AdMediaPayload = {
      source_library_id: src.library_id || src.id,
      source_headline: scrubCompetitorBrands(src.headline || '', brand, names) || null,
      source_primary_text: scrubCompetitorBrands(src.primary_text || '', brand, names) || null,
      source_media_url: src.media_url || null,
      source_brand: competitorBrand || src.brand || null,
      replicate: true,
      product_images: productImage ? [productImage] : productImages.slice(0, 3),
      product_id: product?.id || null,
      product_name: product?.productName || category,
      primary_packshot: productImage,
      template: creativeTemplate,
      creative_brief: {
        mood: brief.mood,
        counter_hook: brief.counterHook,
        layout: brief.layoutStyle,
        scene_provider: feedScene.provider,
      },
    };

    const sourceFormat: MetaAdFormat =
      src.ad_format === 'carousel'
        ? 'carousel'
        : src.ad_format === 'video'
          ? 'video'
          : 'single_image';
    const requestedPrimary = (formats || []).filter((format) => format !== 'stories');
    const targetFormat: MetaAdFormat = requestedPrimary.includes(sourceFormat)
      ? sourceFormat
      : requestedPrimary[sourceIndex % requestedPrimary.length] || sourceFormat;

    n += 1;
    if (targetFormat === 'carousel') {
      const cardCount = Math.min(5, Math.max(3, productImages.length || 3));
      const cards = await Promise.all(Array.from({ length: cardCount }, async (_, i) => {
        const img = productImage;
        const cardAngle = i === 0 ? angle : i % 2 === 0 ? 'aesthetic-studio' : 'trending-ugc';
        const cardScene =
          i === 0
            ? feedScene
            : await generateSceneImage({
                brief,
                category,
                angle: cardAngle,
                seed: (sourceIndex + 1) * 101 + i * 37,
                aspect: '1:1',
                productImageUrl: productImage,
                brand,
                headline,
              });
        const cardHeadline =
          i === 0 ? headline : `${brand} · ${category}`.slice(0, 40);
        return {
          image_url: buildCreativeUrl({
            brand,
            headline: cardHeadline,
            subline,
            angle: cardAngle,
            cta,
            badge: i === 0 ? badge : `CARD ${i + 1}`,
            productImage: img,
            sceneImage: cardScene.url,
            format: 'feed_1x1',
            adFormat: 'carousel',
            variant: n * 10 + i,
            template: creativeTemplate,
          }),
          headline: cardHeadline,
          description: subline,
        };
      }));
      ads.push({
        campaign_input_id: campaignInputId,
        variant_number: n,
        copy_text: primaryText,
        image_url: cards[0]?.image_url || '',
        status: 'pending',
        ad_format: 'carousel',
        media_payload: {
          ...sourceMeta,
          placement: META_AD_FORMATS.carousel.placement,
          aspect: '1:1',
          cards,
        },
        headline,
        angle: `replicate:${src.library_id || src.id}`,
      });
    } else if (targetFormat === 'video') {
      const frameCount = Math.min(4, Math.max(3, productImages.length || 3));
      const frames = await Promise.all(Array.from({ length: frameCount }, async (_, i) => {
        const img = productImage;
        const frameHeadlines = [headline, subline.split(' · ')[0] || brand, cta, brand];
        const frameAngles = ['unboxing-pov', 'trending-ugc', 'benefit-led', 'offer-led'];
        const frameTemplates = [
          'hero-product',
          'recipe-lifestyle',
          'benefit-proof',
          'offer-card',
        ];
        const frameBadges = ['UGC REVIEW', 'WHY I USE IT', 'PRODUCT BENEFIT', 'SHOP NOW'];
        const frameScene =
          i === 0
            ? storyScene
            : await generateSceneImage({
                brief,
                category,
                angle: frameAngles[i] || angle,
                seed: (sourceIndex + 1) * 149 + i * 43,
                aspect: '9:16',
                productImageUrl: productImage,
                brand,
                headline: frameHeadlines[i] || headline,
              });
        return {
          image_url: buildCreativeUrl({
            brand,
            headline: frameHeadlines[i] || headline,
            subline,
            angle: frameAngles[i] || angle,
            cta,
            badge: frameBadges[i] || 'WATCH',
            productImage: img,
            sceneImage: frameScene.url,
            format: 'story_9x16',
            adFormat: 'video',
            variant: n * 10 + i,
            template: frameTemplates[i] || creativeTemplate,
          }),
          headline: frameHeadlines[i] || headline,
          duration_ms: 2200,
        };
      }));
      ads.push({
        campaign_input_id: campaignInputId,
        variant_number: n,
        copy_text: primaryText,
        image_url: frames[0]?.image_url || '',
        status: 'pending',
        ad_format: 'video',
        media_payload: {
          ...sourceMeta,
          placement: META_AD_FORMATS.video.placement,
          aspect: '9:16',
          frames,
          video_style: 'ugc-motion',
        },
        headline,
        angle: `replicate:${src.library_id || src.id}`,
      });
    } else {
      ads.push({
        campaign_input_id: campaignInputId,
        variant_number: n,
        copy_text: primaryText,
        image_url: useAiFeed
          ? feedScene.url
          : buildCreativeUrl({
              brand,
              headline,
              subline,
              angle,
              cta,
              badge,
              productImage,
              sceneImage,
              format: 'feed_1x1',
              adFormat: 'single_image',
              variant: n,
              template: creativeTemplate,
            }),
        status: 'pending',
        ad_format: 'single_image',
        media_payload: {
          ...sourceMeta,
          placement: META_AD_FORMATS.single_image.placement,
          aspect: '1:1',
        },
        headline,
        angle: `replicate:${src.library_id || src.id}`,
      });
    }

    if (!formats || formats.includes('stories')) {
      n += 1;
      ads.push({
      campaign_input_id: campaignInputId,
      variant_number: n,
      copy_text: primaryText,
      image_url: useAiStory
        ? storyScene.url
        : buildCreativeUrl({
            brand,
            headline,
            subline,
            angle,
            cta,
            badge,
            productImage,
            sceneImage: storyScene.url,
            format: 'story_9x16',
            adFormat: 'stories',
            variant: n,
            template: creativeTemplate,
          }),
      status: 'pending',
      ad_format: 'stories',
      media_payload: {
        ...sourceMeta,
        placement: META_AD_FORMATS.stories.placement,
        aspect: '9:16',
      },
      headline,
      angle: `replicate-stories:${src.library_id || src.id}`,
      });
    }
  }

  const requestedAds = formats?.length
    ? ads.filter((ad) => formats.includes(ad.ad_format))
    : ads;
  if (!product) return requestedAds;

  return requestedAds.map((ad) => {
    const quality = evaluateCreativeQuality({
      headline: ad.headline,
      primaryText: ad.copy_text,
      imageUrl: ad.image_url,
      product,
      competitorNames: names.filter(Boolean) as string[],
    });
    return {
      ...ad,
      media_payload: {
        ...ad.media_payload,
        quality_score: quality.score,
        quality_flags: quality.flags,
        quality_valid: quality.valid,
      },
    };
  });
}
