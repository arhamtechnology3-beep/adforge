/**
 * Prompt guardrails so AI scenes keep the real product packshot intact.
 * Background/scene is generated separately; Satori composites the actual product image.
 */

/** Warm orange brand accent — background/props only, never on product label */
export const BRAND_ORANGE_ACCENT =
  'warm saffron-orange accent lighting (#E85D04) in background, marigold garland props, terracotta bowl accents — orange must NOT appear on product packaging or label';

export const PRODUCT_NEGATIVE_PROMPT = [
  'altered product packaging',
  'wrong logo',
  'fake brand name',
  'distorted jar shape',
  'changed label colors',
  'blurry label text',
  'cartoon product',
  'illustrated product',
  '3d render product',
  'different cap color',
  'wrong typography on label',
  'rewritten label text',
  'misspelled brand logo',
  'duplicate jars',
  'extra product copies',
  'misshapen bottle',
  'invented product',
  'unrelated product',
  'recolored packaging',
  'generic pickle jar',
  'hands covering product label',
  'cropped logo',
  'watermark',
  'text overlay',
  'misspelled text',
].join(', ');

export const GLOBAL_NEGATIVE_PROMPT = [
  'Do not alter the customer product.',
  'Do not change product color.',
  'Do not change product shape.',
  'Do not change product proportions.',
  'Do not change packaging.',
  'Do not change label.',
  'Do not change logo.',
  'Do not change printed text.',
  'Do not change cap or lid.',
  'Do not invent a different product.',
  'Do not generate fake packaging.',
  'Do not duplicate the product unless explicitly requested.',
  'Do not stretch or deform the product.',
  'Do not change brand identity.',
  'Do not invent certifications.',
  'Do not invent awards.',
  'Do not invent reviews.',
  'Do not invent unsupported product benefits.',
  'Do not make medical claims.',
  'Do not copy the competitor creative exactly.',
  'Do not copy competitor branding.',
  'Do not generate gibberish text.',
  'Do not generate malformed hands or fingers.',
  'Do not generate impossible physics.',
  'Do not create floating objects.',
  'Do not create incorrect perspective.',
  'Do not create unrealistic shadows.',
  'Do not add watermarks.',
  'Do not produce low-quality blurry assets.',
  PRODUCT_NEGATIVE_PROMPT,
].join(' ');

export const BACKGROUND_SCENE_SUFFIX = [
  'Background and environment only — leave clear center space for product compositing.',
  'Do NOT draw, generate, or invent any product, jar, bottle, box, pouch, garment, device, or packaging in the scene.',
  BRAND_ORANGE_ACCENT,
].join(' ');

export const PRODUCT_REFERENCE_POSITIVE = [
  'Preserve the exact product from the reference image: same jar shape, label colors, logo, cap, and brand typography.',
  'Only enhance lighting and scene around the product — never modify the product itself.',
].join(' ');

export type ScenePromptMode = 'background' | 'full';

export function buildGuardedScenePrompt(
  basePrompt: string,
  opts: { mode: ScenePromptMode; brand?: string; hasProductRef?: boolean }
): { prompt: string; negativePrompt: string } {
  const parts = [basePrompt];

  if (opts.mode === 'background') {
    parts.push(BACKGROUND_SCENE_SUFFIX);
  } else if (opts.hasProductRef) {
    parts.push(PRODUCT_REFERENCE_POSITIVE);
  }

  if (opts.brand && opts.mode !== 'background') {
    parts.push(`Brand context: ${opts.brand} — packaging must match reference exactly.`);
  }

  return {
    prompt: parts.filter(Boolean).join(' ').slice(0, 4000),
    negativePrompt: GLOBAL_NEGATIVE_PROMPT,
  };
}
