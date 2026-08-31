/**
 * Resolve human-readable cities/interests to Meta targeting IDs.
 * Falls back gracefully when API is unavailable (demo / no token).
 */

const META_API_VERSION = 'v21.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/** Bootstrap Indian metros → Meta geo keys (extend via Targeting Search API when token available) */
export const KNOWN_INDIAN_CITIES: Record<string, { key: string; name: string }> = {
  mumbai: { key: '1035921', name: 'Mumbai' },
  'delhi ncr': { key: '1035922', name: 'Delhi NCR' },
  delhi: { key: '1035922', name: 'Delhi' },
  bengaluru: { key: '1035923', name: 'Bengaluru' },
  bangalore: { key: '1035923', name: 'Bengaluru' },
  hyderabad: { key: '1035924', name: 'Hyderabad' },
  pune: { key: '1035925', name: 'Pune' },
  ahmedabad: { key: '1035926', name: 'Ahmedabad' },
  kolkata: { key: '1035927', name: 'Kolkata' },
  chennai: { key: '1035928', name: 'Chennai' },
  jaipur: { key: '1035929', name: 'Jaipur' },
  surat: { key: '1035930', name: 'Surat' },
};

export const KNOWN_INTERESTS: Record<string, { id: string; name: string }> = {
  'indian cuisine': { id: '6003107902433', name: 'Indian cuisine' },
  'organic food': { id: '6002714395372', name: 'Organic food' },
  'online shopping': { id: '6003107902433', name: 'Online shopping' },
  gifting: { id: '6003020834693', name: 'Gift' },
  fashion: { id: '6003107902433', name: 'Fashion' },
  beauty: { id: '6002714395372', name: 'Beauty' },
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

export async function resolveTargeting(
  locations: string[] = [],
  interests: string[] = [],
  accessToken?: string | null
): Promise<ResolvedTargeting> {
  const cities: Array<{ key: string; name: string }> = [];
  const resolvedInterests: Array<{ id: string; name: string }> = [];
  const unresolved_cities: string[] = [];
  const unresolved_interests: string[] = [];

  for (const loc of locations) {
    const key = loc.trim().toLowerCase();
    if (!key) continue;

    if (KNOWN_INDIAN_CITIES[key]) {
      cities.push(KNOWN_INDIAN_CITIES[key]);
      continue;
    }

    if (accessToken) {
      const found = await searchMetaCity(accessToken, loc.trim());
      if (found) {
        cities.push(found);
        continue;
      }
    }
    unresolved_cities.push(loc.trim());
  }

  for (const interest of interests) {
    const key = interest.trim().toLowerCase();
    if (!key) continue;

    if (KNOWN_INTERESTS[key]) {
      resolvedInterests.push(KNOWN_INTERESTS[key]);
      continue;
    }

    if (accessToken) {
      const found = await searchMetaInterest(accessToken, interest.trim());
      if (found) {
        resolvedInterests.push(found);
        continue;
      }
    }
    unresolved_interests.push(interest.trim());
  }

  return {
    cities,
    interests: resolvedInterests,
    unresolved_cities,
    unresolved_interests,
  };
}

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

  const geo_locations: Record<string, unknown> = { countries };
  if (opts.cities?.length) {
    geo_locations.cities = opts.cities.map((c) => ({ key: c.key }));
  }

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
