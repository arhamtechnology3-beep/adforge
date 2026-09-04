import type { CompetitorPattern, CreativeAspect, CreativeDirection, ProductTruthSheet } from './types';
import type { MetaAdPromptPreset, MetaAdPromptPresetId } from './meta-ad-prompt-library.types';
import {
  clearMetaAdPromptLibraryCache,
  loadMetaAdPromptLibraryFromMarkdown,
} from './meta-ad-prompt-md-parser';

export { clearMetaAdPromptLibraryCache } from './meta-ad-prompt-md-parser';

export type { MetaAdPromptPreset, MetaAdPromptPresetId } from './meta-ad-prompt-library.types';

/** Embedded fallback when MD file is missing (dev/build safety) */
const FALLBACK_PRESETS: MetaAdPromptPreset[] = [
  {
    id: 'premium-luxury-studio',
    name: 'Premium Luxury Studio',
    bestFor: 'Premium products, electronics, fashion accessories, beauty, lifestyle products',
    purpose: 'Premium positioning',
    prompt:
      'Create a premium high-end commercial advertisement using the uploaded product image as the exact product reference. Place the original product as the hero subject in a sophisticated luxury studio environment.',
  },
  {
    id: 'natural-lifestyle',
    name: 'Natural Lifestyle Environment',
    bestFor: 'Home products, food, wellness, beauty, kitchen, furniture, lifestyle products',
    purpose: 'Trust + aspiration',
    prompt:
      'Create a premium lifestyle advertisement using the uploaded product as the exact hero product. Place the original product naturally inside a beautiful modern lifestyle environment that matches its category.',
  },
  {
    id: 'bold-scroll-stopper',
    name: 'Bold Scroll-Stopping Facebook Ad',
    bestFor: 'Products where maximum attention in the social feed is the priority',
    purpose: 'Attention',
    prompt:
      'Create a high-impact Facebook and Instagram advertising creative using the uploaded product image as the exact hero product. Design the scene specifically to stop users while scrolling through a social media feed.',
  },
  {
    id: 'sunlight-premium-home',
    name: 'Sunlight + Premium Home',
    bestFor: 'Products that belong in homes',
    purpose: 'Lifestyle',
    prompt:
      'Create a photorealistic premium home lifestyle advertisement using the uploaded product as the exact hero product. Place the original product inside a beautiful contemporary home with sophisticated interior design.',
  },
  {
    id: 'minimal-clean',
    name: 'Minimal Clean Product Ad',
    bestFor: 'Modern products, technology, cosmetics, premium accessories',
    purpose: 'Product clarity',
    prompt:
      'Create an ultra-clean premium product advertisement using the uploaded product image as the exact product reference. Place the original product against a sophisticated minimalist environment.',
  },
  {
    id: 'dark-cinematic',
    name: 'Dark Cinematic Premium',
    bestFor: 'Electronics, automotive products, watches, luxury products, premium gadgets',
    purpose: 'Luxury',
    prompt:
      'Create a dramatic cinematic commercial advertisement using the uploaded product as the exact hero product. Place the product inside a dark premium environment with sophisticated architectural surfaces.',
  },
  {
    id: 'soft-beauty',
    name: 'Soft Beauty / Instagram Aesthetic',
    bestFor: 'Cosmetics, skincare, jewelry, fashion, beauty, lifestyle',
    purpose: 'Instagram appeal',
    prompt:
      'Create a sophisticated Instagram and Facebook lifestyle advertisement using the uploaded product as the exact hero product. Build an elegant aesthetic environment using soft natural textures and subtle pastel tones.',
  },
  {
    id: 'fresh-clean',
    name: 'Fresh / Clean / Refreshing',
    bestFor: 'Food, beverages, skincare, wellness, cleaning products, water-related products',
    purpose: 'Emotional association',
    prompt:
      'Create a fresh, clean and visually refreshing Facebook advertisement using the uploaded product as the exact hero product. Place the original product in a premium bright environment inspired by freshness and cleanliness.',
  },
  {
    id: 'modern-urban',
    name: 'Modern Urban / Premium Brand',
    bestFor: 'Tech, fashion, accessories, lifestyle products',
    purpose: 'Modern branding',
    prompt:
      'Create a premium modern urban advertisement using the uploaded product as the exact hero product. Place the product in a sophisticated contemporary urban environment.',
  },
  {
    id: 'problem-solution',
    name: 'Problem → Solution Visual',
    bestFor: 'Performance marketing and conversion-focused campaigns',
    purpose: 'Conversion',
    prompt:
      'Create a high-converting Facebook advertisement using the uploaded product as the exact hero product. Create a visually compelling environment that communicates the product primary benefit without changing the product itself.',
  },
  {
    id: 'premium-ugc',
    name: 'Premium UGC Style',
    bestFor: 'Social-feed-native ads and products that benefit from an authentic feel',
    purpose: 'Native social feel',
    prompt:
      'Create a realistic premium social-media advertisement using the uploaded product as the exact hero product. Make the image feel like an authentic high-quality lifestyle photograph captured for a modern social media brand.',
  },
];

const FALLBACK_MASTER_NEGATIVE = [
  'IMPORTANT PRODUCT PRESERVATION: Use the uploaded reference product as absolute source of truth.',
  'Do NOT modify, redesign, reinterpret, regenerate, stylize, reshape, or alter the actual product.',
  'Preserve exact product shape, proportions, logo, brand name, packaging, and all printed elements.',
  'ONLY modify: background, environment, lighting, shadows, reflections, surrounding props, atmosphere, depth of field.',
  'No product hallucination, no logo hallucination, no duplicate product, no watermark.',
].join(' ');

export type MetaAdPromptLibrarySnapshot = {
  presets: MetaAdPromptPreset[];
  presetById: Record<string, MetaAdPromptPreset>;
  masterProductProtectionNegative: string;
  source: 'markdown' | 'fallback';
  sourcePath?: string;
};

function snapshotFromPresets(
  presets: MetaAdPromptPreset[],
  masterProductProtectionNegative: string,
  source: 'markdown' | 'fallback',
  sourcePath?: string
): MetaAdPromptLibrarySnapshot {
  const presetById = Object.fromEntries(presets.map((preset) => [preset.id, preset])) as Record<
    string,
    MetaAdPromptPreset
  >;
  return { presets, presetById, masterProductProtectionNegative, source, sourcePath };
}

/** Load prompt library from docs/facebook_meta_product_ad_prompts.md (cached by mtime) */
export function getMetaAdPromptLibrary(): MetaAdPromptLibrarySnapshot {
  const loaded = loadMetaAdPromptLibraryFromMarkdown();
  if (loaded && loaded.presets.length > 0) {
    return snapshotFromPresets(
      loaded.presets as MetaAdPromptPreset[],
      loaded.masterProductProtectionNegative || FALLBACK_MASTER_NEGATIVE,
      'markdown',
      loaded.sourcePath
    );
  }
  return snapshotFromPresets(FALLBACK_PRESETS, FALLBACK_MASTER_NEGATIVE, 'fallback');
}

export function reloadMetaAdPromptLibrary(): MetaAdPromptLibrarySnapshot {
  clearMetaAdPromptLibraryCache();
  return getMetaAdPromptLibrary();
}

/** @deprecated Use getMetaAdPromptLibrary().presets — kept for tests/imports */
export function getMetaAdPromptPresets(): MetaAdPromptPreset[] {
  return getMetaAdPromptLibrary().presets;
}

export const META_AD_PROMPT_PRESETS = getMetaAdPromptPresets();

export function getMasterProductProtectionNegative(): string {
  return getMetaAdPromptLibrary().masterProductProtectionNegative;
}

/** @deprecated Use getMasterProductProtectionNegative() */
export const MASTER_PRODUCT_PROTECTION_NEGATIVE = getMasterProductProtectionNegative();

const BACKGROUND_ONLY_PREFIX = [
  'BACKGROUND AND ENVIRONMENT ONLY for Meta ad compositing.',
  'Do NOT draw, generate, or invent any product, jar, bottle, packaging, logo, or label in the scene.',
  'Leave a clear unobstructed center zone (40–55% of frame) completely empty for product placement.',
  'The center zone must be plain surface, soft bokeh, or gradient — never a product silhouette.',
  'Real packshot will be composited afterward — generate ONLY the environment, lighting, and props.',
].join('\n');

const FOOD_CATEGORY = /food|pickle|snack|spice|grocery|beverage|drink|condiment|sauce|jam|achar|athana|masala|tea|coffee/i;
const BEAUTY_CATEGORY = /beauty|cosmetic|skincare|jewelry|fashion|makeup|fragrance/i;
const TECH_CATEGORY = /tech|electronic|gadget|device|watch|automotive|software/i;
const HOME_CATEGORY = /home|kitchen|furniture|decor|appliance|wellness|cleaning/i;

const ANGLE_PRESET_PRIORITY: Record<string, MetaAdPromptPresetId[]> = {
  'premium-hero': ['premium-luxury-studio', 'minimal-clean', 'dark-cinematic'],
  'lifestyle-home': ['sunlight-premium-home', 'natural-lifestyle', 'premium-ugc'],
  'food-desire': ['fresh-clean', 'natural-lifestyle', 'sunlight-premium-home'],
  'emotional-nostalgia': ['sunlight-premium-home', 'natural-lifestyle', 'premium-luxury-studio'],
  'recipe-lifestyle': ['natural-lifestyle', 'sunlight-premium-home', 'fresh-clean'],
  'offer-led': ['bold-scroll-stopper', 'problem-solution', 'minimal-clean'],
  'benefit-led': ['problem-solution', 'fresh-clean', 'minimal-clean'],
  'trending-ugc': ['premium-ugc', 'natural-lifestyle', 'sunlight-premium-home'],
  'unboxing-pov': ['premium-ugc', 'natural-lifestyle', 'bold-scroll-stopper'],
  'social-proof': ['premium-luxury-studio', 'minimal-clean', 'problem-solution'],
};

function categoryPresetPool(category: string, allPresets: MetaAdPromptPreset[]): MetaAdPromptPresetId[] {
  if (FOOD_CATEGORY.test(category)) {
    return [
      'fresh-clean',
      'natural-lifestyle',
      'sunlight-premium-home',
      'bold-scroll-stopper',
      'premium-luxury-studio',
      'problem-solution',
      'premium-ugc',
      'minimal-clean',
      'soft-beauty',
      'modern-urban',
      'dark-cinematic',
    ];
  }
  if (BEAUTY_CATEGORY.test(category)) {
    return ['soft-beauty', 'minimal-clean', 'premium-luxury-studio', 'natural-lifestyle', 'premium-ugc'];
  }
  if (TECH_CATEGORY.test(category)) {
    return ['dark-cinematic', 'minimal-clean', 'modern-urban', 'premium-luxury-studio', 'bold-scroll-stopper'];
  }
  if (HOME_CATEGORY.test(category)) {
    return ['sunlight-premium-home', 'natural-lifestyle', 'minimal-clean', 'premium-ugc', 'fresh-clean'];
  }
  return allPresets.map((preset) => preset.id);
}

function patternPresetHint(pattern?: CompetitorPattern): MetaAdPromptPresetId | null {
  if (!pattern) return null;
  if (/offer|performance|variety|bundle/i.test(pattern.marketingAngle)) return 'bold-scroll-stopper';
  if (/recipe|use-case/i.test(pattern.marketingAngle)) return 'natural-lifestyle';
  if (/heritage|authentic/i.test(pattern.marketingAngle)) return 'sunlight-premium-home';
  if (/clean|natural/i.test(pattern.marketingAngle)) return 'fresh-clean';
  if (pattern.visualStrategy === 'Motion-led social proof') return 'premium-ugc';
  if (pattern.compositionPattern === 'Founder / kitchen table') return 'sunlight-premium-home';
  if (pattern.compositionPattern === 'Lifestyle + ingredients') return 'natural-lifestyle';
  return null;
}

export function selectMetaAdPromptPreset(input: {
  category: string;
  direction: CreativeDirection;
  sceneVariant?: number;
  pattern?: CompetitorPattern;
}): MetaAdPromptPreset {
  const library = getMetaAdPromptLibrary();
  const variant = input.sceneVariant ?? 0;
  const anglePool = ANGLE_PRESET_PRIORITY[input.direction.angle] || [];
  const categoryPool = categoryPresetPool(input.category, library.presets);
  const patternHint = patternPresetHint(input.pattern);

  const merged: MetaAdPromptPresetId[] = [];
  if (patternHint) merged.push(patternHint);
  for (const id of anglePool) if (!merged.includes(id)) merged.push(id);
  for (const id of categoryPool) if (!merged.includes(id)) merged.push(id);
  for (const preset of library.presets) if (!merged.includes(preset.id)) merged.push(preset.id);

  const selectedId = merged[variant % merged.length];
  return library.presetById[selectedId] || library.presets[0];
}

const FORMAT_SCENE_HINT: Record<CreativeAspect, string> = {
  '1:1':
    'Square 1:1 Meta Feed composition. Product placement zone in center-lower third. Top third reserved for headline/badge overlay.',
  '4:5':
    'Vertical 4:5 Meta Feed composition. Product in center, generous top and bottom negative space for ad copy.',
  '9:16':
    'Vertical 9:16 Stories/Reels composition. Product in upper-center, bottom third clear for CTA button overlay.',
};

/**
 * MD file prompts assume full product-in-scene generation.
 * AdForge compositing needs environment-only — strip product instructions
 * so AI does not draw jars/products that fail scene-purity and fall back to local SVG.
 */
export function adaptMdPromptForBackgroundOnly(raw: string): string {
  const stripped = raw
    .replace(/using the uploaded product image as the exact product reference\.?/gi, '')
    .replace(/using the uploaded product as the exact hero product\.?/gi, '')
    .replace(/Place the original product[^.\n]+[.\n]/gi, '')
    .replace(/Place the product[^.\n]+[.\n]/gi, '')
    .replace(/The product should be[^.\n]+[.\n]/gi, '')
    .replace(/The original product must remain[^.\n]+[.\n]/gi, '')
    .replace(/Make the product visually dominant[^.\n]+[.\n]/gi, '')
    .replace(/product remains the primary focus[^.\n]+[.\n]/gi, '')
    .replace(/product placed prominently[^.\n]+[.\n]/gi, '')
    .replace(/hero product in foreground[^.\n]+[.\n]/gi, '')
    .replace(/Keep the product in the foreground[^.\n]+[.\n]/gi, '')
    .replace(/The product must remain[^.\n]+[.\n]/gi, '')
    .replace(/product must remain[^.\n]+[.\n]/gi, '')
    .replace(/product occupying approximately[^.\n]+[.\n]/gi, '')
    .replace(/product as the visual hero[^.\n]+[.\n]/gi, '')
    .replace(/without changing the product itself\.?/gi, '')
    .replace(/identical to the reference[^.\n]+[.\n]/gi, '')
    .split('\n')
    .filter((line) => !/\b(product|jar|bottle|packaging|uploaded|hero product|reference image)\b/i.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return stripped;
}

export function buildMetaAdLibraryPrompt(input: {
  truth: ProductTruthSheet;
  direction: CreativeDirection;
  category: string;
  aspect?: CreativeAspect;
  sceneVariant?: number;
  pattern?: CompetitorPattern;
}): { prompt: string; preset: MetaAdPromptPreset; source: 'markdown' | 'fallback' } {
  const aspect = input.aspect || '1:1';
  const library = getMetaAdPromptLibrary();
  const preset = selectMetaAdPromptPreset({
    category: input.category,
    direction: input.direction,
    sceneVariant: input.sceneVariant,
    pattern: input.pattern,
  });

  const colorHint = input.direction.colorDirection
    ? `Color palette: ${input.direction.colorDirection}.`
    : '';
  const layoutHint = input.direction.layoutStyle
    ? `Layout inspiration from Meta Ad Library: ${input.direction.layoutStyle}.`
    : '';

  const adaptedPresetPrompt = adaptMdPromptForBackgroundOnly(preset.prompt);

  const prompt = [
    BACKGROUND_ONLY_PREFIX,
    '',
    `CREATIVE PRESET: ${preset.name} (${preset.purpose})`,
    `Best for: ${preset.bestFor}`,
    '',
    adaptedPresetPrompt,
    '',
    `Product category: ${input.category}. Brand mood: ${input.truth.brandName}.`,
    `Creative direction: ${input.direction.name}. Marketing angle: ${input.direction.angle}.`,
    input.direction.visualStory ? `Visual story: ${input.direction.visualStory}` : '',
    colorHint,
    layoutHint,
    FORMAT_SCENE_HINT[aspect],
    'Competitor creative is strategic reference only — never copy its exact composition or branding.',
    'CRITICAL: Generate ONLY an empty environment/backdrop. NO products, jars, bottles, packaging, logos, or objects in the center 50% of the frame.',
    'Output: photorealistic premium Meta ad background, crisp, sharp, attractive, trend-forward.',
  ]
    .filter(Boolean)
    .join('\n');

  return { prompt, preset, source: library.source };
}

export function buildMetaAdLibraryNegativePrompt(truth: ProductTruthSheet, extra = ''): string {
  return [
    getMasterProductProtectionNegative(),
    'Do not generate any product, jar, bottle, packaging, or logo in the scene.',
    'Do not generate text, watermarks, or UI elements in the scene.',
    'No cartoon, illustration, or painterly art style.',
    'No identical dark vignette studio for every frame — vary lighting and palette.',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}
