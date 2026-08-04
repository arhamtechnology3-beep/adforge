export type CreativeFormat = 'feed_1x1' | 'story_9x16' | 'landscape_1_91';

/** Meta ad format types clients choose at review stage */
export type MetaAdFormat = 'single_image' | 'carousel' | 'stories' | 'video';

export const META_AD_FORMATS: Record<
  MetaAdFormat,
  {
    label: string;
    shortLabel: string;
    description: string;
    placement: string;
    aspect: string;
  }
> = {
  single_image: {
    label: 'Single Image',
    shortLabel: 'Image',
    description: 'Feed 1:1 still — best for offers & product focus',
    placement: 'Facebook & Instagram Feed',
    aspect: '1:1',
  },
  carousel: {
    label: 'Carousel',
    shortLabel: 'Carousel',
    description: '2–5 swipeable cards — best for catalogs & flavors',
    placement: 'Facebook & Instagram Feed',
    aspect: '1:1 cards',
  },
  stories: {
    label: 'Stories / Reels still',
    shortLabel: 'Stories',
    description: '9:16 vertical — Stories, Reels & Explore',
    placement: 'Stories & Reels',
    aspect: '9:16',
  },
  video: {
    label: 'Video (slideshow)',
    shortLabel: 'Video',
    description: 'Multi-frame motion preview — hooks attention in Feed/Reels',
    placement: 'Feed, Stories & Reels',
    aspect: '1:1 / 9:16',
  },
};

export const META_CREATIVE_SPECS: Record<
  CreativeFormat,
  { width: number; height: number; label: string; placement: string }
> = {
  feed_1x1: {
    width: 1080,
    height: 1080,
    label: 'Feed / Square',
    placement: 'Facebook & Instagram Feed',
  },
  story_9x16: {
    width: 1080,
    height: 1920,
    label: 'Stories / Reels',
    placement: 'Stories & Reels',
  },
  landscape_1_91: {
    width: 1200,
    height: 628,
    label: 'Landscape',
    placement: 'Right column / Link ads',
  },
};

/** Meta-friendly short headline (~40 chars recommended) — unique per ad copy */
export function extractHeadline(copyText: string, brand: string): string {
  const cleaned = copyText
    .replace(/[🔥😍⭐👀✨🛍️⏰😭🇮🇳]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Angle-specific hooks from THIS variant's copy (before shared product blurb)
  if (/festive offer/i.test(cleaned)) return 'Festive offer is live';
  if (/surprised me|homemade-premium|not gonna lie/i.test(cleaned)) return 'Homemade-premium taste';
  if (/everything else feels average|families across india trust/i.test(cleaned)) {
    return 'Families trust our pickles';
  }
  if (/selling fast|won't last the weekend/i.test(cleaned)) return 'Selling fast this weekend';
  if (/why choose/i.test(cleaned)) return `Why choose ${brand}`.slice(0, 42);
  if (/done with bland/i.test(cleaned)) return 'Done with bland pickles';
  if (/taste of tradition/i.test(cleaned)) return 'Taste of tradition';
  if (/compared /i.test(cleaned)) return 'Compared & chose authentic';
  if (/simple promise|no shortcuts/i.test(cleaned)) return 'Real pickles, no shortcuts';
  if (/loved by shoppers|join the community/i.test(cleaned)) return 'Loved across India';

  const lead =
    cleaned.split(/\.\s*100%\s*natural/i)[0]?.trim() ||
    cleaned.split(/\s*[—–]\s*100%\s*natural/i)[0]?.trim() ||
    cleaned.split(/[.!?]/)[0]?.trim() ||
    cleaned;

  let headline = lead
    .replace(new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-—,:!'"]*\\s*`, 'i'), '')
    .replace(/^(not gonna lie|okay but)[….!]*\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();

  if (headline.length < 8) headline = `${brand} — Shop Now`;
  if (headline.length > 42) headline = headline.slice(0, 39).replace(/\s+\S*$/, '') + '…';
  return headline.charAt(0).toUpperCase() + headline.slice(1);
}

/** Product line shown on creative — must match ad content */
export function extractSubline(copyText: string, category: string, brand: string): string {
  const flavors = copyText.match(
    /Chana Keri|Sweet Mango|Sweet Lime|Methia Keri|Garlic|Gunda Keri|Gor[- ]?Keri|Chhundo/gi
  );
  const unique = flavors ? [...new Set(flavors.map((f) => f.trim()))] : [];

  if (unique.length >= 2) {
    return unique.slice(0, 3).join(' · ');
  }
  if (unique.length === 1) {
    return `${unique[0]} · Authentic ${category || 'pickles'}`.slice(0, 55);
  }

  const natural = copyText.match(/100%\s*natural[^.]{0,60}|handmade[^.]{0,50}pickles?/i)?.[0];
  if (natural) {
    return natural.replace(/\bonline\b/gi, '').replace(/\s+/g, ' ').trim().slice(0, 55);
  }

  return `Authentic ${category || 'products'} by ${brand}`.slice(0, 55);
}

export function extractPrimaryText(copyText: string): string {
  return copyText.replace(/\s+/g, ' ').trim().slice(0, 220);
}

export function metaCtaForAngle(angle: string): string {
  const map: Record<string, string> = {
    'competitor-beat': 'Shop Now',
    'trending-ugc': 'Shop Now',
    'unboxing-pov': 'Learn More',
    'rating-social-proof': 'Shop Now',
    'stock-fomo': 'Shop Now',
    'clean-ingredient': 'Learn More',
    'festive-celebration': 'Shop Now',
    comparison: 'Learn More',
    'aesthetic-studio': 'Shop Now',
    'founder-craft': 'Learn More',
    'offer-led': 'Shop Now',
    'ugc-style': 'Learn More',
    testimonial: 'Shop Now',
    urgency: 'Shop Now',
    'benefit-led': 'Learn More',
    'problem-solution': 'Shop Now',
    lifestyle: 'Learn More',
    'founder-story': 'Learn More',
    'social-proof': 'Shop Now',
  };
  return map[angle] || 'Shop Now';
}

export function badgeForAngle(angle: string): string {
  const map: Record<string, string> = {
    'competitor-beat': 'WHY SWITCH TO US',
    'trending-ugc': '3 REASONS WHY',
    'unboxing-pov': 'POV UNBOXING',
    'rating-social-proof': '⭐ 4.9/5 RATED',
    'stock-fomo': 'RESTOCK ALERT',
    'clean-ingredient': '100% NATURAL',
    'festive-celebration': 'FESTIVE EDITION',
    comparison: 'COMPARE & CHOOSE',
    'aesthetic-studio': 'STUDIO SELECTION',
    'founder-craft': 'HANDMADE CRAFT',
    'offer-led': 'LIMITED OFFER',
    'ugc-style': 'REAL REVIEWS',
    testimonial: 'LOVED BY FAMILIES',
    urgency: 'SELLING FAST',
    'benefit-led': 'WHY US',
    'problem-solution': 'BETTER CHOICE',
    lifestyle: 'EVERYDAY INDIA',
    'founder-story': 'OUR STORY',
    'social-proof': 'TRUSTED IN INDIA',
  };
  return map[angle] || 'FEATURED';
}

export const ANGLE_PALETTES: Record<
  string,
  { bg: string; accent: string; text: string; muted: string; overlay: string }
> = {
  'competitor-beat': {
    bg: '#1e1b4b',
    accent: '#f59e0b',
    text: '#ffffff',
    muted: '#fef3c7',
    overlay: 'rgba(30,27,75,0.72)',
  },
  'trending-ugc': {
    bg: '#0f172a',
    accent: '#38bdf8',
    text: '#ffffff',
    muted: '#e0f2fe',
    overlay: 'rgba(15,23,42,0.72)',
  },
  'unboxing-pov': {
    bg: '#3b0764',
    accent: '#e879f9',
    text: '#ffffff',
    muted: '#fae8ff',
    overlay: 'rgba(59,7,100,0.72)',
  },
  'rating-social-proof': {
    bg: '#052e16',
    accent: '#4ade80',
    text: '#ffffff',
    muted: '#dcfce7',
    overlay: 'rgba(5,46,22,0.72)',
  },
  'stock-fomo': {
    bg: '#450a0a',
    accent: '#ef4444',
    text: '#ffffff',
    muted: '#fecaca',
    overlay: 'rgba(69,10,10,0.75)',
  },
  'clean-ingredient': {
    bg: '#14532d',
    accent: '#fbbf24',
    text: '#ffffff',
    muted: '#ecfccb',
    overlay: 'rgba(20,83,45,0.72)',
  },
  'festive-celebration': {
    bg: '#422006',
    accent: '#f97316',
    text: '#ffffff',
    muted: '#ffedd5',
    overlay: 'rgba(66,32,6,0.72)',
  },
  comparison: {
    bg: '#1c1917',
    accent: '#fb923c',
    text: '#ffffff',
    muted: '#ffedd5',
    overlay: 'rgba(28,25,23,0.72)',
  },
  'aesthetic-studio': {
    bg: '#1e1b4b',
    accent: '#a78bfa',
    text: '#ffffff',
    muted: '#ede9fe',
    overlay: 'rgba(30,27,75,0.72)',
  },
  'founder-craft': {
    bg: '#164e63',
    accent: '#2dd4bf',
    text: '#ffffff',
    muted: '#ccfbf1',
    overlay: 'rgba(22,78,99,0.72)',
  },
  'offer-led': {
    bg: '#1a1a2e',
    accent: '#f97316',
    text: '#ffffff',
    muted: '#ffedd5',
    overlay: 'rgba(26,26,46,0.72)',
  },
  'ugc-style': {
    bg: '#0f172a',
    accent: '#38bdf8',
    text: '#ffffff',
    muted: '#e0f2fe',
    overlay: 'rgba(15,23,42,0.7)',
  },
  testimonial: {
    bg: '#14532d',
    accent: '#fbbf24',
    text: '#ffffff',
    muted: '#ecfccb',
    overlay: 'rgba(20,83,45,0.72)',
  },
  urgency: {
    bg: '#450a0a',
    accent: '#ef4444',
    text: '#ffffff',
    muted: '#fecaca',
    overlay: 'rgba(69,10,10,0.75)',
  },
  'benefit-led': {
    bg: '#1e1b4b',
    accent: '#a78bfa',
    text: '#ffffff',
    muted: '#ede9fe',
    overlay: 'rgba(30,27,75,0.72)',
  },
  'problem-solution': {
    bg: '#164e63',
    accent: '#2dd4bf',
    text: '#ffffff',
    muted: '#ccfbf1',
    overlay: 'rgba(22,78,99,0.72)',
  },
  lifestyle: {
    bg: '#3b0764',
    accent: '#e879f9',
    text: '#ffffff',
    muted: '#fae8ff',
    overlay: 'rgba(59,7,100,0.72)',
  },
  'founder-story': {
    bg: '#422006',
    accent: '#d97706',
    text: '#ffffff',
    muted: '#fef3c7',
    overlay: 'rgba(66,32,6,0.72)',
  },
  'social-proof': {
    bg: '#052e16',
    accent: '#4ade80',
    text: '#ffffff',
    muted: '#dcfce7',
    overlay: 'rgba(5,46,22,0.72)',
  },
};

/** Shopify / CDN URLs can be resized with width= — keeps creatives under cache limits */
export function optimizeProductImageUrl(raw: string, width = 1080): string {
  try {
    const u = new URL(raw);
    const isShopify =
      u.hostname.includes('shopify') ||
      u.pathname.includes('/cdn/shop/') ||
      /\/cdn\/shop\//.test(raw);
    if (isShopify) {
      u.searchParams.set('width', String(width));
      // @vercel/og / Satori cannot decode WebP — force JPEG from Shopify CDN
      if (/\.webp(\?|$)/i.test(u.pathname) || u.searchParams.get('format') === 'webp') {
        u.searchParams.set('format', 'jpg');
      } else if (!u.searchParams.has('format')) {
        u.searchParams.set('format', 'jpg');
      }
      return u.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

/** Free product scene matched to category/ad content (used when site photo missing) */
export function productSceneUrl(category: string, angle: string, seed: number): string {
  const isPickle = /pickle/i.test(category);
  const prompt = isPickle
    ? `aesthetic indian food studio backdrop, rustic wooden table with sun-drenched warm lighting, festive brass utensils and thali decor, commercial food photography background, shallow depth of field, blurred background for product placement, no text`
    : `premium ${category} D2C brand commercial studio backdrop, minimal aesthetic pedestal with soft studio light and clean podium, blurred background for product hero placement, 8k ecommerce ad photo, no text`;

  const params = new URLSearchParams({
    width: '1080',
    height: '1080',
    nologo: 'true',
    seed: String(seed),
  });

  const angleHint =
    angle === 'trending-ugc' || angle === 'unboxing-pov'
      ? ', cozy lifestyle home aesthetic'
      : angle === 'festive-celebration'
        ? ', indian festival lights and marigold accents'
        : angle === 'clean-ingredient'
          ? ', fresh natural leaves and rustic sunlit wood'
          : angle === 'aesthetic-studio'
            ? ', sleek pastel studio spotlight'
            : ', high end commercial advertising backdrop';

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + angleHint)}?${params}`;
}

export function buildCreativeUrl(params: {
  baseUrl: string;
  brand: string;
  headline: string;
  subline: string;
  angle: string;
  cta: string;
  badge: string;
  productImage?: string | null;
  sceneImage?: string | null;
  format?: CreativeFormat;
  adFormat?: MetaAdFormat;
  variant?: number;
}): string {
  const q = new URLSearchParams({
    brand: params.brand.slice(0, 60),
    headline: params.headline.slice(0, 60),
    subline: params.subline.slice(0, 70),
    angle: params.angle,
    cta: params.cta,
    badge: params.badge,
    format: params.format || 'feed_1x1',
    v: String(params.variant || 1),
  });
  if (params.productImage) q.set('img', params.productImage);
  if (params.sceneImage) q.set('scene', params.sceneImage);
  if (params.adFormat) q.set('ad_format', params.adFormat);
  return `${params.baseUrl}/api/ads/creative?${q.toString()}`;
}
