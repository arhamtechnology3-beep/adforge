import {
  buildCreativeUrl,
  badgeForAngle,
  META_AD_FORMATS,
  type MetaAdFormat,
} from '@/lib/creatives';
import { bakeCreativeAsset, normalizePackshot } from '@/lib/creative-assets';
import type {
  CreativeAspect,
  CreativeDirection,
  CreativePackRequest,
  CreativePackResult,
  VideoScenePlan,
} from './types';
import { buildNegativePrompt, angleVariationPrompt } from './prompt-builder';
import { buildMetaAdLibraryPrompt } from './meta-ad-prompt-library';
import { generateSceneWithProviders, generateVideoWithProviders } from './providers';
import { evaluateCreativeQa, shouldAutoRegenerate } from './qa-engine';
import { createGenerationJob, updateGenerationJob } from './generation-jobs';

const FORMAT_BY_DIRECTION: MetaAdFormat[][] = [
  ['single_image'],
  ['carousel'],
  ['stories', 'video'],
];

function formatsForDirection(
  directionIndex: number,
  directionCount: number,
  requested: MetaAdFormat[]
): MetaAdFormat[] {
  if (directionCount <= 1) return requested;
  const assigned = FORMAT_BY_DIRECTION[directionIndex % FORMAT_BY_DIRECTION.length];
  return assigned.filter((format) => requested.includes(format));
}

function sceneSeed(conceptId: string, globalIndex: number, extra = 0): number {
  const conceptHash = conceptId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return globalIndex * 1009 + conceptHash * 31 + extra * 67 + 1;
}

function adFingerprint(ad: CreativePackResult['ads'][number]): string {
  const payload = ad.media_payload;
  const sceneUrl = payload?.scene_url as string | undefined;
  const cards = payload?.cards as Array<{ image_url: string; scene_url?: string }> | undefined;
  const frames = payload?.frames as Array<{ image_url: string; scene_url?: string }> | undefined;
  if (ad.ad_format === 'carousel' && cards?.length) {
    return `carousel:${cards.map((card) => card.scene_url || card.image_url).join('|')}`;
  }
  if (ad.ad_format === 'video' && frames?.length) {
    return `video:${frames.map((frame) => frame.scene_url || frame.image_url).join('|')}`;
  }
  return `${ad.ad_format}:${sceneUrl || ad.image_url}`;
}

function deduplicatePackAds(ads: CreativePackResult['ads']): CreativePackResult['ads'] {
  const seen = new Set<string>();
  const unique: CreativePackResult['ads'] = [];
  for (const ad of ads) {
    const key = adFingerprint(ad);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(ad);
  }
  return unique.map((ad, index) => ({ ...ad, variant_number: index + 1 }));
}

function creativeFormat(aspect: CreativeAspect): 'feed_1x1' | 'feed_4x5' | 'story_9x16' {
  if (aspect === '9:16') return 'story_9x16';
  if (aspect === '4:5') return 'feed_4x5';
  return 'feed_1x1';
}

function buildVideoScenePlan(direction: CreativeDirection): VideoScenePlan {
  return {
    duration: 12,
    ugcType: direction.ugcType || 'product-demo',
    scenes: [
      { start: 0, end: 2.5, purpose: 'hook', headline: direction.hook, angle: direction.angle },
      { start: 2.5, end: 5, purpose: 'problem', headline: direction.primaryText.slice(0, 40) },
      { start: 5, end: 8, purpose: 'productReveal', headline: direction.headline },
      { start: 8, end: 10.5, purpose: 'usage', headline: direction.cta },
      { start: 10.5, end: 12, purpose: 'cta', headline: direction.cta },
    ],
  };
}

async function renderScene(input: {
  truth: CreativePackRequest['truth'];
  direction: CreativeDirection;
  aspect: CreativeAspect;
  seed: number;
  sceneVariant: number;
  userId: string;
  pattern?: CreativePackRequest['patterns'][number];
}) {
  const { prompt, preset, source } = buildMetaAdLibraryPrompt({
    truth: input.truth,
    direction: input.direction,
    category: input.truth.category,
    aspect: input.aspect,
    sceneVariant: input.sceneVariant,
    pattern: input.pattern,
  });
  const fullPrompt = `${prompt} ${angleVariationPrompt(input.direction.angle, input.sceneVariant + input.seed)}`;
  const negativePrompt = buildNegativePrompt(input.truth);
  const scene = await generateSceneWithProviders({
    prompt: fullPrompt,
    negativePrompt,
    aspect: input.aspect,
    seed: input.seed,
    brand: input.truth.brandName,
    category: input.truth.category,
    angle: input.direction.angle,
    productImageUrl: input.truth.primaryPackshot,
    mode: 'background',
    headline: input.direction.headline,
    userId: input.userId,
    scenePresetId: preset.id,
    scenePresetName: preset.name,
  });
  return { ...scene, presetId: preset.id, presetName: preset.name, promptSource: source };
}

export async function buildCreativePack(
  request: CreativePackRequest
): Promise<CreativePackResult> {
  const jobs: string[] = [];
  const ads: CreativePackResult['ads'] = [];
  let variant = 0;
  let globalSceneIndex = 0;
  const formats = request.formats || ['single_image', 'stories', 'carousel', 'video'];
  const packDirections = request.directions.slice(0, 6);

  try {
    const cutout = await normalizePackshot(
      request.truth.primaryPackshot,
      request.ownerId,
      request.persistToStorage
    );
    const cutoutUrl = cutout.url.startsWith('/')
      ? `${request.origin.replace(/\/$/, '')}${cutout.url}`
      : cutout.url;
    request.truth = { ...request.truth, primaryPackshot: cutoutUrl };
  } catch (error) {
    console.warn(
      '[packshot-cutout]',
      error instanceof Error ? error.message : String(error)
    );
  }

  for (const [directionIndex, direction] of packDirections.entries()) {
    const matchedPattern = request.patterns.find(
      (pattern) => pattern.sourceId === direction.sourcePatternId
    );
    const job = await createGenerationJob({
      userId: request.ownerId,
      campaignInputId: request.campaignInputId,
      productId: request.truth.productId,
      assetType: 'pack',
      creativeConceptId: direction.conceptId,
      prompt: direction.visualStory,
      negativePrompt: buildNegativePrompt(request.truth),
      sourceAssets: { direction, patterns: request.patterns },
    });
    jobs.push(job.id);
    await updateGenerationJob(job.id, { status: 'processing', started_at: new Date().toISOString() });

    const badge = badgeForAngle(direction.angle);
    const subline =
      request.truth.benefits[0] ||
      request.truth.description?.slice(0, 70) ||
      `${request.truth.brandName} ${request.truth.category}`;
    const productImage = request.truth.primaryPackshot;
    const directionFormats = formatsForDirection(directionIndex, packDirections.length, formats);

    const staticAspects: CreativeAspect[] = direction.recommendedFormats.filter(
      (aspect): aspect is '1:1' | '4:5' => aspect === '1:1' || aspect === '4:5'
    );
    const storyAspect: CreativeAspect = direction.recommendedFormats.includes('9:16')
      ? '9:16'
      : '9:16';

    if (directionFormats.includes('single_image')) {
      for (const aspect of staticAspects.slice(0, 1)) {
        variant += 1;
        globalSceneIndex += 1;
        let scene = await renderScene({
          truth: request.truth,
          direction,
          aspect,
          seed: sceneSeed(direction.conceptId, globalSceneIndex),
          sceneVariant: globalSceneIndex + directionIndex * 3,
          userId: request.ownerId,
          pattern: matchedPattern,
        });
        let imageUrl = buildCreativeUrl({
          brand: request.truth.brandName,
          headline: direction.headline,
          subline,
          angle: direction.angle,
          cta: direction.cta,
          badge,
          productImage,
          sceneImage: scene.url,
          format: creativeFormat(aspect),
          adFormat: 'single_image',
          variant,
          template: direction.name,
        });
        imageUrl = (
          await bakeCreativeAsset({
            creativeUrl: imageUrl,
            origin: request.origin,
            ownerId: request.ownerId,
            expectedAspect: aspect === '4:5' ? '4:5' : '1:1',
            persistToStorage: request.persistToStorage,
          })
        ).url;

        const qa = await evaluateCreativeQa({
          headline: direction.headline,
          primaryText: direction.primaryText,
          imageUrl,
          product: request.product,
          truth: request.truth,
          competitorNames: request.competitorNames,
          conceptName: direction.name,
          provider: scene.provider,
        });
        if (shouldAutoRegenerate(qa.scores) && (job.retry_count || 0) < 1) {
          globalSceneIndex += 1;
          scene = await renderScene({
            truth: request.truth,
            direction,
            aspect,
            seed: sceneSeed(direction.conceptId, globalSceneIndex, 9),
            sceneVariant: globalSceneIndex + directionIndex * 3 + 9,
            userId: request.ownerId,
            pattern: matchedPattern,
          });
          imageUrl = buildCreativeUrl({
            brand: request.truth.brandName,
            headline: direction.headline,
            subline,
            angle: direction.angle,
            cta: direction.cta,
            badge,
            productImage,
            sceneImage: scene.url,
            format: creativeFormat(aspect),
            adFormat: 'single_image',
            variant: variant + 100,
            template: direction.name,
          });
          imageUrl = (
            await bakeCreativeAsset({
              creativeUrl: imageUrl,
              origin: request.origin,
              ownerId: request.ownerId,
              expectedAspect: aspect === '4:5' ? '4:5' : '1:1',
              persistToStorage: request.persistToStorage,
            })
          ).url;
        }

        ads.push({
          campaign_input_id: request.campaignInputId,
          variant_number: variant,
          copy_text: direction.primaryText,
          image_url: imageUrl,
          status: 'pending',
          ad_format: 'single_image',
          headline: direction.headline,
          angle: `concept:${direction.conceptId}`,
          media_payload: {
            placement: META_AD_FORMATS.single_image.placement,
            aspect,
            product_id: request.truth.productId,
            product_name: request.truth.productName,
            primary_packshot: productImage,
            scene_url: scene.url,
            scene_provider: scene.provider,
            scene_preset: scene.presetId,
            scene_preset_name: scene.presetName,
            prompt_source: scene.promptSource,
            template: direction.name,
            quality_score: qa.scores.overall,
            quality_flags: qa.flags,
            quality_valid: qa.valid,
            creative_brief: {
              mood: direction.emotion,
              counter_hook: direction.hook,
              layout: direction.angle,
              scene_provider: scene.provider,
            },
            concept_id: direction.conceptId,
            qa_scores: qa.scores,
          },
        });
      }
    }

    if (directionFormats.includes('stories')) {
      variant += 1;
      globalSceneIndex += 1;
      const scene = await renderScene({
        truth: request.truth,
        direction,
        aspect: storyAspect,
        seed: sceneSeed(direction.conceptId, globalSceneIndex, 3),
        sceneVariant: globalSceneIndex + directionIndex * 3 + 1,
        userId: request.ownerId,
        pattern: matchedPattern,
      });
      let imageUrl = buildCreativeUrl({
        brand: request.truth.brandName,
        headline: direction.headline,
        subline,
        angle: direction.angle,
        cta: direction.cta,
        badge,
        productImage,
        sceneImage: scene.url,
        format: 'story_9x16',
        adFormat: 'stories',
        variant,
        template: direction.name,
      });
      imageUrl = (
        await bakeCreativeAsset({
          creativeUrl: imageUrl,
          origin: request.origin,
          ownerId: request.ownerId,
          expectedAspect: '9:16',
          persistToStorage: request.persistToStorage,
        })
      ).url;
      const qa = await evaluateCreativeQa({
        headline: direction.headline,
        primaryText: direction.primaryText,
        imageUrl,
        product: request.product,
        truth: request.truth,
        competitorNames: request.competitorNames,
        conceptName: direction.name,
        provider: scene.provider,
      });
      ads.push({
        campaign_input_id: request.campaignInputId,
        variant_number: variant,
        copy_text: direction.primaryText,
        image_url: imageUrl,
        status: 'pending',
        ad_format: 'stories',
        headline: direction.headline,
        angle: `concept-stories:${direction.conceptId}`,
        media_payload: {
          placement: META_AD_FORMATS.stories.placement,
          aspect: '9:16',
          product_id: request.truth.productId,
          product_name: request.truth.productName,
          primary_packshot: productImage,
          scene_url: scene.url,
          scene_provider: scene.provider,
          scene_preset: scene.presetId,
          scene_preset_name: scene.presetName,
          prompt_source: scene.promptSource,
          template: direction.name,
          quality_score: qa.scores.overall,
          quality_flags: qa.flags,
          quality_valid: qa.valid,
          concept_id: direction.conceptId,
          qa_scores: qa.scores,
        },
      });
    }

    if (directionFormats.includes('carousel')) {
      variant += 1;
      const cardCount = 3;
      const cards = [];
      for (let cardIndex = 0; cardIndex < cardCount; cardIndex += 1) {
        globalSceneIndex += 1;
        const scene = await renderScene({
          truth: request.truth,
          direction,
          aspect: '1:1',
          seed: sceneSeed(direction.conceptId, globalSceneIndex, cardIndex + 5),
          sceneVariant: globalSceneIndex + cardIndex * 2 + directionIndex,
          userId: request.ownerId,
          pattern: matchedPattern,
        });
        const cardHeadline =
          cardIndex === 0
            ? direction.headline
            : `${request.truth.brandName} · ${request.truth.category}`.slice(0, 40);
        let imageUrl = buildCreativeUrl({
          brand: request.truth.brandName,
          headline: cardHeadline,
          subline,
          angle: direction.angle,
          cta: direction.cta,
          badge: cardIndex === 0 ? badge : `CARD ${cardIndex + 1}`,
          productImage,
          sceneImage: scene.url,
          format: 'feed_1x1',
          adFormat: 'carousel',
          variant: variant * 10 + cardIndex,
          template: direction.name,
        });
        imageUrl = (
          await bakeCreativeAsset({
            creativeUrl: imageUrl,
            origin: request.origin,
            ownerId: request.ownerId,
            expectedAspect: '1:1',
            persistToStorage: request.persistToStorage,
          })
        ).url;
        cards.push({
          image_url: imageUrl,
          headline: cardHeadline,
          description: subline,
          scene_url: scene.url,
        });
      }
      ads.push({
        campaign_input_id: request.campaignInputId,
        variant_number: variant,
        copy_text: direction.primaryText,
        image_url: cards[0]?.image_url || '',
        status: 'pending',
        ad_format: 'carousel',
        headline: direction.headline,
        angle: `concept-carousel:${direction.conceptId}`,
        media_payload: {
          placement: META_AD_FORMATS.carousel.placement,
          aspect: '1:1',
          cards,
          product_id: request.truth.productId,
          product_name: request.truth.productName,
          primary_packshot: productImage,
          scene_url: cards[0]?.scene_url,
          template: direction.name,
          concept_id: direction.conceptId,
        },
      });
    }

    if (directionFormats.includes('video')) {
      variant += 1;
      const scenePlan = buildVideoScenePlan(direction);
      const frames = [];
      for (const [sceneIndex, sceneDef] of scenePlan.scenes.entries()) {
        globalSceneIndex += 1;
        const scene = await renderScene({
          truth: request.truth,
          direction: { ...direction, angle: sceneDef.angle || direction.angle },
          aspect: '9:16',
          seed: sceneSeed(direction.conceptId, globalSceneIndex, sceneIndex + 11),
          sceneVariant: globalSceneIndex + sceneIndex * 2 + directionIndex,
          userId: request.ownerId,
          pattern: matchedPattern,
        });
        let imageUrl = buildCreativeUrl({
          brand: request.truth.brandName,
          headline: sceneDef.headline || direction.headline,
          subline,
          angle: sceneDef.angle || direction.angle,
          cta: direction.cta,
          badge: sceneDef.purpose.toUpperCase(),
          productImage,
          sceneImage: scene.url,
          format: 'story_9x16',
          adFormat: 'video',
          variant: variant * 10 + sceneIndex,
          template: direction.name,
        });
        imageUrl = (
          await bakeCreativeAsset({
            creativeUrl: imageUrl,
            origin: request.origin,
            ownerId: request.ownerId,
            expectedAspect: '9:16',
            persistToStorage: request.persistToStorage,
          })
        ).url;
        frames.push({
          image_url: imageUrl,
          headline: sceneDef.headline || direction.headline,
          duration_ms: Math.round((sceneDef.end - sceneDef.start) * 1000),
          scene_url: scene.url,
        });
      }

      const video = await generateVideoWithProviders({
        images: frames.map((frame) => ({
          url: frame.image_url,
          headline: frame.headline,
          durationMs: frame.duration_ms,
        })),
        aspect: '9:16',
        durationSeconds: scenePlan.duration,
        scenePlan,
        publicOrigin: request.origin,
        filenamePrefix: `${request.truth.brandName}-${request.truth.productName}`,
        userId: request.ownerId,
      });

      ads.push({
        campaign_input_id: request.campaignInputId,
        variant_number: variant,
        copy_text: direction.primaryText,
        image_url: frames[0]?.image_url || '',
        status: 'pending',
        ad_format: 'video',
        headline: direction.headline,
        angle: `concept-video:${direction.conceptId}`,
        media_payload: {
          placement: META_AD_FORMATS.video.placement,
          aspect: '9:16',
          frames,
          video_url: video?.url || null,
          poster_url: frames[0]?.image_url || null,
          duration_ms: scenePlan.duration * 1000,
          video_style: 'ugc-motion',
          product_id: request.truth.productId,
          product_name: request.truth.productName,
          primary_packshot: productImage,
          scene_url: frames[0]?.scene_url,
          template: direction.name,
          concept_id: direction.conceptId,
          scene_plan: scenePlan,
        },
      });
    }

    await updateGenerationJob(job.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      result_assets: { adsCreated: ads.filter((ad) => ad.angle.includes(direction.conceptId)).length },
    });
  }

  return { ads: deduplicatePackAds(ads), jobs };
}
