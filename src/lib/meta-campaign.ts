/**
 * Meta campaign types, objective mapping, and placement builders.
 * Every UI field in the campaign wizard maps to a real Marketing API parameter.
 */

export const CAMPAIGN_OBJECTIVES = [
  {
    value: 'OUTCOME_TRAFFIC',
    label: 'Traffic',
    description: 'Send people to your website or store',
    icon: 'link',
    optimization_goal: 'LINK_CLICKS',
    billing_event: 'IMPRESSIONS',
  },
  {
    value: 'OUTCOME_SALES',
    label: 'Sales',
    description: 'Drive purchases (Meta Pixel recommended)',
    icon: 'cart',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    billing_event: 'IMPRESSIONS',
  },
  {
    value: 'OUTCOME_AWARENESS',
    label: 'Brand Awareness',
    description: 'Reach more people who remember your brand',
    icon: 'eye',
    optimization_goal: 'REACH',
    billing_event: 'IMPRESSIONS',
  },
  {
    value: 'OUTCOME_ENGAGEMENT',
    label: 'Engagement',
    description: 'Get more likes, comments, and shares',
    icon: 'heart',
    optimization_goal: 'POST_ENGAGEMENT',
    billing_event: 'IMPRESSIONS',
  },
] as const;

export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number]['value'];

export const META_CTA_OPTIONS = [
  { value: 'SHOP_NOW', label: 'Shop Now' },
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'ORDER_NOW', label: 'Order Now' },
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'BOOK_NOW', label: 'Book Now' },
  { value: 'GET_OFFER', label: 'Get Offer' },
  { value: 'CONTACT_US', label: 'Contact Us' },
] as const;

/** Website-traffic CTAs only (Shopify / store URLs). WhatsApp is out of scope. */
export const WEBSITE_CTA_VALUES = META_CTA_OPTIONS.map((c) => c.value);

export function normalizeWebsiteCta(raw: string | null | undefined): string {
  const cta = String(raw || 'SHOP_NOW')
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (cta === 'WHATSAPP_MESSAGE' || cta === 'WHATSAPP' || cta === 'MESSAGE_PAGE') {
    return 'SHOP_NOW';
  }
  return (WEBSITE_CTA_VALUES as readonly string[]).includes(cta) ? cta : 'SHOP_NOW';
}

export function isHttpsWebsiteUrl(url: string | null | undefined): boolean {
  const u = String(url || '').trim();
  if (!/^https:\/\/.+/i.test(u)) return false;
  try {
    const parsed = new URL(u);
    return Boolean(parsed.hostname) && parsed.hostname !== 'example.com';
  } catch {
    return false;
  }
}

export type PlacementToggles = {
  reels: boolean;
  ig_feed: boolean;
  fb_feed: boolean;
  stories: boolean;
};

export type CampaignAudienceInput = {
  countries?: string[];
  age_min?: number;
  age_max?: number;
  gender?: 'ALL' | 'MEN' | 'WOMEN';
  locations?: string[];
  interests?: string[];
  placements?: PlacementToggles;
  start_date?: string | null;
  end_date?: string | null;
  cta?: string;
  link_description?: string | null;
};

export type CampaignLaunchInput = {
  name: string;
  objective: string;
  budget: number;
  budget_type?: 'daily' | 'lifetime';
  website_url: string;
  ad_ids: string[];
  cta?: string;
  audience?: CampaignAudienceInput;
  is_draft?: boolean;
};

export function getObjectiveConfig(objective: string) {
  return (
    CAMPAIGN_OBJECTIVES.find((o) => o.value === objective) || CAMPAIGN_OBJECTIVES[0]
  );
}

export function genderToMetaGenders(gender?: string): number[] | undefined {
  if (gender === 'MEN') return [1];
  if (gender === 'WOMEN') return [2];
  return undefined;
}

/** Map UI placement toggles → Meta publisher_platforms + position arrays */
export function buildPlacementSpec(placements?: PlacementToggles): Record<string, string[]> {
  if (!placements) return {};

  const publisher_platforms: string[] = [];
  const facebook_positions: string[] = [];
  const instagram_positions: string[] = [];

  if (placements.fb_feed) {
    publisher_platforms.push('facebook');
    facebook_positions.push('feed');
  }
  if (placements.stories) {
    if (!publisher_platforms.includes('facebook')) publisher_platforms.push('facebook');
    if (!publisher_platforms.includes('instagram')) publisher_platforms.push('instagram');
    facebook_positions.push('story');
    instagram_positions.push('story');
  }
  if (placements.ig_feed) {
    if (!publisher_platforms.includes('instagram')) publisher_platforms.push('instagram');
    instagram_positions.push('stream');
  }
  if (placements.reels) {
    if (!publisher_platforms.includes('instagram')) publisher_platforms.push('instagram');
    instagram_positions.push('reels');
  }

  const allOff = !placements.reels && !placements.ig_feed && !placements.fb_feed && !placements.stories;
  if (allOff || publisher_platforms.length === 0) return {};

  const spec: Record<string, string[]> = { publisher_platforms };
  if (facebook_positions.length) spec.facebook_positions = [...new Set(facebook_positions)];
  if (instagram_positions.length) spec.instagram_positions = [...new Set(instagram_positions)];
  return spec;
}

export function buildScheduleTimes(audience?: CampaignAudienceInput): {
  start_time?: string;
  end_time?: string;
} {
  const result: { start_time?: string; end_time?: string } = {};
  if (audience?.start_date) {
    const start = new Date(`${audience.start_date}T00:00:00+05:30`);
    if (!Number.isNaN(start.getTime())) result.start_time = start.toISOString();
  }
  if (audience?.end_date) {
    const end = new Date(`${audience.end_date}T23:59:59+05:30`);
    if (!Number.isNaN(end.getTime())) result.end_time = end.toISOString();
  }
  return result;
}
