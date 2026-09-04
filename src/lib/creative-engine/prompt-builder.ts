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
