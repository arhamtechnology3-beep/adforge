import type { MetaAdLibraryAd } from '@/lib/ai';
import { buildCreativeBrief } from '@/lib/creative-brief';
import type { GroundedConcept } from '@/lib/grounded-copy';
import {
  environmentFromPattern,
  patternToAngle,
  patternToDirectionName,
} from './competitor-patterns';
import type { CompetitorPattern, CreativeDirection, ProductTruthSheet, UgcType } from './types';

const ANGLE_FORMATS: Record<string, Array<'1:1' | '4:5' | '9:16'>> = {
  'premium-hero': ['1:1', '4:5'],
  'lifestyle-home': ['1:1', '4:5', '9:16'],
  'trending-ugc': ['9:16'],
  'food-desire': ['1:1', '4:5'],
  'offer-led': ['1:1', '4:5'],
  'benefit-led': ['1:1', '9:16'],
  'recipe-lifestyle': ['1:1', '9:16'],
  'emotional-nostalgia': ['1:1', '4:5'],
  'social-proof': ['1:1', '4:5'],
  'unboxing-pov': ['9:16'],
};

const ANGLE_UGC: Record<string, UgcType | undefined> = {
  'trending-ugc': 'testimonial',
  'recipe-lifestyle': 'recipe',
  'unboxing-pov': 'unboxing',
};

const ANGLE_EMOTION: Record<string, string> = {
  'premium-hero': 'Trust',
  'lifestyle-home': 'Comfort',
  'trending-ugc': 'Authenticity',
  'food-desire': 'Craving',
  'offer-led': 'Urgency',
  'benefit-led': 'Relief',
  'recipe-lifestyle': 'Inspiration',
  'emotional-nostalgia': 'Nostalgia',
  'social-proof': 'Confidence',
  'unboxing-pov': 'Excitement',
};

function headlineFromPattern(
  truth: ProductTruthSheet,
  pattern: CompetitorPattern,
  grounded?: GroundedConcept
): string {
  if (grounded?.headline) return grounded.headline.slice(0, 40);
  const hook = pattern.hook || '';
  if (/₹|rs\.?\s*\d+|\d+\s*%\s*off/i.test(hook) && (truth.offer || truth.price)) {
    return `${truth.offer || truth.price} · ${truth.productName}`.slice(0, 40);
  }
  if (truth.benefits[0] && pattern.marketingAngle.includes('Clean')) {
    return truth.benefits[0].slice(0, 40);
  }
  if (/authentic|homemade|ghar|traditional/i.test(hook)) {
    return `Authentic ${truth.productName}`.slice(0, 40);
  }
  return `${truth.productName}${truth.price ? ` — ${truth.price}` : ''}`.slice(0, 40);
}

function primaryTextFromPattern(
  truth: ProductTruthSheet,
  pattern: CompetitorPattern,
  grounded?: GroundedConcept
): string {
  if (grounded?.primaryText) return grounded.primaryText.slice(0, 220);
  const parts = [
    `${truth.brandName} ${truth.productName}.`,
    truth.benefits[0] || truth.description?.slice(0, 100) || '',
    pattern.offerMechanism === 'Price-led offer' && (truth.offer || truth.price)
      ? `${truth.offer || truth.price}.`
      : '',
    pattern.audience ? `Made for ${pattern.audience.toLowerCase()}.` : '',
    truth.allowedClaims[0] || '',
  ].filter(Boolean);
  return parts.join(' ').slice(0, 220);
}

function sceneStoryForPattern(
  angle: string,
  truth: ProductTruthSheet,
  pattern: CompetitorPattern,
  briefScene?: string
): string {
  if (briefScene) return briefScene;
  const env = environmentFromPattern(pattern, 0);
  const beat = `Inspired by winning "${pattern.marketingAngle}" ads — ${pattern.compositionPattern.toLowerCase()}, never copy competitor artwork.`;
  switch (angle) {
    case 'offer-led':
      return `Bold retail offer backdrop with energetic color blocks and promotional negative space. ${env} ${beat}`;
    case 'recipe-lifestyle':
      return `Family meal or thali spread showing ${truth.productName} as hero condiment. ${env} ${beat}`;
    case 'emotional-nostalgia':
      return `Heritage nostalgia for ${truth.brandName} with terracotta tones and kitchen-table authenticity. ${env} ${beat}`;
    case 'benefit-led':
      return `Clean benefit-demo with relevant ingredients in soft focus around empty product zone. ${env} ${beat}`;
    case 'trending-ugc':
      return `Creator-style home review of ${truth.productName}, casual natural light, social-first. ${env} ${beat}`;
    case 'lifestyle-home':
      return `Authentic Indian home kitchen or dining table for ${truth.productName}. ${env} ${beat}`;
    case 'food-desire':
      return `Appetizing food-styling with fresh ingredients at frame edges only. ${env} ${beat}`;
    default:
      return `Premium commercial scene for ${truth.productName}. ${env} ${beat}`;
  }
}

function directionFromPattern(
  pattern: CompetitorPattern,
  truth: ProductTruthSheet,
  index: number,
  grounded?: GroundedConcept,
  ad?: Pick<
    MetaAdLibraryAd,
    'headline' | 'primary_text' | 'cta' | 'ad_format' | 'performance_rating' | 'performance_label'
  >
): CreativeDirection {
  const angle = patternToAngle(pattern);
  const brief = ad
    ? buildCreativeBrief({
        brand: truth.brandName,
        category: truth.category,
        productName: truth.productName,
        competitorAd: ad,
      })
    : null;
  const name = patternToDirectionName(pattern);
  const slug = `${name}-${pattern.sourceId}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const cta =
    pattern.ctaStrategy && pattern.ctaStrategy !== 'SHOP NOW'
      ? pattern.ctaStrategy
      : truth.offer
        ? 'Shop the offer'
        : 'Shop Now';

  return {
    conceptId: `${truth.productId}-${slug}-${index}`,
    name,
    angle,
    emotion: pattern.emotionalTrigger || ANGLE_EMOTION[angle] || 'Confidence',
    hook: grounded?.subline || pattern.hook || `${truth.productName} — ${name}`,
    visualStory: sceneStoryForPattern(angle, truth, pattern, brief?.scenePrompt),
    headline: headlineFromPattern(truth, pattern, grounded),
    primaryText: primaryTextFromPattern(truth, pattern, grounded),
    cta,
    ugcType: ANGLE_UGC[angle],
    recommendedFormats: ANGLE_FORMATS[angle] || ['1:1', '4:5'],
    sourcePatternId: pattern.sourceId,
    sceneEnvironment: environmentFromPattern(pattern, index),
    colorDirection: brief?.colorDirection,
    layoutStyle: brief?.layoutStyle,
  };
}

/** Fallback templates when no library ads were selected */
const FALLBACK_TEMPLATES = [
  { name: 'Premium Product Hero', angle: 'premium-hero', emotion: 'Trust' },
  { name: 'Lifestyle / Home', angle: 'lifestyle-home', emotion: 'Comfort' },
  { name: 'Food Desire', angle: 'food-desire', emotion: 'Craving' },
  { name: 'Offer / Performance', angle: 'offer-led', emotion: 'Urgency' },
  { name: 'Heritage Story', angle: 'emotional-nostalgia', emotion: 'Nostalgia' },
  { name: 'Recipe / Use Case', angle: 'recipe-lifestyle', emotion: 'Inspiration' },
];

export function generateCreativeDirections(input: {
  truth: ProductTruthSheet;
  patterns: CompetitorPattern[];
  selectedAds?: Array<
    Pick<
      MetaAdLibraryAd,
      'id' | 'library_id' | 'headline' | 'primary_text' | 'cta' | 'ad_format' | 'performance_rating' | 'performance_label'
    >
  >;
  groundedConcepts?: GroundedConcept[];
  language?: string;
  tone?: string;
  maxDirections?: number;
}): CreativeDirection[] {
  const max = Math.max(3, Math.min(10, input.maxDirections || 6));
  const cta = input.truth.offer ? 'Shop the offer' : 'Shop Now';

  if (input.patterns.length > 0) {
    const directions: CreativeDirection[] = [];
    const count = Math.min(max, input.patterns.length);
    for (let index = 0; index < count; index += 1) {
      const pattern = input.patterns[index];
      const ad = input.selectedAds?.find(
        (item) => (item.library_id || item.id) === pattern.sourceId
      );
      const grounded = input.groundedConcepts?.find(
        (concept) => concept.sourceLibraryId === pattern.sourceId
      );
      directions.push(directionFromPattern(pattern, input.truth, index, grounded, ad));
    }
    return directions;
  }

  return FALLBACK_TEMPLATES.slice(0, max).map((template, index) => ({
    conceptId: `${input.truth.productId}-${template.angle}-${index}`,
    name: template.name,
    angle: template.angle,
    emotion: template.emotion,
    hook: `${input.truth.productName} — ${template.emotion.toLowerCase()} you can trust`,
    visualStory: sceneStoryForPattern(template.angle, input.truth, {
      sourceId: `fallback-${index}`,
      hook: '',
      marketingAngle: template.name,
      emotionalTrigger: template.emotion,
      offerMechanism: 'Value framing',
      audience: 'Online shoppers',
      visualStrategy: 'Product-forward hero',
      compositionPattern: 'Centered hero product',
      productPositioning: 'Everyday trusted staple',
      ctaStrategy: cta,
      videoHook: '',
      sceneSequence: ['hero'],
    }),
    headline: `${input.truth.productName}${input.truth.price ? ` — ${input.truth.price}` : ''}`.slice(
      0,
      40
    ),
    primaryText: [
      input.truth.benefits[0] || `${input.truth.brandName} ${input.truth.productName}`,
      input.truth.benefits[1] || input.truth.description?.slice(0, 120) || '',
    ]
      .filter(Boolean)
      .join('. ')
      .slice(0, 220),
    cta,
    recommendedFormats: ANGLE_FORMATS[template.angle] || ['1:1', '4:5'],
    sceneEnvironment: environmentFromPattern(
      {
        sourceId: `fallback-${index}`,
        hook: '',
        marketingAngle: template.name,
        emotionalTrigger: template.emotion,
        offerMechanism: 'Value framing',
        audience: 'Online shoppers',
        visualStrategy: 'Product-forward hero',
        compositionPattern:
          template.angle === 'recipe-lifestyle'
            ? 'Lifestyle + ingredients'
            : template.angle === 'offer-led'
              ? 'Variety grid'
              : template.angle === 'emotional-nostalgia'
                ? 'Founder / kitchen table'
                : 'Centered hero product',
        productPositioning: 'Everyday trusted staple',
        ctaStrategy: cta,
        videoHook: '',
        sceneSequence: ['hero'],
      },
      index
    ),
  }));
}
