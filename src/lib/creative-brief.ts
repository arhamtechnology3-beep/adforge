import type { MetaAdLibraryAd } from '@/lib/ai';

export type CreativeBrief = {
  /** Emotional tone: premium, festive, rustic, urgent, etc. */
  mood: string;
  /** What we're beating the competitor on */
  counterHook: string;
  /** Layout direction inspired by competitor format */
  layoutStyle: 'hero-product' | 'lifestyle-table' | 'offer-banner' | 'recipe-story' | 'variety-grid';
  /** Color direction for scene generation */
  colorDirection: string;
  /** Full prompt for image APIs (FLUX, Photoroom, DALL·E) */
  scenePrompt: string;
  /** Short scene for 9:16 Stories */
  storyPrompt: string;
};

type BriefInput = {
  brand: string;
  category: string;
  competitorAd: Pick<
    MetaAdLibraryAd,
    'headline' | 'primary_text' | 'cta' | 'ad_format' | 'performance_rating' | 'performance_label'
  >;
  productName?: string | null;
};

function detectLayout(headline: string, body: string): CreativeBrief['layoutStyle'] {
  const t = `${headline} ${body}`.toLowerCase();
  if (/\d+\s*(jar|pickle|variant|flavour|flavor)/i.test(t) || /variety|combo|box|pack/i.test(t)) {
    return 'variety-grid';
  }
  if (/recipe|fusion|idea|thali|pair/i.test(t)) return 'recipe-story';
  if (/₹|rs\.?|off|save|deal|offer|%/i.test(t)) return 'offer-banner';
  if (/handmade|didi|rural|traditional|ghar|nani|authentic/i.test(t)) return 'lifestyle-table';
  return 'hero-product';
}

function detectMood(headline: string, body: string): string {
  const t = `${headline} ${body}`.toLowerCase();
  if (/festive|diwali|celebration|thali/i.test(t)) return 'warm festive celebration';
  if (/natural|preservative|chemical|clean|organic/i.test(t)) return 'fresh natural artisan';
  if (/urgent|limited|restock|fast/i.test(t)) return 'high-contrast urgency';
  if (/recipe|fusion/i.test(t)) return 'modern kitchen lifestyle';
  return 'premium Indian D2C food studio';
}

function detectColorDirection(mood: string, layout: CreativeBrief['layoutStyle']): string {
  if (layout === 'offer-banner')
    return 'bold saffron-orange and deep maroon accents on warm cream background';
  if (layout === 'recipe-story') return 'soft morning light, white marble, fresh herbs, orange zest accents';
  if (layout === 'lifestyle-table')
    return 'rustic terracotta, sun-drenched wood, brass thali, warm orange marigold tones';
  if (layout === 'variety-grid')
    return 'clean white studio with warm orange accent lighting and colorful prop pops';
  if (/festive/.test(mood)) return 'marigold gold, saffron orange, deep red, warm amber glow';
  return 'muted earth tones with warm orange accent spotlight and premium studio lighting';
}

function buildCounterHook(
  headline: string,
  body: string,
  rating?: MetaAdLibraryAd['performance_rating']
): string {
  const t = `${headline} ${body}`.toLowerCase();
  if (/variety|8\s*jar/i.test(t)) {
    return 'Out-show variety with a cleaner hero shot and clearer bundle value';
  }
  if (/recipe|fusion/i.test(t)) {
    return 'Beat recipe-led ads with a more appetizing close-up and premium plating';
  }
  if (/handmade|didi|rural/i.test(t)) {
    return 'Match founder story but elevate with sharper product focus and trust badges';
  }
  if (/₹|off|save/i.test(t)) {
    return 'Match offer energy with bolder typography zone and product-forward layout';
  }
  if (rating === 'WINNER') {
    return 'Winner ad — replicate hook strength but upgrade visual polish and brand clarity';
  }
  return 'Elevate with agency-grade lighting, depth, and clearer product hero';
}

/**
 * Agency-style creative brief from a selected competitor Library ad.
 * Drives scene prompts for image APIs and layout decisions.
 */
export function buildCreativeBrief(input: BriefInput): CreativeBrief {
  const headline = input.competitorAd.headline || '';
  const body = input.competitorAd.primary_text || '';
  const category = input.category || 'Indian food product';
  const product = input.productName || category;

  const layoutStyle = detectLayout(headline, body);
  const mood = detectMood(headline, body);
  const colorDirection = detectColorDirection(mood, layoutStyle);
  const counterHook = buildCounterHook(headline, body, input.competitorAd.performance_rating);
  const isFood = /food|pickle|snack|spice|grocery|beverage|drink/i.test(category);

  const layoutScene: Record<CreativeBrief['layoutStyle'], string> = {
    'hero-product':
      'warm orange-accent studio backdrop with wooden pedestal, empty center for product placement, soft spotlight',
    'lifestyle-table':
      isFood
        ? 'rustic Indian kitchen table with tasteful serving props and warm daylight — no product or packaging in scene'
        : 'premium Indian home lifestyle setting with relevant neutral props and warm daylight — no product or packaging in scene',
    'offer-banner':
      'dynamic commercial background with saffron-orange gradient accents and negative space for offer text overlay',
    'recipe-story':
      isFood
        ? 'modern kitchen counter with category-relevant ingredients and warm accent props — empty space for product compositing'
        : 'clean lifestyle environment with category-relevant props and negative space for product compositing',
    'variety-grid':
      'clean white studio with warm accent lighting — empty pedestals for product placement, no products or packaging drawn',
  };

  const scenePrompt = [
    `Professional Meta ad background for ${input.brand}, ${category}.`,
    layoutScene[layoutStyle] + '.',
    `${mood}, ${colorDirection}.`,
    'Photorealistic Indian D2C ecommerce quality background only.',
    'Soft studio lighting, subtle shadows. No product, no jar, no packaging, no text, no watermark.',
    '8k commercial advertising backdrop, square composition.',
  ].join(' ');

  const storyPrompt = [
    `Vertical 9:16 Meta Stories background for ${input.brand} ${product}.`,
    layoutScene[layoutStyle] + '.',
    `${mood}, ${colorDirection}.`,
    'Full-bleed lifestyle advertising backdrop, thumb-stopping, cinematic depth.',
    'Leave lower third clear for text overlay. No product jar, no packaging, no text in image.',
  ].join(' ');

  return {
    mood,
    counterHook,
    layoutStyle,
    colorDirection,
    scenePrompt,
    storyPrompt,
  };
}
