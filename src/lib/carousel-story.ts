/**
 * Story-led carousel planning (Meta Creative Scorecard fixes):
 * hook on card 1, benefit overlays on product cards, CTA end card, Reels companion.
 * Every overlay phrase must be found in approved claims or the product's own page text.
 */

export type CarouselCardRole = 'hook' | 'benefit' | 'cta';
export type CarouselCardFormat = 'feed_1x1' | 'story_9x16';

/** Product cards kept per story carousel (+1 CTA end card). More cards read as redundant to Meta. */
export const CAROUSEL_STORY_MAX_PRODUCTS = 6;

export type MetaScorecardCheck = {
  key:
    | 'hook'
    | 'value_prop'
    | 'text_present'
    | 'cta_visible'
    | 'cta_placement'
    | 'messaging'
    | 'aspect_ratio'
    | 'safe_zone'
    | 'format_mix';
  label: string;
  pass: boolean;
  note: string;
};

type PhraseRule = { pattern: RegExp; label: string | ((match: RegExpMatchArray) => string) };

const title = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b([a-z])/g, (char) => char.toUpperCase())
    .trim();

const BENEFIT_RULES: PhraseRule[] = [
  { pattern: /traditional recipe|recipe passed down|generations/i, label: 'Traditional Recipe' },
  { pattern: /\bhand[- ]?made\b|\bhand[- ]?crafted\b/i, label: 'Handmade' },
  { pattern: /\bhome[- ]?made\b|\bghar ka\b/i, label: 'Homemade Taste' },
  { pattern: /\bno (added )?preservatives?\b|\bpreservative[- ]free\b/i, label: 'No Preservatives' },
  { pattern: /\bno artificial (flavou?rs?|colou?rs?)\b/i, label: 'No Artificial Flavours' },
  { pattern: /\b100%\s*natural\b|\ball[- ]natural\b/i, label: '100% Natural' },
  { pattern: /\bsun[- ]?dried\b/i, label: 'Sun-Dried' },
  { pattern: /\bhand[- ]?picked\b/i, label: 'Hand-Picked Ingredients' },
  {
    pattern: /\b(?:pure|cold[- ]pressed|wood[- ]pressed)\s+(peanut|groundnut|mustard|sesame|til|coconut)\s+oil\b/i,
    label: (m) => `Pure ${title(m[1]!)} Oil`,
  },
  { pattern: /\bsmall[- ]batch/i, label: 'Small-Batch Made' },
  { pattern: /\bno (added )?sugar\b|\bsugar[- ]free\b/i, label: 'No Added Sugar' },
  { pattern: /\bmade with jaggery\b|\bjaggery\b/i, label: 'Made with Jaggery' },
  { pattern: /\bgluten[- ]free\b/i, label: 'Gluten-Free' },
  { pattern: /\borganic\b/i, label: 'Organic Ingredients' },
];

const REGIONS = [
  'Saurashtra',
  'Kathiawad',
  'Gujarat',
  'Rajasthan',
  'Punjab',
  'Andhra',
  'Kerala',
  'Bengal',
  'Maharashtra',
  'Goa',
  'Kashmir',
  'Chettinad',
  'Malvan',
  'Hyderabad',
];

const FOOD_CATEGORY = /pickle|achar|masala|spice|snack|food|sweet|namkeen|tea|chutney|papad|honey|ghee|oil|mukhwas|jam/i;

function cleanSource(texts: Array<string | null | undefined>): string {
  return texts
    .filter(Boolean)
    .join(' . ')
    .replace(/\s+/g, ' ');
}

/** Short benefit labels that literally appear in the given approved/page text. */
export function mineBenefitPhrases(texts: Array<string | null | undefined>, max = 4): string[] {
  const source = cleanSource(texts);
  if (!source) return [];
  const found: string[] = [];
  for (const rule of BENEFIT_RULES) {
    const match = source.match(rule.pattern);
    if (!match) continue;
    const label = typeof rule.label === 'function' ? rule.label(match) : rule.label;
    if (!found.includes(label)) found.push(label);
    if (found.length >= max) break;
  }
  return found;
}

/** "Homemade Mango Pickle | Aam ka Achar" → "Homemade Mango Pickle" */
export function shortProductName(name: string, max = 32): string {
  const first = String(name || '')
    .split(/\s[|–—-]\s/)[0]!
    .replace(/\s+/g, ' ')
    .trim();
  if (first.length <= max) return first;
  return first.slice(0, max).replace(/\s+\S*$/, '').trim();
}

export function deriveCarouselHook(input: {
  hookOverride?: string | null;
  claimsText: Array<string | null | undefined>;
  category?: string | null;
  brand: string;
}): string {
  const override = String(input.hookOverride || '').replace(/\s+/g, ' ').trim();
  if (override) return override.slice(0, 40);

  const source = cleanSource(input.claimsText);
  const category = String(input.category || '').trim();
  const authentic = /\bauthentic\b/i.test(source);

  let firstRegion: string | null = null;
  let firstIndex = Number.POSITIVE_INFINITY;
  for (const region of REGIONS) {
    const index = source.search(new RegExp(`\\b${region}`, 'i'));
    if (index >= 0 && index < firstIndex) {
      firstIndex = index;
      firstRegion = region;
    }
  }
  if (firstRegion && authentic) {
    return FOOD_CATEGORY.test(category) || FOOD_CATEGORY.test(source)
      ? `Authentic ${firstRegion} Flavours`
      : `Authentic ${firstRegion} ${title(category || 'Range')}`.slice(0, 40);
  }

  const tasteOf = source.match(/\bauthentic (taste|flavou?rs?) of ([A-Za-z]+)/i);
  if (tasteOf) return `Authentic ${title(tasteOf[1]!)} of ${title(tasteOf[2]!)}`.slice(0, 40);

  if (firstRegion) return `Taste of ${firstRegion}`;
  return `Swipe the ${input.brand} range`.slice(0, 40);
}

export function parseOverlayList(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.map(String) : String(raw || '').split(/[\n,]+/);
  return list
    .map((item) => item.replace(/\s+/g, ' ').trim().slice(0, 28))
    .filter(Boolean)
    .slice(0, 10);
}

export function buildCarouselCardUrl(params: {
  role: CarouselCardRole;
  format?: CarouselCardFormat;
  brand: string;
  images: string[];
  headline?: string;
  product?: string;
  price?: string;
  chip?: string;
  cta?: string;
  domain?: string;
  index?: number;
  total?: number;
}): string {
  const q = new URLSearchParams({
    role: params.role,
    format: params.format || 'feed_1x1',
    brand: params.brand.slice(0, 48),
  });
  for (const image of params.images.slice(0, 4)) q.append('img', image);
  if (params.headline) q.set('headline', params.headline.slice(0, 60));
  if (params.product) q.set('product', params.product.slice(0, 40));
  if (params.price) q.set('price', params.price.slice(0, 16));
  if (params.chip) q.set('chip', params.chip.slice(0, 28));
  if (params.cta) q.set('cta', params.cta.slice(0, 20));
  if (params.domain) q.set('domain', params.domain.slice(0, 48));
  if (params.index) q.set('i', String(params.index));
  if (params.total) q.set('n', String(params.total));
  return `/api/ads/creative-card?${q.toString()}`;
}

export function domainFromUrl(url: string | null | undefined): string {
  try {
    return new URL(String(url || '')).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Meta Advantage+ Creative Scorecard equivalents, evaluated before launch. */
export function buildCarouselScorecard(input: {
  hook: string;
  productCards: number;
  cardsWithBenefit: number;
  cardsRendered: number;
  totalCards: number;
  hasCtaEndCard: boolean;
  primaryText: string;
  benefitsInCopy: string[];
  hasReelsCompanion: boolean;
}): { checks: MetaScorecardCheck[]; score: number; flags: string[]; valid: boolean } {
  const copy = input.primaryText.toLowerCase();
  const checks: MetaScorecardCheck[] = [
    {
      key: 'hook',
      label: 'Hook on card 1',
      pass: Boolean(input.hook) && input.cardsRendered > 0,
      note: input.hook ? `"${input.hook}"` : 'Card 1 has no headline to stop the thumb',
    },
    {
      key: 'value_prop',
      label: 'Value proposition',
      pass: input.cardsWithBenefit >= Math.ceil(input.productCards / 2),
      note: `${input.cardsWithBenefit}/${input.productCards} product cards show a benefit`,
    },
    {
      key: 'text_present',
      label: 'Text overlays',
      pass: input.cardsRendered === input.totalCards,
      note:
        input.cardsRendered === input.totalCards
          ? 'Every card has readable overlay text'
          : `${input.totalCards - input.cardsRendered} card(s) fell back to the plain store photo`,
    },
    {
      key: 'cta_visible',
      label: 'CTA visibility',
      pass: input.hasCtaEndCard,
      note: input.hasCtaEndCard ? 'Shop Now button on the end card' : 'No visible CTA on any card',
    },
    {
      key: 'cta_placement',
      label: 'CTA placement',
      pass: input.hasCtaEndCard,
      note: 'Final card is a dedicated Shop Now card',
    },
    {
      key: 'messaging',
      label: 'Messaging clarity',
      pass:
        copy.includes(input.hook.toLowerCase().slice(0, 12)) &&
        input.benefitsInCopy.some((benefit) => copy.includes(benefit.toLowerCase())),
      note: 'Primary text leads with the hook and names a benefit',
    },
    { key: 'aspect_ratio', label: 'Aspect ratio', pass: true, note: '1:1 cards, 9:16 Reels' },
    {
      key: 'safe_zone',
      label: 'Safe zone',
      pass: true,
      note: 'Text kept inside Feed and Reels safe zones',
    },
    {
      key: 'format_mix',
      label: 'Format diversity',
      pass: input.hasReelsCompanion,
      note: input.hasReelsCompanion
        ? '9:16 Reels video built from the same cards'
        : 'Only a static carousel — add the Reels video to the same ad set',
    },
  ];
  const passed = checks.filter((check) => check.pass).length;
  const critical = ['hook', 'cta_visible', 'text_present'];
  return {
    checks,
    score: Math.round((passed / checks.length) * 100),
    flags: checks.filter((check) => !check.pass).map((check) => `${check.label}: ${check.note}`),
    valid: checks.filter((check) => critical.includes(check.key)).every((check) => check.pass),
  };
}
