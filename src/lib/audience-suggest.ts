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
  /** Scraped store page text (title/description/h1) — drives interest prefill */
  websiteTexts?: string[];
  /** Catalog product names from the subscriber account */
  productNames?: string[];
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
  /** Extra Meta-style chips the user can click to add (not yet selected). */
  suggestedInterests: string[];
  source: string;
  rationale: string[];
  cityTiers: CityTier[];
  brandName?: string | null;
  category?: string | null;
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
    'Foodie',
    'Gifting',
    'Online shopping',
    'Shopping',
    'E-commerce',
    'Festivals',
    'Diwali',
    'Indian festivals',
    'Healthy eating',
  ],
  food: [
    'Indian cuisine',
    'Cooking',
    'Homemade food',
    'Foodie',
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
  { re: /\b(pickle|achar|aachar|chhundo|keri|mango|saurashtra)\b/i, interest: 'Indian cuisine' },
  { re: /\b(homemade|ghar|kitchen|nani|dadi|hand.?made|traditional)\b/i, interest: 'Homemade food' },
  { re: /\b(organic|natural|preservative.?free|chemical.?free)\b/i, interest: 'Organic food' },
  { re: /\b(gift|gifting|hamper|festival|diwali|ganpati|navratri)\b/i, interest: 'Gifting' },
  { re: /\b(spice|masala|chutney)\b/i, interest: 'Spices' },
  { re: /\b(snack|namkeen|makhana|chana)\b/i, interest: 'Snacks' },
  { re: /\b(cook|recipe|thali|meal|kitchen)\b/i, interest: 'Cooking' },
  { re: /\b(shop|buy|order|cart|offer|sale)\b/i, interest: 'Online shopping' },
  { re: /\b(beauty|skincare|serum)\b/i, interest: 'Beauty' },
  { re: /\b(fashion|kurti|saree|apparel)\b/i, interest: 'Fashion' },
  { re: /\b(veg|vegetarian|satvik)\b/i, interest: 'Vegetarianism' },
  { re: /\b(foodie|gourmet|delicious|tasty)\b/i, interest: 'Foodie' },
  { re: /\b(healthy|wellness)\b/i, interest: 'Healthy eating' },
  { re: /\b(wedding|shaadi)\b/i, interest: 'Weddings' },
];

/** Browse pool shown as Meta-style clickable chips (beyond selected). 50+ per food category. */
const FOOD_D2C_SUGGESTIONS = [
  'Indian cuisine',
  'Cooking',
  'Homemade food',
  'Organic food',
  'Foodie',
  'Gifting',
  'Spices',
  'Snacks',
  'Healthy eating',
  'Vegetarianism',
  'Festivals',
  'Diwali',
  'Indian festivals',
  'Weddings',
  'Online shopping',
  'Shopping',
  'E-commerce',
  'Recipes',
  'Baking',
  'Barbecue',
  'Breakfast',
  'Coffee',
  'Tea',
  'Chocolate',
  'Desserts',
  'Fast food',
  'Fine dining',
  'Food and drink',
  'Gourmet food',
  'Grocery shopping',
  'Health & wellness',
  'Luxury goods',
  'Motherhood',
  'Family',
  'Parenting',
  'Fitness and wellness',
  'Yoga',
  'Travel',
  'Vacations',
  'Online food ordering',
  'Restaurants',
  'Cuisine of India',
  'South Indian cuisine',
  'North Indian cuisine',
  'Gujarati cuisine',
  'Maharashtrian cuisine',
  'Punjabi cuisine',
  'Street food',
  'Comfort food',
  'Home cooking',
  'Meal planning',
  'Nutrition',
  'Veganism',
  'Ayurveda',
  'Natural foods',
  'Farmers markets',
  'Gardening',
  'Kitchen',
  'Cooking show',
  'Food blogging',
  'Instagram',
  'Facebook',
  'Discount stores',
  'Coupons',
  'Sales',
  'Retail therapy',
  'Luxury',
  'Lifestyle',
  'Culture',
  'Tradition',
  'India',
  'Hinduism',
  'Navratri',
  'Holi',
  'Raksha Bandhan',
  'Ganesh Chaturthi',
  'Christmas',
  'New Year',
  'Birthday',
  'Anniversary',
  'Gift baskets',
  'Online gift shops',
  'Amazon.com',
  'Flipkart',
  'Shopify',
  'Small business',
  'Entrepreneurship',
  'Women',
  'Men',
] as const;

const SUGGESTION_POOL: Record<string, string[]> = {
  pickles: [...FOOD_D2C_SUGGESTIONS],
  food: [...FOOD_D2C_SUGGESTIONS],
  snacks: [...FOOD_D2C_SUGGESTIONS, 'Potato chips', 'Popcorn', 'Nuts', 'Dried fruit'],
  spices: [...FOOD_D2C_SUGGESTIONS, 'Herbs', 'Seasoning', 'Curry'],
  fashion: [
    'Fashion', 'Clothing', 'Online shopping', 'Shopping', 'Gifting', 'Festivals', 'Weddings',
    'E-commerce', 'Apparel', 'Dresses', 'Shoes', 'Handbags', 'Jewelry', 'Jewellery', 'Accessories',
    'Luxury', 'Lifestyle', 'Beauty', 'Cosmetics', 'Skincare', 'Diwali', 'Indian festivals', 'Culture',
    'India', 'Women', 'Men', 'Family', 'Instagram', 'Facebook', 'Sales', 'Coupons', 'Retail therapy',
    'Boutique', 'Designer clothing', 'Street fashion', 'Casual wear', 'Formal wear', 'Ethnic wear',
    'Sari', 'Kurti', 'Wedding', 'Bridal', 'Motherhood', 'Parenting', 'Travel', 'Vacations',
    'Fitness and wellness', 'Yoga', 'Health & wellness', 'Shopping malls', 'Discount stores',
    'Amazon.com', 'Flipkart', 'Shopify', 'Small business', 'Entrepreneurship',
  ],
  beauty: [
    'Beauty', 'Skincare', 'Cosmetics', 'Makeup', 'Hair care', 'Organic products', 'Natural cosmetics',
    'Online shopping', 'Shopping', 'Gifting', 'E-commerce', 'Health & wellness', 'Fitness and wellness',
    'Yoga', 'Ayurveda', 'Fashion', 'Lifestyle', 'Luxury', 'Women', 'Men', 'Family', 'Motherhood',
    'Parenting', 'Diwali', 'Festivals', 'Weddings', 'Indian festivals', 'Instagram', 'Facebook',
    'Sales', 'Coupons', 'Retail therapy', 'Spa', 'Massage', 'Perfume', 'Fragrances', 'Nail care',
    'Anti-aging cream', 'Face cream', 'Serum', 'Sunscreen', 'Lipstick', 'Foundation', 'Amazon.com',
    'Flipkart', 'Shopify', 'Small business', 'Entrepreneurship', 'Travel', 'Vacations', 'Culture', 'India',
  ],
  jewellery: [
    'Jewellery', 'Jewelry', 'Fashion', 'Weddings', 'Gifting', 'Festivals', 'Online shopping', 'Shopping',
    'E-commerce', 'Luxury', 'Gold', 'Diamonds', 'Silver', 'Accessories', 'Bridal', 'Diwali',
    'Indian festivals', 'Culture', 'India', 'Women', 'Family', 'Anniversary', 'Birthday', 'Instagram',
    'Facebook', 'Sales', 'Coupons', 'Retail therapy', 'Lifestyle', 'Beauty', 'Clothing', 'Apparel',
    'Handbags', 'Watches', 'Amazon.com', 'Flipkart', 'Shopify', 'Small business', 'Entrepreneurship',
    'Travel', 'Vacations', 'Motherhood', 'Parenting', 'Navratri', 'Holi', 'Raksha Bandhan',
    'Ganesh Chaturthi', 'Christmas', 'New Year', 'Gift baskets', 'Online gift shops',
  ],
  default: [...FOOD_D2C_SUGGESTIONS],
};

/** Public helper — 50+ Meta-oriented interest chips for a category. */
export function interestSuggestionPool(category?: string | null): string[] {
  const key = (category || 'default').toLowerCase();
  const pack = SUGGESTION_POOL[key] || SUGGESTION_POOL.default;
  return uniquePreserve([...pack], 80);
}

function detectCategory(input: AudienceSuggestInput): string {
  const blob = [
    input.category,
    input.brandName,
    input.websiteUrl,
    ...(input.websiteTexts || []),
    ...(input.productNames || []),
    ...(input.competitorHooks || []),
    ...(input.libraryAdTexts || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/pickle|achar|aachar|chutney|keri|mango.?pickle/.test(blob)) return 'pickles';
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
 * Interests prioritize subscriber website + product catalog signals.
 */
export function suggestAudience(input: AudienceSuggestInput = {}): AudienceSuggestion {
  const rationale: string[] = [];
  const category = detectCategory(input);
  rationale.push(`Category detected: ${category}`);
  if (input.brandName) rationale.push(`Brand: ${input.brandName}`);

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
  const storeBlob = [
    ...(input.websiteTexts || []),
    ...(input.productNames || []),
    input.brandName || '',
    input.websiteUrl || '',
  ];
  const fromStore = interestsFromCopy(storeBlob);
  const fromCopy = interestsFromCopy([
    ...(input.libraryAdTexts || []),
    ...(input.competitorHooks || []),
  ]);
  if (fromStore.length) {
    rationale.push('Interests inferred from your store website / products');
  }
  if (fromCopy.length) {
    rationale.push('Interests inferred from competitor Ad Library copy');
  }
  if (input.competitorBrands?.length) {
    rationale.push(`Competitor brands referenced: ${input.competitorBrands.slice(0, 3).join(', ')}`);
  }

  // Store signals first, then competitor, then category pack (Organic only if mentioned)
  let interests = [...fromStore, ...fromCopy, ...pack];
  const storeText = storeBlob.join(' ').toLowerCase();
  const mentionsOrganic = /organic|natural|preservative.?free|chemical.?free/.test(storeText);
  if (!mentionsOrganic) {
    interests = interests.filter((i) => i.toLowerCase() !== 'organic food');
  } else if (!interests.some((i) => /organic/i.test(i))) {
    interests = ['Organic food', ...interests];
  }

  const festive =
    input.festive ||
    /ganpati|diwali|navratri|festive|festival/i.test(
      [
        ...(input.libraryAdTexts || []),
        ...(input.competitorHooks || []),
        ...(input.websiteTexts || []),
        ...(input.productNames || []),
        input.brandName || '',
      ].join(' ')
    );
  if (festive) {
    interests = [...FESTIVE_EXTRA, ...interests];
    rationale.push('Festive/gifting boost applied');
  }

  const citiesOut = uniquePreserve(cities, 300);
  const interestsOut = uniquePreserve(interests, 12);
  const pool = interestSuggestionPool(category);
  const selectedSet = new Set(interestsOut.map((i) => i.toLowerCase()));
  const suggestedInterests = uniquePreserve(
    [...pool, ...fromStore, ...fromCopy].filter((i) => !selectedSet.has(i.toLowerCase())),
    80
  );
  rationale.push(`${suggestedInterests.length}+ interest suggestions available to click`);

  return {
    cities: citiesOut,
    interests: interestsOut,
    citiesCsv: citiesOut.join(', '),
    interestsCsv: interestsOut.join(', '),
    suggestedInterests,
    source: input.websiteTexts?.length || input.productNames?.length
      ? 'subscriber_website'
      : input.libraryAdTexts?.length
        ? 'competitor_library'
        : input.competitorHooks?.length
          ? 'competitor_intel'
          : 'category_playbook',
    rationale,
    cityTiers,
    brandName: input.brandName || null,
    category,
  };
}

export function audienceSuggestionFromCompetitorIntel(opts: {
  brandName?: string | null;
  websiteUrl?: string | null;
  category?: string | null;
  websiteTexts?: string[];
  productNames?: string[];
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
    websiteTexts: opts.websiteTexts,
    productNames: opts.productNames,
    competitorBrands: opts.competitors.map((c) => c.brand).filter(Boolean) as string[],
    competitorHooks,
    libraryAdTexts,
    libraryLocations,
    cityTiers: opts.cityTiers,
  });
}
