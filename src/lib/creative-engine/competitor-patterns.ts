import type { MetaAdLibraryAd } from '@/lib/ai';
import type { CompetitorPattern } from './types';

function firstMatch(text: string, patterns: RegExp[], fallback: string): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0].trim();
  }
  return fallback;
}

export function extractCompetitorPattern(
  ad: Pick<
    MetaAdLibraryAd,
    'id' | 'library_id' | 'headline' | 'primary_text' | 'cta' | 'ad_format'
  > & { brand?: string | null }
): CompetitorPattern {
  const text = `${ad.headline || ''} ${ad.primary_text || ''}`.trim();
  const lower = text.toLowerCase();

  const hook = firstMatch(
    text,
    [/[^.!?]{8,80}[!?.]?/],
    ad.headline || 'Discover the product'
  );

  const marketingAngle = /variety|combo|pack|bundle|jar/i.test(lower)
    ? 'Variety + bundle value'
    : /recipe|fusion|idea|thali/i.test(lower)
      ? 'Recipe / use-case inspiration'
      : /₹|rs\.?|off|save|deal|offer|%/i.test(lower)
        ? 'Offer / performance'
        : /handmade|didi|authentic|traditional|ghar/i.test(lower)
          ? 'Heritage / authenticity'
          : /natural|preservative|chemical|clean/i.test(lower)
            ? 'Clean / natural proof'
            : 'Premium product hero';

  const emotionalTrigger = /festive|celebration|family/i.test(lower)
    ? 'Celebration'
    : /trust|authentic|homemade/i.test(lower)
      ? 'Trust'
      : /urgent|limited|fast|restock/i.test(lower)
        ? 'Urgency'
        : /love|favorite|obsessed/i.test(lower)
          ? 'Desire'
          : 'Confidence';

  const offerMechanism = /₹\s*\d+|rs\.?\s*\d+|\d+\s*%\s*off|\d+\s*for/i.test(lower)
    ? 'Price-led offer'
    : /free shipping|cod|cash on delivery/i.test(lower)
      ? 'Friction removal'
      : 'Value framing';

  const audience = /family|mom|mother|kitchen|home/i.test(lower)
    ? 'Home cooks and families'
    : /gift|festive|celebration/i.test(lower)
      ? 'Gift buyers'
      : 'Online shoppers';

  const visualStrategy =
    ad.ad_format === 'video'
      ? 'Motion-led social proof'
      : ad.ad_format === 'carousel'
        ? 'Multi-card storytelling'
        : /offer|₹|%/i.test(lower)
          ? 'Bold offer banner'
          : 'Product-forward hero';

  const compositionPattern = /recipe|fusion/i.test(lower)
    ? 'Lifestyle + ingredients'
    : /variety|combo|jar/i.test(lower)
      ? 'Variety grid'
      : /handmade|didi/i.test(lower)
        ? 'Founder / kitchen table'
        : 'Centered hero product';

  const productPositioning = /premium|luxury|artisan/i.test(lower)
    ? 'Premium artisan'
    : /value|deal|offer/i.test(lower)
      ? 'Value leader'
      : 'Everyday trusted staple';

  const ctaStrategy = (ad.cta || 'SHOP_NOW').replace(/_/g, ' ');

  const videoHook =
    ad.ad_format === 'video'
      ? firstMatch(text, [/why i|not gonna lie|okay but|finally/i], hook)
      : hook;

  const sceneSequence =
    ad.ad_format === 'video'
      ? ['hook', 'problem', 'productReveal', 'usage', 'cta']
      : ad.ad_format === 'carousel'
        ? ['hero', 'benefit', 'offer']
        : ['hero'];

  return {
    sourceId: ad.library_id || ad.id,
    hook,
    marketingAngle,
    emotionalTrigger,
    offerMechanism,
    audience,
    visualStrategy,
    compositionPattern,
    productPositioning,
    ctaStrategy,
    videoHook,
    sceneSequence,
  };
}

export function extractCompetitorPatterns(
  ads: Array<
    Pick<
      MetaAdLibraryAd,
      'id' | 'library_id' | 'headline' | 'primary_text' | 'cta' | 'ad_format'
    > & { brand?: string | null }
  >
): CompetitorPattern[] {
  return ads.map(extractCompetitorPattern);
}

/** Map extracted library pattern → creative engine angle slug */
export function patternToAngle(pattern: CompetitorPattern): string {
  const angle = pattern.marketingAngle.toLowerCase();
  if (/variety|bundle/.test(angle)) return 'offer-led';
  if (/recipe|use-case/.test(angle)) return 'recipe-lifestyle';
  if (/offer|performance/.test(angle)) return 'offer-led';
  if (/heritage|authentic/.test(angle)) return 'emotional-nostalgia';
  if (/clean|natural/.test(angle)) return 'benefit-led';
  if (/premium/.test(angle)) return 'premium-hero';
  if (pattern.visualStrategy === 'Motion-led social proof') return 'trending-ugc';
  if (pattern.visualStrategy === 'Multi-card storytelling') return 'lifestyle-home';
  if (pattern.visualStrategy === 'Bold offer banner') return 'offer-led';
  return 'premium-hero';
}

/** Human-readable direction name from library analysis */
export function patternToDirectionName(pattern: CompetitorPattern): string {
  const composition = pattern.compositionPattern;
  if (composition === 'Variety grid') return 'Variety / Bundle Value';
  if (composition === 'Lifestyle + ingredients') return 'Recipe & Use Case';
  if (composition === 'Founder / kitchen table') return 'Heritage Kitchen Story';
  if (pattern.visualStrategy === 'Bold offer banner') return 'Offer / Performance';
  if (pattern.emotionalTrigger === 'Trust') return 'Trust & Authenticity';
  if (pattern.emotionalTrigger === 'Urgency') return 'Urgency / Offer';
  return pattern.marketingAngle.slice(0, 40);
}

/** Distinct scene environment from library composition — avoids same dark studio for every ad */
export function environmentFromPattern(
  pattern: CompetitorPattern,
  sceneVariant = 0
): string {
  const variants: Record<string, string[]> = {
    'Centered hero product': [
      'Premium white cyclorama with warm orange accent spotlight and polished stone pedestal — bright, crisp, high-end D2C food photography.',
      'Light-filled modern kitchen with marble counter, soft window bokeh, minimal brass props in background.',
      'Clean studio shelf with muted earth tones and directional side-light — product zone on neutral pedestal.',
    ],
    'Lifestyle + ingredients': [
      'Active Indian kitchen: fresh mango chunks, spices, and brass utensils in soft focus — warm morning light on wooden counter.',
      'Family thali spread on rustic wooden table, steam and warmth, herbs and condiments at frame edges only.',
      'Modern cooking counter with cutting board, fresh ingredients artfully arranged at corners — inviting recipe context.',
    ],
    'Variety grid': [
      'Clean white studio with warm accent lighting and multiple empty pedestals — colorful prop pops, bundle-value feel.',
      'Retail-style display shelf with energetic saffron-orange accent blocks and promotional negative space.',
      'Bright ecommerce studio with gradient cream-to-orange backdrop and crisp commercial lighting.',
    ],
    'Founder / kitchen table': [
      'Authentic home kitchen table with terracotta tones, handwoven textile blur, sun-drenched wood surfaces.',
      'Heritage village-kitchen mood with warm amber light, brass thali props, nostalgic but premium.',
      'Founder-style kitchen table with natural daylight, lived-in but tidy, trust-building authenticity.',
    ],
  };
  const pool =
    variants[pattern.compositionPattern] || variants['Centered hero product'];
  return pool[sceneVariant % pool.length];
}
