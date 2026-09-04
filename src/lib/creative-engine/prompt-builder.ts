import type { CompetitorPattern, CreativeAspect, CreativeDirection, ProductTruthSheet } from './types';
import { GLOBAL_NEGATIVE_PROMPT } from '@/lib/creative-product-guardrails';
import {
  buildMetaAdLibraryPrompt,
  buildMetaAdLibraryNegativePrompt,
  selectMetaAdPromptPreset,
} from './meta-ad-prompt-library';
import { productSpecificNegativePrompt } from './product-truth';

export {
  getMetaAdPromptLibrary,
  getMetaAdPromptPresets,
  getMasterProductProtectionNegative,
  reloadMetaAdPromptLibrary,
  clearMetaAdPromptLibraryCache,
} from './meta-ad-prompt-library';

const FORMAT_SCENE_HINT: Record<CreativeAspect, string> = {
  '1:1':
    'Square 1:1 Meta Feed composition. Product placement zone in center-lower third. Top third reserved for headline/badge overlay.',
  '4:5':
    'Vertical 4:5 Meta Feed composition. Product in center, generous top and bottom negative space for ad copy.',
  '9:16':
    'Vertical 9:16 Stories/Reels composition. Product in upper-center, bottom third clear for CTA button overlay.',
};

export function buildMasterImagePrompt(input: {
  truth: ProductTruthSheet;
  direction: CreativeDirection;
  category: string;
  aspect?: CreativeAspect;
  sceneVariant?: number;
  pattern?: CompetitorPattern;
}): string {
  const { prompt } = buildMetaAdLibraryPrompt(input);
  return prompt;
}

export function buildNegativePrompt(truth: ProductTruthSheet): string {
  return [
    buildMetaAdLibraryNegativePrompt(truth),
    GLOBAL_NEGATIVE_PROMPT,
    productSpecificNegativePrompt(truth),
    'Do not copy the competitor creative exactly.',
    'Do not copy competitor branding.',
    'No duplicate products.',
  ].join(' ');
}

export function angleVariationPrompt(angle: string, seed = 0): string {
  const preset = selectMetaAdPromptPreset({
    category: 'Products',
    direction: {
      conceptId: 'variation',
      name: 'Variation',
      angle,
      emotion: 'Confidence',
      hook: '',
      visualStory: '',
      headline: '',
      primaryText: '',
      cta: 'Shop Now',
      recommendedFormats: ['1:1'],
    },
    sceneVariant: seed,
  });
  return `${preset.name}: ${preset.prompt.split('\n')[0]}`;
}
