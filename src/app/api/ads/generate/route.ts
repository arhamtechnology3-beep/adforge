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
  withDemoAdsCookie,
  normalizeDemoAd,
} from '@/lib/auth/demo-ads';
import {
  scrapeWebsite,
  scrapeWebsiteImages,
  scrapeAllCompetitors,
  generateAdCopy,
  extractBrandContext,
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
import type { AdMediaPayload } from '@/types/database';
import type { CompetitorEntry } from '@/types/database';

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

  if (!campaign_input_id) {
    return NextResponse.json({ error: 'campaign_input_id required' }, { status: 400 });
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

  const websiteContent = await scrapeWebsite(resolvedInput.website_url);
  const productImages = await scrapeWebsiteImages(resolvedInput.website_url, 10);
  const { brand, category } = extractBrandContext(
    websiteContent,
    resolvedInput.website_url
  );

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


  let ads: AdRow[] = [];

  if (resolvedSelected.length > 0) {
    ads = await buildReplicatedAds({
      campaignInputId: resolvedInput.id,
      selected: resolvedSelected,
      brand,
      category,
      productImages,
      competitorBrand: competitorIntel[0]?.brand || null,
      competitorNames: competitorIntel.map((c) => c.brand),
    });
  } else {
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
      const productImage =
        productImages.length > 0
          ? productImages[(variant.variant_number - 1) % productImages.length]
          : null;
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
        const img =
          productImages.length > 0
            ? productImages[i % productImages.length]
            : item.productImage;
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
        const img =
          productImages.length > 0
            ? productImages[(i + item.variant.variant_number) % productImages.length]
            : item.productImage;
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
      note:
        resolvedSelected.length > 0
          ? `Replicated ${resolvedSelected.length} selected competitor ads into Meta formats using your product creatives. Review, edit, then approve for launch.`
          : 'Review Image, Carousel, Stories & Video options — approve what you want to launch.',
    });
    return withDemoAdsCookie(response, savedAds);
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
    note:
      resolvedSelected.length > 0
        ? `Replicated ${resolvedSelected.length} selected competitor ads into Meta formats using your product creatives. Review, edit, then approve for launch.`
        : 'Review Image, Carousel, Stories & Video options — approve what you want to launch.',
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
