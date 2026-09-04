/**
 * Scene image generation — Arham Cloudflare Worker API only.
 */

import type { CreativeBrief } from '@/lib/creative-brief';
import { productSceneUrl } from '@/lib/creatives';
import { generateArhamImage } from '@/lib/arham-image-api';

export type SceneGenerateInput = {
  brief: CreativeBrief;
  category: string;
  angle: string;
  seed: number;
  aspect: '1:1' | '9:16';
  productImageUrl?: string | null;
  brand?: string;
  headline?: string;
};

export type SceneGenerateResult = {
  url: string;
  provider: 'arham' | 'local';
  /** When true, use URL as final creative (skip Satori text overlay) */
  isFinalCreative?: boolean;
};

/** Generate a scene/background URL via Arham image worker only */
export async function generateSceneImage(
  input: SceneGenerateInput
): Promise<SceneGenerateResult> {
  const basePrompt =
    input.aspect === '9:16' ? input.brief.storyPrompt : input.brief.scenePrompt;
  const variation =
    input.angle === 'unboxing-pov'
      ? 'UGC-style handheld home setting, authentic creator perspective, casual natural light.'
      : input.angle === 'trending-ugc'
        ? 'Social-first creator review setting, energetic composition, candid lifestyle props.'
        : input.angle === 'benefit-led'
          ? 'Clean benefit demonstration setting with relevant ingredients or materials around an empty product zone.'
          : input.angle === 'offer-led'
            ? 'Bold retail offer setting with energetic color blocks and clear negative space.'
            : 'Distinct premium campaign variation with a new composition and props.';
  const prompt = `${basePrompt} ${variation}`;

  const arham = await generateArhamImage({
    prompt,
    aspect: input.aspect,
  });
  if (arham?.url) {
    return {
      url: arham.url,
      provider: 'arham',
      isFinalCreative: false,
    };
  }

  return {
    url: productSceneUrl(input.category, input.angle, input.seed, input.aspect),
    provider: 'local',
    isFinalCreative: false,
  };
}
