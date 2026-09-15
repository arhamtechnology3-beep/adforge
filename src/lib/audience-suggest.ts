/**
 * Auto-suggest Cities + Interests for Sales campaigns.
 * Meta Ad Library does NOT expose competitor targeting — we infer from:
 * - selected Library creatives (copy/hooks)
 * - competitor brand/positioning
 * - subscriber product category (pickles/food → cuisine interests)
 * - India D2C metro + tier-2 playbooks that convert for ecommerce
 *
 * User can always edit the comma-separated fields manually.
 */

export type AudienceSuggestInput = {
  /** Brand / store category, e.g. pickles, food, fashion */
  category?: string | null;
  brandName?: string | null;
  websiteUrl?: string | null;
  competitorBrands?: string[];
  /** Hooks / positioning from competitor intel */
  competitorHooks?: string[];
  /** Primary text + headlines from selected Meta Library ads */
  libraryAdTexts?: string[];
  /** Rare — Library sometimes surfaces location labels on ads */
  libraryLocations?: string[];
  /** Prefer festive / gift-heavy interests when true */
  festive?: boolean;
};

export type AudienceSuggestion = {
  cities: string[];
  interests: string[];
  citiesCsv: string;
  interestsCsv: string;
  source: string;
  rationale: string[];
};

/** India metros that typically deliver purchase volume for D2C ecommerce. */
export const INDIA_METRO_CITIES = [
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Ahmedabad',
] as const;

/** Tier-2 cities — often cheaper CPM for food / gifting. */
export const INDIA_TIER2_CITIES = [
  'Jaipur',
  'Surat',
  'Lucknow',
  'Indore',
  'Chandigarh',
  'Kochi',
] as const;

/** Category → Meta-searchable interest names (resolved later via Targeting Search). */
const CATEGORY_INTERESTS: Record<string, string[]> = {
  pickles: [
    'Indian cuisine',
    'Cooking',
    'Homemade food',
    'Organic food',
    'Online shopping',
    'Gifting',
  ],
  food: [
    'Indian cuisine',
    'Cooking',
    'Organic food',
    'Online shopping',
    'Gifting',
    'Foodie',
  ],
  snacks: [
    'Snacks',
    'Healthy eating',
    'Online shopping',
    'Cooking',
    'Gifting',
  ],
  spices: [
    'Indian cuisine',
    'Cooking',
    'Spices',
    'Organic food',
    'Online shopping',
  ],
  fashion: [
    'Online shopping',
    'Fashion',
    'Clothing',
    'Shopping',
    'Gifting',
  ],
  beauty: [
    'Beauty',
    'Skincare',
    'Cosmetics',
    'Online shopping',
    'Gifting',
  ],
  jewellery: [
    'Jewellery',
    'Fashion',
    'Online shopping',
    'Gifting',
    'Weddings',
  ],
  default: ['Online shopping', 'Gifting', 'Shopping', 'E-commerce'],
};

const FESTIVE_EXTRA = ['Diwali', 'Festivals', 'Gifting', 'Indian festivals'];

const KEYWORD_TO_INTEREST: Array<{ re: RegExp; interest: string }> = [
  { re: /\b(pickle|achar|aachar|chhundo|keri|mango)\b/i, interest: 'Indian cuisine' },
  { re: /\b(homemade|ghar|kitchen|nani|dadi)\b/i, interest: 'Homemade food' },
  { re: /\b(organic|natural|preservative.?free|chemical.?free)\b/i, interest: 'Organic food' },
  { re: /\b(gift|gifting|hamper|festival|diwali|ganpati|navratri)\b/i, interest: 'Gifting' },
  { re: /\b(spice|masala|chutney)\b/i, interest: 'Spices' },
  { re: /\b(snack|namkeen|makhana|chana)\b/i, interest: 'Snacks' },
  { re: /\b(cook|recipe|thali|meal)\b/i, interest: 'Cooking' },
  { re: /\b(shop|buy|order|cart|offer|sale)\b/i, interest: 'Online shopping' },
  { re: /\b(beauty|skincare|serum)\b/i, interest: 'Beauty' },
  { re: /\b(fashion|kurti|saree|apparel)\b/i, interest: 'Fashion' },
];

function detectCategory(input: AudienceSuggestInput): string {
  const blob = [
    input.category,
    input.brandName,
    input.websiteUrl,
    ...(input.competitorHooks || []),
    ...(input.libraryAdTexts || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/pickle|achar|aachar|chutney/.test(blob)) return 'pickles';
  if (/spice|masala/.test(blob)) return 'spices';
  if (/snack|namkeen|makhana/.test(blob)) return 'snacks';
  if (/beauty|skincare|cosmetic/.test(blob)) return 'beauty';
  if (/fashion|apparel|clothing|kurti/.test(blob)) return 'fashion';
  if (/jewel|jewellery|jewelry/.test(blob)) return 'jewellery';
  if (/food|cuisine|grocery|organic/.test(blob)) return 'food';
  return 'default';
}

function uniquePreserve(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = String(raw || '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

function interestsFromCopy(texts: string[]): string[] {
  const found: string[] = [];
  const blob = texts.join(' \n ');
  for (const rule of KEYWORD_TO_INTEREST) {
    if (rule.re.test(blob)) found.push(rule.interest);
  }
  return found;
}

/**
 * Build recommended cities + interests. Always returns editable CSV strings.
 */
export function suggestAudience(input: AudienceSuggestInput = {}): AudienceSuggestion {
  const rationale: string[] = [];
  const category = detectCategory(input);
  rationale.push(`Category detected: ${category}`);

  const cities: string[] = [];
  if (input.libraryLocations?.length) {
    cities.push(...input.libraryLocations);
    rationale.push('Cities hinted from Ad Library ad metadata (when present)');
  }
  cities.push(...INDIA_METRO_CITIES);
  if (category === 'pickles' || category === 'food' || category === 'snacks' || category === 'spices') {
    cities.push('Jaipur', 'Surat', 'Indore');
    rationale.push('Added tier-2 cities common for Indian food / gifting ecommerce');
  } else {
    cities.push('Chennai', 'Kolkata');
  }

  const pack = CATEGORY_INTERESTS[category] || CATEGORY_INTERESTS.default;
  const fromCopy = interestsFromCopy([
    ...(input.libraryAdTexts || []),
    ...(input.competitorHooks || []),
  ]);
  if (fromCopy.length) {
    rationale.push('Interests inferred from competitor Ad Library copy');
  }
  if (input.competitorBrands?.length) {
    rationale.push(`Competitor brands referenced: ${input.competitorBrands.slice(0, 3).join(', ')}`);
  }

  let interests = [...fromCopy, ...pack];
  const festive =
    input.festive ||
    /ganpati|diwali|navratri|festive|festival/i.test(
      [...(input.libraryAdTexts || []), ...(input.competitorHooks || []), input.brandName || ''].join(
        ' '
      )
    );
  if (festive) {
    interests = [...FESTIVE_EXTRA, ...interests];
    rationale.push('Festive/gifting boost applied');
  }

  const citiesOut = uniquePreserve(cities, 9);
  const interestsOut = uniquePreserve(interests, 8);

  return {
    cities: citiesOut,
    interests: interestsOut,
    citiesCsv: citiesOut.join(', '),
    interestsCsv: interestsOut.join(', '),
    source: input.libraryAdTexts?.length
      ? 'competitor_library'
      : input.competitorHooks?.length
        ? 'competitor_intel'
        : 'category_playbook',
    rationale,
  };
}

export function audienceSuggestionFromCompetitorIntel(opts: {
  brandName?: string | null;
  websiteUrl?: string | null;
  category?: string | null;
  competitors: Array<{
    brand?: string;
    hook?: string;
    counterAngle?: string;
    positioning?: string;
    live_meta_ads?: Array<{
      headline?: string | null;
      primary_text?: string | null;
      target_locations?: string[];
    }>;
  }>;
  selectedAds?: Array<{
    headline?: string | null;
    primary_text?: string | null;
    /** Ads page may use primary_text or headline aliases */
    primaryText?: string | null;
    target_locations?: string[];
  }>;
}): AudienceSuggestion {
  const libraryAdTexts = [
    ...(opts.selectedAds || []).flatMap((a) => [
      a.headline,
      a.primary_text,
      a.primaryText,
    ]),
    ...opts.competitors.flatMap((c) =>
      (c.live_meta_ads || []).flatMap((a) => [a.headline, a.primary_text])
    ),
  ].filter(Boolean) as string[];

  const libraryLocations = [
    ...(opts.selectedAds || []).flatMap((a) => a.target_locations || []),
    ...opts.competitors.flatMap((c) =>
      (c.live_meta_ads || []).flatMap((a) => a.target_locations || [])
    ),
  ];

  const competitorHooks = opts.competitors.flatMap((c) =>
    [c.hook, c.counterAngle, c.positioning].filter(Boolean)
  ) as string[];

  return suggestAudience({
    category: opts.category,
    brandName: opts.brandName,
    websiteUrl: opts.websiteUrl,
    competitorBrands: opts.competitors.map((c) => c.brand).filter(Boolean) as string[],
    competitorHooks,
    libraryAdTexts,
    libraryLocations,
  });
}
