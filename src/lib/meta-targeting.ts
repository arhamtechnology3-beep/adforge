/**
 * Resolve human-readable cities/interests to Meta targeting IDs.
 * Falls back gracefully when API is unavailable (demo / no token).
 */

const META_API_VERSION = 'v21.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Offline fallback only (no token). Prefer Targeting Search when a token exists —
 * fabricated/stale keys cause Meta geo conflicts.
 */
export const KNOWN_INDIAN_CITIES: Record<string, { key: string; name: string }> = {
  mumbai: { key: '2490299', name: 'Mumbai' },
  'delhi ncr': { key: '1028789', name: 'Delhi, India' },
  delhi: { key: '1028789', name: 'Delhi' },
  'new delhi': { key: '1028789', name: 'New Delhi' },
  bengaluru: { key: '2673300', name: 'Bengaluru' },
  bangalore: { key: '2673300', name: 'Bengaluru' },
  hyderabad: { key: '2425035', name: 'Hyderabad' },
  pune: { key: '2673538', name: 'Pune' },
  ahmedabad: { key: '1028806', name: 'Ahmedabad' },
  kolkata: { key: '2673651', name: 'Kolkata' },
  chennai: { key: '2673498', name: 'Chennai' },
  jaipur: { key: '1028831', name: 'Jaipur' },
  surat: { key: '1028853', name: 'Surat' },
};

export const KNOWN_INTERESTS: Record<string, { id: string; name: string }> = {
  'indian cuisine': { id: '6003397425735', name: 'Indian cuisine' },
  'organic food': { id: '6003397425735', name: 'Organic food' },
  'homemade food': { id: '6003397425735', name: 'Homemade food' },
  cooking: { id: '6003020834693', name: 'Cooking' },
  foodie: { id: '6003020834693', name: 'Foodie' },
  snacks: { id: '6003020834693', name: 'Snacks' },
  spices: { id: '6003020834693', name: 'Spices' },
  'online shopping': { id: '6002714395372', name: 'Online shopping' },
  shopping: { id: '6002714395372', name: 'Shopping' },
  'e-commerce': { id: '6002714395372', name: 'E-commerce' },
  gifting: { id: '6003020834693', name: 'Gift' },
  gift: { id: '6003020834693', name: 'Gift' },
  diwali: { id: '6003020834693', name: 'Diwali' },
  festivals: { id: '6003020834693', name: 'Festivals' },
  'indian festivals': { id: '6003020834693', name: 'Indian festivals' },
  'healthy eating': { id: '6002714395372', name: 'Healthy eating' },
  fashion: { id: '6003139266461', name: 'Fashion' },
  clothing: { id: '6003139266461', name: 'Clothing' },
  beauty: { id: '6002839664973', name: 'Beauty' },
  skincare: { id: '6002839664973', name: 'Skincare' },
  cosmetics: { id: '6002839664973', name: 'Cosmetics' },
  jewellery: { id: '6003139266461', name: 'Jewellery' },
  weddings: { id: '6003020834693', name: 'Weddings' },
  'health & wellness': { id: '6003020834693', name: 'Health & wellness' },
};

export type ResolvedTargeting = {
  cities: Array<{ key: string; name: string }>;
  interests: Array<{ id: string; name: string }>;
  unresolved_cities: string[];
  unresolved_interests: string[];
};

export async function searchMetaCity(
  accessToken: string,
  query: string,
  country = 'IN'
): Promise<{ key: string; name: string } | null> {
  try {
    const params = new URLSearchParams({
      type: 'adgeolocation',
      location_types: '["city"]',
      q: query,
      country_code: country,
      access_token: accessToken,
    });
    const res = await fetch(`${META_BASE}/search?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data.data?.[0];
    if (hit?.key) return { key: String(hit.key), name: hit.name || query };
    return null;
  } catch {
    return null;
  }
}

export async function searchMetaInterest(
  accessToken: string,
  query: string
): Promise<{ id: string; name: string } | null> {
  try {
    const params = new URLSearchParams({
      type: 'adinterest',
      q: query,
      access_token: accessToken,
    });
    const res = await fetch(`${META_BASE}/search?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data.data?.[0];
    if (hit?.id) return { id: String(hit.id), name: hit.name || query };
    return null;
  } catch {
    return null;
  }
}

function dedupeByKey<T extends { key?: string; id?: string }>(
  items: T[],
  field: 'key' | 'id'
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const v = String(item[field] || '');
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(item);
  }
  return out;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

/**
 * Resolve city/interest names to Meta IDs.
 * With a token: live Targeting Search only (never invent geo keys).
 * Without a token: offline metro/interest fallback for demos — Tier-2/3
 * cities stay as names until a Meta token can resolve them at launch.
 */
export async function resolveTargeting(
  locations: string[] = [],
  interests: string[] = [],
  accessToken?: string | null
): Promise<ResolvedTargeting> {
  const unresolved_cities: string[] = [];
  const unresolved_interests: string[] = [];

  const cityResults = await mapPool(locations, 8, async (loc) => {
    const key = loc.trim().toLowerCase();
    if (!key) return null;

    if (accessToken) {
      const found = await searchMetaCity(accessToken, loc.trim());
      if (found) return { ok: true as const, value: found };
      unresolved_cities.push(loc.trim());
      return null;
    }

    // Offline: only use curated metro keys — never fabricate Tier-2/3 keys
    if (KNOWN_INDIAN_CITIES[key]) {
      return { ok: true as const, value: KNOWN_INDIAN_CITIES[key] };
    }
    unresolved_cities.push(loc.trim());
    return null;
  });

  const interestResults = await mapPool(interests, 8, async (interest) => {
    const key = interest.trim().toLowerCase();
    if (!key) return null;

    if (accessToken) {
      const found = await searchMetaInterest(accessToken, interest.trim());
      if (found) return { ok: true as const, value: found };
      unresolved_interests.push(interest.trim());
      return null;
    }

    if (KNOWN_INTERESTS[key]) {
      return { ok: true as const, value: KNOWN_INTERESTS[key] };
    }
    unresolved_interests.push(interest.trim());
    return null;
  });

  const cities = dedupeByKey(
    cityResults.filter(Boolean).map((r) => r!.value),
    'key'
  );
  const resolvedInterests = dedupeByKey(
    interestResults.filter(Boolean).map((r) => r!.value),
    'id'
  );

  return {
    cities,
    interests: resolvedInterests,
    unresolved_cities,
    unresolved_interests,
  };
}

/**
 * Meta rejects overlapping geo levels (e.g. country IN + cities inside IN).
 * When cities are present, send cities only; otherwise countries.
 */
export function buildTargetingSpec(opts: {
  countries?: string[];
  age_min?: number;
  age_max?: number;
  genders?: number[];
  cities?: Array<{ key: string }>;
  interests?: Array<{ id: string }>;
  placements?: Record<string, string[]>;
}): Record<string, unknown> {
  const ageMin = Math.min(65, Math.max(13, Number(opts.age_min) || 18));
  const ageMax = Math.min(65, Math.max(ageMin, Number(opts.age_max) || 65));
  const countries =
    opts.countries && opts.countries.length > 0 ? opts.countries : ['IN'];

  const uniqueCities = dedupeByKey(opts.cities || [], 'key');
  const geo_locations: Record<string, unknown> =
    uniqueCities.length > 0
      ? { cities: uniqueCities.map((c) => ({ key: c.key })) }
      : { countries };

  const targeting: Record<string, unknown> = {
    geo_locations,
    age_min: ageMin,
    age_max: ageMax,
  };

  if (opts.genders?.length) targeting.genders = opts.genders;
  if (opts.interests?.length) {
    targeting.flexible_spec = [
      { interests: opts.interests.map((i) => ({ id: i.id })) },
    ];
  }

  if (opts.placements && Object.keys(opts.placements).length > 0) {
    Object.assign(targeting, opts.placements);
  }

  return targeting;
}
