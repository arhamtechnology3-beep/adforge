/**
 * Auto-suggest Cities + Interests for Sales campaigns.
 *
 * Meta Ad Library does NOT expose competitor targeting. We infer interests
 * from category / Library copy, and cities from India tiers the user picks:
 *   Tier 1 = 8 metros
 *   Tier 2 ≈ 97 cities
 *   Tier 3 = additional commercial cities
 *
 * IMPORTANT — Meta Ads push:
 * These are display names for Meta Targeting Search (`type=adgeolocation`).
 * At launch, `resolveTargeting` keeps only cities/interests Meta returns IDs
 * for. Unresolved names are dropped — we never invent geo keys for Ads API.
 *
 * User can toggle tiers and still edit the comma-separated fields manually.
 */

export type AudienceSuggestInput = {
  category?: string | null;
  brandName?: string | null;
  websiteUrl?: string | null;
  competitorBrands?: string[];
  competitorHooks?: string[];
  libraryAdTexts?: string[];
  libraryLocations?: string[];
  festive?: boolean;
  /** Which India city tiers to include (default: tier1 + tier2 for Sales). */
  cityTiers?: CityTier[];
};

export type CityTier = 'tier1' | 'tier2' | 'tier3';

export type AudienceSuggestion = {
  cities: string[];
  interests: string[];
  citiesCsv: string;
  interestsCsv: string;
  source: string;
  rationale: string[];
  cityTiers: CityTier[];
};

/** Official-style Tier-1 metros (8). */
export const INDIA_TIER1_CITIES = [
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Pune',
  'Ahmedabad',
] as const;

/** @deprecated use INDIA_TIER1_CITIES */
export const INDIA_METRO_CITIES = INDIA_TIER1_CITIES;

/**
 * Tier-2 cities (~97) — large urban markets beyond the 8 metros.
 * Names chosen to resolve via Meta city targeting search.
 */
export const INDIA_TIER2_CITIES = [
  'Jaipur',
  'Surat',
  'Lucknow',
  'Kanpur',
  'Nagpur',
  'Indore',
  'Thane',
  'Bhopal',
  'Visakhapatnam',
  'Patna',
  'Vadodara',
  'Ghaziabad',
  'Ludhiana',
  'Agra',
  'Nashik',
  'Faridabad',
  'Meerut',
  'Rajkot',
  'Varanasi',
  'Srinagar',
  'Aurangabad',
  'Dhanbad',
  'Amritsar',
  'Allahabad',
  'Ranchi',
  'Howrah',
  'Coimbatore',
  'Jabalpur',
  'Gwalior',
  'Vijayawada',
  'Jodhpur',
  'Madurai',
  'Raipur',
  'Kota',
  'Guwahati',
  'Chandigarh',
  'Solapur',
  'Hubli',
  'Bareilly',
  'Moradabad',
  'Mysuru',
  'Gurgaon',
  'Aligarh',
  'Jalandhar',
  'Tiruchirappalli',
  'Bhubaneswar',
  'Salem',
  'Mira-Bhayandar',
  'Warangal',
  'Guntur',
  'Bhiwandi',
  'Saharanpur',
  'Gorakhpur',
  'Bikaner',
  'Amravati',
  'Noida',
  'Jamshedpur',
  'Bhilai',
  'Cuttack',
  'Firozabad',
  'Kochi',
  'Nellore',
  'Bhavnagar',
  'Dehradun',
  'Durgapur',
  'Asansol',
  'Nanded',
  'Kolhapur',
  'Ajmer',
  'Gulbarga',
  'Jamnagar',
  'Ujjain',
  'Loni',
  'Siliguri',
  'Jhansi',
  'Ulhasnagar',
  'Jammu',
  'Sangli',
  'Mangalore',
  'Erode',
  'Belgaum',
  'Ambattur',
  'Tirunelveli',
  'Malegaon',
  'Gaya',
  'Jalgaon',
  'Udaipur',
  'Maheshtala',
  'Tiruppur',
  'Davanagere',
  'Kozhikode',
  'Akola',
  'Kurnool',
  'Rajpur Sonarpur',
  'Rajahmundry',
  'Bokaro',
  'South Dumdum',
] as const;

/** Tier-3 — additional commercial / food-gifting catchments. */
export const INDIA_TIER3_CITIES = [
  'Thrissur',
  'Alappuzha',
  'Kollam',
  'Kannur',
  'Palakkad',
  'Tirupati',
  'Anantapur',
  'Kadapa',
  'Karimnagar',
  'Nizamabad',
  'Shimoga',
  'Tumkur',
  'Bijapur',
  'Bellary',
  'Raichur',
  'Pondicherry',
  'Vellore',
  'Thanjavur',
  'Dindigul',
  'Kanchipuram',
  'Nagercoil',
  'Muzaffarpur',
  'Bhagalpur',
  'Purnia',
  'Darbhanga',
  'Rohtak',
  'Panipat',
  'Hisar',
  'Karnal',
  'Sonipat',
  'Yamunanagar',
  'Ambala',
  'Mathura',
  'Muzaffarnagar',
  'Shahjahanpur',
  'Farrukhabad',
  'Rampur',
  'Hapur',
  'Etawah',
  'Mirzapur',
  'Sambalpur',
  'Rourkela',
  'Balasore',
  'Berhampur',
  'Imphal',
  'Shillong',
  'Agartala',
  'Aizawl',
  'Gangtok',
  'Itanagar',
  'Dimapur',
  'Panaji',
  'Margao',
  'Gandhinagar',
  'Anand',
  'Mehsana',
  'Bharuch',
  'Vapi',
  'Navsari',
  'Junagadh',
  'Morbi',
  'Gandhidham',
  'Haridwar',
  'Rishikesh',
  'Haldwani',
  'Rudrapur',
  'Bilaspur',
  'Korba',
  'Durg',
  'Rewa',
  'Satna',
  'Sagar',
  'Ratlam',
  'Dewas',
  'Burhanpur',
  'Ichalkaranji',
  'Latur',
  'Ahmednagar',
  'Jalna',
  'Parbhani',
  'Dhule',
  'Kalyan',
  'Vasai-Virar',
  'Navi Mumbai',
  'Pimpri-Chinchwad',
] as const;

/** @deprecated use INDIA_TIER2_CITIES */
export const INDIA_TIER2_CITIES_LEGACY_SHORT = [
  'Jaipur',
  'Surat',
  'Lucknow',
  'Indore',
  'Chandigarh',
  'Kochi',
] as const;

export const CITY_TIER_META: Record<
  CityTier,
  { label: string; shortLabel: string; description: string; cities: readonly string[] }
> = {
  tier1: {
    label: 'Tier 1',
    shortLabel: 'T1',
    description: '8 metros — highest purchase volume',
    cities: INDIA_TIER1_CITIES,
  },
  tier2: {
    label: 'Tier 2',
    shortLabel: 'T2',
    description: '~97 large urban markets',
    cities: INDIA_TIER2_CITIES,
  },
  tier3: {
    label: 'Tier 3',
    shortLabel: 'T3',
    description: 'Additional commercial cities',
    cities: INDIA_TIER3_CITIES,
  },
};

/** Default Sales selection: metros + Tier-2 (broad India reach without full T3). */
export const DEFAULT_SALES_CITY_TIERS: CityTier[] = ['tier1', 'tier2'];

/**
 * Interest names aligned with Meta Targeting Search / offline KNOWN_INTERESTS.
 * Prefer names Meta Ads Manager commonly resolves — avoid invented niches
 * that fail `type=adinterest` and get dropped at launch.
 */
const CATEGORY_INTERESTS: Record<string, string[]> = {
  pickles: [
    'Indian cuisine',
    'Cooking',
    'Homemade food',
    'Organic food',
    'Foodie',
    'Online shopping',
    'Shopping',
    'E-commerce',
    'Gifting',
    'Healthy eating',
    'Festivals',
    'Diwali',
    'Indian festivals',
  ],
  food: [
    'Indian cuisine',
    'Cooking',
    'Organic food',
    'Foodie',
    'Homemade food',
    'Healthy eating',
    'Online shopping',
    'Shopping',
    'E-commerce',
    'Gifting',
    'Festivals',
    'Diwali',
    'Indian festivals',
  ],
  snacks: [
    'Snacks',
    'Healthy eating',
    'Cooking',
    'Indian cuisine',
    'Foodie',
    'Online shopping',
    'Shopping',
    'E-commerce',
    'Gifting',
    'Festivals',
  ],
  spices: [
    'Indian cuisine',
    'Cooking',
    'Spices',
    'Organic food',
    'Homemade food',
    'Online shopping',
    'Shopping',
    'Gifting',
  ],
  fashion: [
    'Online shopping',
    'Fashion',
    'Clothing',
    'Shopping',
    'E-commerce',
    'Gifting',
    'Festivals',
  ],
  beauty: [
    'Beauty',
    'Skincare',
    'Cosmetics',
    'Online shopping',
    'Shopping',
    'E-commerce',
    'Gifting',
  ],
  jewellery: [
    'Jewellery',
    'Fashion',
    'Online shopping',
    'Shopping',
    'Gifting',
    'Weddings',
    'Festivals',
  ],
  default: [
    'Online shopping',
    'Shopping',
    'E-commerce',
    'Gifting',
    'Festivals',
  ],
};

const FESTIVE_EXTRA = [
  'Diwali',
  'Festivals',
  'Gifting',
  'Indian festivals',
  'Weddings',
];

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
  { re: /\b(veg|vegetarian|satvik)\b/i, interest: 'Vegetarianism' },
  { re: /\b(foodie|gourmet|delicious)\b/i, interest: 'Foodie' },
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
  if (/foods?\b|cuisine|grocery|organic|d2c.?food/.test(blob)) return 'food';
  return 'default';
}

function uniquePreserve(items: string[], max = 500): string[] {
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

function normalizeTiers(tiers?: CityTier[]): CityTier[] {
  const allowed: CityTier[] = ['tier1', 'tier2', 'tier3'];
  const picked = (tiers || []).filter((t): t is CityTier => allowed.includes(t));
  return picked.length ? uniquePreserve(picked, 3) as CityTier[] : [...DEFAULT_SALES_CITY_TIERS];
}

/** Merge cities for the selected India tiers (Tier 1 = 8, Tier 2 ≈ 97, Tier 3 = more). */
export function citiesFromTiers(tiers: CityTier[] = DEFAULT_SALES_CITY_TIERS): string[] {
  const selected = normalizeTiers(tiers);
  const cities: string[] = [];
  for (const t of selected) {
    cities.push(...CITY_TIER_META[t].cities);
  }
  return uniquePreserve(cities, 300);
}

export function citiesCsvFromTiers(tiers: CityTier[] = DEFAULT_SALES_CITY_TIERS): string {
  return citiesFromTiers(tiers).join(', ');
}

/**
 * Build recommended cities + interests. Cities follow selected tiers
 * (default Tier 1 + Tier 2 for Sales). Always returns editable CSV strings.
 */
export function suggestAudience(input: AudienceSuggestInput = {}): AudienceSuggestion {
  const rationale: string[] = [];
  const category = detectCategory(input);
  rationale.push(`Category detected: ${category}`);

  const cityTiers = normalizeTiers(input.cityTiers);
  const cities: string[] = [];
  if (input.libraryLocations?.length) {
    cities.push(...input.libraryLocations);
    rationale.push('Cities hinted from Ad Library ad metadata (when present)');
  }
  cities.push(...citiesFromTiers(cityTiers));
  rationale.push(
    `India city tiers: ${cityTiers
      .map((t) => `${CITY_TIER_META[t].label} (${CITY_TIER_META[t].cities.length})`)
      .join(' + ')}`
  );

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

  const citiesOut = uniquePreserve(cities, 300);
  const interestsOut = uniquePreserve(interests, 24);

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
    cityTiers,
  };
}

export function audienceSuggestionFromCompetitorIntel(opts: {
  brandName?: string | null;
  websiteUrl?: string | null;
  category?: string | null;
  cityTiers?: CityTier[];
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
    cityTiers: opts.cityTiers,
  });
}
