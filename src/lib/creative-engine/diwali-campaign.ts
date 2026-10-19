import type { MetaAdPromptPresetId } from './meta-ad-prompt-library.types';
import type { CreativeDirection, ProductTruthSheet } from './types';

/** Locked Diwali tagline set — one ad per tagline for Meta creative testing */
export const DIWALI_TAGLINES = [
  {
    id: 'thali-adhuri',
    tagline: 'Diwali ki thali… achaar ke bina adhuri! 😍',
    headline: 'Thali incomplete without achaar',
    role: 'Hinglish scroll-stopper',
  },
  {
    id: 'flavours-home',
    tagline: 'Some flavours always feel like home.',
    headline: 'Flavours that feel like home',
    role: 'Soft English brand line',
  },
  {
    id: 'taste-tradition',
    tagline: 'This Diwali, bring home the taste of tradition! 🪔',
    headline: 'Taste of tradition this Diwali',
    role: 'Festival CTA headline',
  },
  {
    id: 'ghar-ka-swaad',
    tagline: 'Ghar ka swaad, Diwali wali thali pe.',
    headline: 'Ghar ka swaad on your thali',
    role: 'Hinglish thali-home / Stories',
  },
] as const;

export type DiwaliTaglineId = (typeof DIWALI_TAGLINES)[number]['id'];

const DIWALI_PRESETS: Record<
  DiwaliTaglineId,
  {
    name: string;
    angle: string;
    emotion: string;
    preferredPresetId: MetaAdPromptPresetId;
    formats: Array<'1:1' | '4:5' | '9:16'>;
    visualStory: string;
    sceneEnvironment: string;
    colorDirection: string;
    ugcType?: CreativeDirection['ugcType'];
  }
> = {
  'thali-adhuri': {
    name: 'Diwali · Thali Incomplete',
    angle: 'food-desire',
    emotion: 'Craving',
    preferredPresetId: 'diwali-thali-incomplete',
    formats: ['1:1'],
    visualStory:
      'Festival thali with empty pickle gap — achaar as the missing piece. Background-only; real packshot composited. Never redraw logo or label.',
    sceneEnvironment: 'Diwali thali spread, empty center product zone, marigold at edges',
    colorDirection: 'warm festive gold, brass, marigold, terracotta accents',
  },
  'flavours-home': {
    name: 'Diwali · Flavours of Home',
    angle: 'emotional-nostalgia',
    emotion: 'Nostalgia',
    preferredPresetId: 'diwali-flavours-of-home',
    formats: ['1:1'],
    visualStory:
      'Warm Indian home kitchen / dining table at Diwali evening. Soft emotional light. Scene only — brand colors and logo stay on real packshot.',
    sceneEnvironment: 'Home kitchen table, soft diya light, clean center for jar',
    colorDirection: 'warm tungsten, soft linen, gentle gold highlights',
  },
  'taste-tradition': {
    name: 'Diwali · Taste of Tradition',
    angle: 'lifestyle-home',
    emotion: 'Comfort',
    preferredPresetId: 'diwali-taste-of-tradition',
    formats: ['1:1'],
    visualStory:
      'Gift-ready Diwali still-life with diyas and heritage textures. Empty center for real jar — no AI logo, no label recolor.',
    sceneEnvironment: 'Gift still-life, brass diyas, marigold petals, empty pedestal',
    colorDirection: 'gold, terracotta, soft heritage warmth',
  },
  'ghar-ka-swaad': {
    name: 'Diwali · Ghar Ka Swaad',
    angle: 'food-desire',
    emotion: 'Authenticity',
    preferredPresetId: 'diwali-ghar-ka-swaad-stories',
    formats: ['1:1'],
    visualStory:
      'Feed Image thali close-up with Diwali warmth. Empty center for packshot. Branding intact via composite only.',
    sceneEnvironment: 'Thali close-up, soft diya glow at edges, empty center zone',
    colorDirection: 'warm festival contrast for feed thumb-stop',
  },
};

export function isDiwaliCampaignTheme(tone?: string, campaignTheme?: string): boolean {
  const hay = `${tone || ''} ${campaignTheme || ''}`.toLowerCase();
  return /diwali|festive\s*sale|festival\s*food|ghar ka swaad/.test(hay);
}

function primaryForTagline(
  truth: ProductTruthSheet,
  tagline: string,
  benefitHint: string
): string {
  const brand = truth.brandName || 'Our';
  const product = truth.productName || 'achaar';
  const benefit = truth.benefits[0] || benefitHint;
  return `${tagline} ${brand} ${product} — ${benefit} Tap Shop Now.`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

/** Four Meta-ready creative directions — one per locked Diwali tagline */
export function buildDiwaliCreativeDirections(truth: ProductTruthSheet): CreativeDirection[] {
  const cta = truth.offer ? 'Shop the offer' : 'Shop Now';

  return DIWALI_TAGLINES.map((entry, index) => {
    const meta = DIWALI_PRESETS[entry.id];
    const benefitHint =
      entry.id === 'thali-adhuri'
        ? 'completes every festive plate'
        : entry.id === 'flavours-home'
          ? 'homemade taste you remember'
          : entry.id === 'taste-tradition'
            ? 'tradition in every jar'
            : 'ghar ka swaad for Diwali thali';

    return {
      conceptId: `${truth.productId}-diwali-${entry.id}-${index}`,
      name: meta.name,
      angle: meta.angle,
      emotion: meta.emotion,
      hook: entry.tagline.slice(0, 80),
      visualStory: meta.visualStory,
      headline: entry.headline.slice(0, 40),
      primaryText: primaryForTagline(truth, entry.tagline, benefitHint),
      cta,
      ugcType: meta.ugcType,
      recommendedFormats: meta.formats,
      sourcePatternId: `diwali-${entry.id}`,
      sceneEnvironment: meta.sceneEnvironment,
      colorDirection: meta.colorDirection,
      layoutStyle: 'festival product hero — empty center for packshot composite',
      preferredPresetId: meta.preferredPresetId,
    };
  });
}

/** Operator publish checklist (also mirrored in docs/diwali-campaign.md) */
export const DIWALI_PUBLISH_PATH = {
  campaignNamePrefix: 'Diwali · Creative Test',
  templateId: 'diwali-achaar',
  tone: 'Diwali festive',
  variantCount: 4,
  formats: ['single_image'] as const,
  cta: 'SHOP_NOW',
  steps: [
    'Open /ads → select your real product packshot (logo/colors source of truth).',
    'Click Campaign pack → Diwali (4 creatives) — formats lock to Image only.',
    'Best variants = 4 → Generate Diwali pack (festival scene + packshot composite).',
    'QA each Image: reject if logo/colors look wrong; regenerate scene only.',
    'Approve 4 Image ads; CTA Shop Now. Add Stories/Video in a later pass.',
    'Publish as a new Diwali campaign (do not reuse fatigued creatives).',
    'Let Meta run 48–72h before pausing losers; keep winning tagline + visual pair.',
  ],
} as const;
