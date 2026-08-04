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
import type { AdMediaPayload } from '@/types/database';
import type { MetaAdLibraryAd } from '@/lib/ai';
import { scrubCompetitorBrands, scrubHeadline } from '@/lib/brand-scrub';

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

/**
 * Build Meta-ready creatives that replicate selected competitor Library ads
 * using the client's store product images + adapted copy (competitor brands scrubbed).
 */
export function buildReplicatedAds(opts: {
  campaignInputId: string;
  selected: SelectedLibraryAdInput[];
  brand: string;
  category: string;
  productImages: string[];
  appUrl: string;
  competitorBrand?: string | null;
  competitorNames?: Array<string | null | undefined>;
}): ReplicatedAdRow[] {
  const {
    campaignInputId,
    selected,
    brand,
    category,
    productImages,
    appUrl,
    competitorBrand,
    competitorNames = [],
  } = opts;

  const names = [
    competitorBrand,
    ...competitorNames,
    ...selected.map((s) => s.brand),
  ];

  const ads: ReplicatedAdRow[] = [];
  let n = 0;

  for (const src of selected.slice(0, 8)) {
    const angle = 'competitor-beat';
    const primaryText = adaptCopyForBrand(src.primary_text, brand, category, names);
    const headline = adaptHeadline(src.headline, brand, category, names);
    const subline = scrubCompetitorBrands(
      extractSubline(primaryText, category, brand),
      brand,
      names
    );
    const cta =
      scrubCompetitorBrands(src.cta || metaCtaForAngle(angle), brand, names).replace(
        /_/g,
        ' '
      ) || metaCtaForAngle(angle);
    const badge = badgeForAngle(angle);
    const productImage =
      productImages.length > 0 ? productImages[n % productImages.length] : null;
    const sceneImage = productSceneUrl(category, angle, (n + 1) * 19 + 7);
    const sourceMeta: AdMediaPayload = {
      source_library_id: src.library_id || src.id,
      source_headline: scrubCompetitorBrands(src.headline || '', brand, names) || null,
      source_primary_text: scrubCompetitorBrands(src.primary_text || '', brand, names) || null,
      source_brand: competitorBrand || src.brand || null,
      replicate: true,
      product_images: productImage ? [productImage] : productImages.slice(0, 3),
    };

    const targetFormat: MetaAdFormat =
      src.ad_format === 'carousel'
        ? 'carousel'
        : src.ad_format === 'video'
          ? 'video'
          : 'single_image';

    n += 1;
    if (targetFormat === 'carousel') {
      const cardCount = Math.min(5, Math.max(3, productImages.length || 3));
      const cards = Array.from({ length: cardCount }, (_, i) => {
        const img =
          productImages.length > 0
            ? productImages[i % productImages.length]
            : productImage;
        const cardHeadline =
          i === 0 ? headline : `${brand} · ${category}`.slice(0, 40);
        return {
          image_url: buildCreativeUrl({
            baseUrl: appUrl,
            brand,
            headline: cardHeadline,
            subline,
            angle,
            cta,
            badge: i === 0 ? badge : `CARD ${i + 1}`,
            productImage: img,
            sceneImage: img ? null : sceneImage,
            format: 'feed_1x1',
            adFormat: 'carousel',
            variant: n * 10 + i,
          }),
          headline: cardHeadline,
          description: subline,
        };
      });
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
      const frames = Array.from({ length: frameCount }, (_, i) => {
        const img =
          productImages.length > 0
            ? productImages[(i + n) % productImages.length]
            : productImage;
        const frameHeadlines = [headline, subline.split(' · ')[0] || brand, cta, brand];
        return {
          image_url: buildCreativeUrl({
            baseUrl: appUrl,
            brand,
            headline: frameHeadlines[i] || headline,
            subline,
            angle,
            cta,
            badge: i === 0 ? badge : 'WATCH',
            productImage: img,
            sceneImage: img ? null : sceneImage,
            format: 'feed_1x1',
            adFormat: 'video',
            variant: n * 10 + i,
          }),
          headline: frameHeadlines[i] || headline,
          duration_ms: 2200,
        };
      });
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
          aspect: '1:1',
          frames,
        },
        headline,
        angle: `replicate:${src.library_id || src.id}`,
      });
    } else {
      ads.push({
        campaign_input_id: campaignInputId,
        variant_number: n,
        copy_text: primaryText,
        image_url: buildCreativeUrl({
          baseUrl: appUrl,
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

    n += 1;
    ads.push({
      campaign_input_id: campaignInputId,
      variant_number: n,
      copy_text: primaryText,
      image_url: buildCreativeUrl({
        baseUrl: appUrl,
        brand,
        headline,
        subline,
        angle,
        cta,
        badge,
        productImage:
          productImages.length > 0
            ? productImages[(n + 1) % productImages.length]
            : productImage,
        sceneImage,
        format: 'story_9x16',
        adFormat: 'stories',
        variant: n,
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

  return ads;
}
