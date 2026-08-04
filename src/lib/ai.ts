import OpenAI from 'openai';
import { optimizeProductImageUrl } from '@/lib/creatives';

export interface MetaAdLibraryAd {
  id: string;
  library_id: string;
  ad_format: 'single_image' | 'carousel' | 'video';
  primary_text: string;
  headline: string;
  cta: string;
  active_status: 'ACTIVE' | 'UNKNOWN';
  started_date: string | null;
  publisher_platforms: string[];
  /** Only set when media is a real Ad Library / uploaded creative — never website packshots */
  media_url?: string | null;
  /** Official Library snapshot / detail URL */
  snapshot_url?: string | null;
  has_multiple_versions?: boolean;
  /** Provenance — never claim scraped Meta spend/targeting without API */
  source: 'ad_library_api' | 'web_library' | 'manual' | 'none';

  // Optional AI / Library ranking signals (never claim commercial spend as scraped fact)
  performance_rating?: 'WINNER' | 'SCALING' | 'TESTING';
  performance_score?: number;
  performance_label?: string | null;
  performance_reason?: string | null;
  library_rank?: number | null;
  runtime_days?: number | null;
  /** Seconds of active delivery from Library GraphQL when present */
  total_active_time?: number | null;
  estimated_monthly_budget?: string | null;
  recommended_daily_budget?: number | null;
  target_locations?: string[];
  target_devices?: string[];
  target_placements?: string[];
  target_demographics?: string | null;
  winning_strategy_hook?: string | null;
}

export interface CompetitorIntel {
  url: string;
  domain: string;
  brand: string;
  title: string;
  description: string;
  hook: string;
  /** Website og/product image — for strategy context only, NOT Meta ad creative */
  image: string | null;
  positioning: string;
  counterAngle: string;
  meta_ad_library_url: string;
  meta_ads_count: number;
  live_meta_ads: MetaAdLibraryAd[];
  /** How website intel was obtained */
  website_scrape_ok: boolean;
  /** Page ID used for Library fetch (if any) */
  meta_page_id?: string | null;
  /** Fetch method / status note for UI */
  library_fetch_note?: string | null;
}

const AD_ANGLES = [
  { angle: 'competitor-beat', description: 'Side-by-side comparison: Our authentic batch vs competitor brands' },
  { angle: 'trending-ugc', description: '3 Reasons Why D2C shoppers switch (Viral UGC Reel Trend)' },
  { angle: 'unboxing-pov', description: 'POV unboxing & first taste reaction trend' },
  { angle: 'rating-social-proof', description: '4.9★ rating & 10,000+ verified customer reviews' },
  { angle: 'stock-fomo', description: 'Restock alert: Sold out 3x (Urgency trend)' },
  { angle: 'clean-ingredient', description: '100% natural, sun-dried & zero preservatives' },
  { angle: 'festive-celebration', description: 'Festive season celebration offer & thali pairing' },
  { angle: 'comparison', description: 'Clean comparison: Authentic batch vs mass market' },
  { angle: 'aesthetic-studio', description: 'Aesthetic minimalist studio product spotlight' },
  { angle: 'founder-craft', description: 'Handmade traditional recipe & founder heritage story' },
  { angle: 'offer-led', description: 'High-converting discount & bundle deal trend' },
];

const NOISE_PHRASES = [
  /^buy online$/i,
  /^shop now$/i,
  /^home$/i,
  /^welcome$/i,
  /^official (website|store)$/i,
  /^add to cart$/i,
  /^best seller(s)?$/i,
];

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNoise(text: string): boolean {
  const t = text.trim();
  if (t.length < 3 || t.length > 160) return true;
  return NOISE_PHRASES.some((re) => re.test(t));
}

export async function scrapeWebsite(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(12000),
    });
    const html = await res.text();

    const pick = (...patterns: RegExp[]) => {
      for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) {
          const cleaned = cleanText(m[1]);
          if (cleaned && !isNoise(cleaned)) return cleaned;
        }
      }
      return '';
    };

    const title = pick(
      /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
      /<title[^>]*>([^<]+)<\/title>/i
    );
    const description = pick(
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
    );
    const h1 = pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch {
        return '';
      }
    })();

    return [title, description, h1, host ? `site:${host}` : '']
      .filter(Boolean)
      .join(' | ')
      .slice(0, 600);
  } catch {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return `Brand from ${host} | Authentic products for Indian shoppers | site:${host}`;
    } catch {
      return `Website: ${url}`;
    }
  }
}

function scoreProductImageCandidate(src: string): number {
  const s = src.toLowerCase();
  if (
    /banner|hero_banner|slider|logo|icon|cursor|favicon|sprite|placeholder|fssai|google|ministry|accelerator|startup|award|press|blogger/i.test(
      s
    )
  ) {
    return -100;
  }
  let score = 10;
  if (/_\d+x\d+_crop_center|600x600|1080x1080|product/i.test(s)) score += 50;
  if (/600x600/i.test(s)) score += 20;
  if (/pickle|keri|mango|chhundo|gunda|aachar|jar|pack|chana|bottle|spices|food|thali/i.test(s)) score += 40;
  if (/cdn\/shop\/files\//i.test(s) || /cdn\/shop\/products\//i.test(s)) score += 20;
  if (/back/i.test(s)) score -= 25;
  if (/whatsapp|instagram/i.test(s)) score -= 10;
  return score;
}

/**
 * Pull real product photos from the brand website (not marketing banners).
 * Returns up to `limit` optimized URLs for rotating across ad variants.
 */
export async function scrapeWebsiteImages(url: string, limit = 8): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(12000),
    });
    const html = await res.text();
    const found = new Set<string>();

    const push = (raw: string | undefined) => {
      if (!raw) return;
      try {
        let absolute = raw.startsWith('http') ? raw : new URL(raw, url).toString();
        // Drop responsive width query only; keep Shopify crop filenames intact
        absolute = absolute.replace(/([?&])width=\d+/gi, '$1').replace(/[?&]$/, '');
        if (!/\.(png|jpe?g|webp|gif)(\?|$)/i.test(absolute)) return;
        // Skip tiny theme icons
        if (/_\d{1,3}x(@2x)?\.(png|jpe?g|webp)/i.test(absolute) && !/crop_center/i.test(absolute)) {
          return;
        }
        found.add(absolute);
      } catch {
        /* skip */
      }
    };

    const og =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1];
    push(og);

    for (const m of html.matchAll(
      /(?:src|data-src|data-srcset|content)=["']([^"']*cdn\/shop\/[^"']+\.(?:png|jpe?g|webp)[^"']*)["']/gi
    )) {
      const part = m[1].split(/[,\s]/)[0];
      push(part);
    }

    // Prefer 600x600 product crops when present in HTML
    for (const m of html.matchAll(
      /(https?:\/\/[^"'\s]+|\/cdn\/shop\/[^"'\s]+)(_\d+x\d+_crop_center\.(?:png|jpe?g|webp)[^"'\s]*)/gi
    )) {
      push(m[1] + m[2]);
    }

    const ranked = [...found]
      .map((src) => ({ src, score: scoreProductImageCandidate(src) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const out: string[] = [];
    const seenBase = new Set<string>();
    for (const { src } of ranked) {
      const base = src
        .replace(/_\d+x\d+_crop_center/i, '')
        .replace(/\?.*$/, '')
        .toLowerCase();
      if (seenBase.has(base)) continue;
      seenBase.add(base);
      out.push(optimizeProductImageUrl(src, 1080));
      if (out.length >= limit) break;
    }

    // Last resort: resized og image if nothing better
    if (out.length === 0 && og) {
      const absolute = og.startsWith('http') ? og : new URL(og, url).toString();
      out.push(optimizeProductImageUrl(absolute, 1080));
    }

    return out;
  } catch {
    return [];
  }
}

/** Pull a single best product image from the brand website */
export async function scrapeWebsiteImage(url: string): Promise<string | null> {
  const images = await scrapeWebsiteImages(url, 1);
  return images[0] || null;
}

export type ScrapeCompetitorOpts = {
  metaPageId?: string | null;
  /** Fetch live creatives from Meta Ad Library (Playwright / official API). Default false for fast loads. */
  fetchLiveAds?: boolean;
  country?: string;
  searchTerms?: string | null;
};

/** Scrape competitor website for brand/hooks. Optionally fetch real Meta Ad Library ads (no invented spend). */
export async function scrapeCompetitorIntel(
  url: string,
  opts: ScrapeCompetitorOpts = {}
): Promise<CompetitorIntel> {
  const { resolveMetaPageId, buildAdLibraryUrl, fetchCompetitorLiveAds } = await import(
    '@/lib/meta-ad-library'
  );

  let domain = 'competitor';
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* fallback */
  }

  const brandFromDomain = domain.split('.')[0];
  const capitalized =
    brandFromDomain.charAt(0).toUpperCase() + brandFromDomain.slice(1);
  const pageId = resolveMetaPageId({
    domain,
    url,
    metaPageId: opts.metaPageId,
  });

  const emptyLibraryUrl = buildAdLibraryUrl({
    pageId,
    searchTerms: pageId ? null : capitalized,
    country: opts.country || 'IN',
    publisherPlatform: 'instagram',
    sortByImpressions: true,
  });

  const attachLiveAds = async (base: CompetitorIntel): Promise<CompetitorIntel> => {
    if (!opts.fetchLiveAds) {
      return {
        ...base,
        meta_page_id: pageId,
        meta_ad_library_url: pageId
          ? buildAdLibraryUrl({
              pageId,
              country: opts.country || 'IN',
              publisherPlatform: 'instagram',
              sortByImpressions: true,
            })
          : base.meta_ad_library_url,
        library_fetch_note: pageId
          ? 'Live Meta ads not loaded yet — open Meta Ad Library tab to fetch.'
          : 'Add Meta Page ID (from Ad Library URL page_ids) to fetch live competitor ads.',
      };
    }

    const libraryResult = await fetchCompetitorLiveAds({
      pageId,
      searchTerms: opts.searchTerms || (!pageId ? base.brand : null),
      country: opts.country || 'IN',
      publisherPlatform: 'instagram',
      sortByImpressions: true,
      limit: 20,
    });

    return {
      ...base,
      meta_page_id: pageId,
      meta_ad_library_url: libraryResult.libraryUrl || base.meta_ad_library_url,
      live_meta_ads: libraryResult.ads,
      meta_ads_count: libraryResult.ads.length,
      library_fetch_note:
        libraryResult.note ||
        libraryResult.error ||
        (libraryResult.ads.length
          ? `Loaded ${libraryResult.ads.length} live ads via ${libraryResult.method}`
          : null),
    };
  };

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();

    const title =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      domain;

    const description =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      '';

    const image =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1] ||
      null;

    const cleanTitleText = cleanText(title);
    const cleanDescText = cleanText(description);

    const brand =
      cleanTitleText
        .split(/[-–—|·:]/)
        .map((p) => p.trim())
        .find(
          (part) =>
            part.length > 1 &&
            !/homemade|indian|pickles|chutneys|official|store|shop|online|buy|welcome/i.test(part)
        ) || capitalized;

    const libraryUrl = buildAdLibraryUrl({
      pageId,
      searchTerms: pageId ? null : brand,
      country: opts.country || 'IN',
      publisherPlatform: 'instagram',
      sortByImpressions: true,
    });

    const positioning = /shark tank/i.test(cleanTitleText + ' ' + cleanDescText)
      ? 'Mentions Shark Tank / TV social proof on site'
      : /bihari|mithila/i.test(cleanTitleText + ' ' + cleanDescText)
        ? 'Regional / traditional positioning on site'
        : /gourmet|organic|natural/i.test(cleanTitleText + ' ' + cleanDescText)
          ? 'Premium / natural positioning on site'
          : `Website competitor · ${domain}`;

    const counterAngle = /shark tank/i.test(cleanTitleText + ' ' + cleanDescText)
      ? `Outperform ${brand}'s TV hype with authentic product proof and clear differentiators.`
      : `Beat ${brand} with stronger product proof, offer clarity, and founder-trust angles.`;

    const productImages = await scrapeWebsiteImages(url, 1);
    const mainImg =
      productImages[0] ||
      (image ? (image.startsWith('http') ? image : new URL(image, url).toString()) : null);

    return attachLiveAds({
      url,
      domain,
      brand,
      title: cleanTitleText,
      description: cleanDescText,
      hook: cleanDescText.slice(0, 140) || cleanTitleText.slice(0, 140),
      image: mainImg,
      positioning,
      counterAngle,
      meta_ad_library_url: libraryUrl,
      meta_ads_count: 0,
      live_meta_ads: [],
      website_scrape_ok: true,
      meta_page_id: pageId,
    });
  } catch {
    return attachLiveAds({
      url,
      domain,
      brand: capitalized,
      title: `${domain} official store`,
      description: '',
      hook: 'Competitor site could not be scraped — open Meta Ad Library for live ads.',
      image: null,
      positioning: `Website scrape failed · ${domain}`,
      counterAngle: `Review ${capitalized} live ads in Meta Ad Library, then generate counter-creatives from your product.`,
      meta_ad_library_url: emptyLibraryUrl,
      meta_ads_count: 0,
      live_meta_ads: [],
      website_scrape_ok: false,
      meta_page_id: pageId,
    });
  }
}

export async function scrapeAllCompetitors(
  competitors: Array<{ url: string; type: string; meta_page_id?: string | null }>,
  opts: { fetchLiveAds?: boolean } = {}
): Promise<CompetitorIntel[]> {
  if (!Array.isArray(competitors) || competitors.length === 0) return [];
  const results = await Promise.all(
    competitors.slice(0, 3).map((c) =>
      scrapeCompetitorIntel(c.url, {
        metaPageId: c.meta_page_id,
        fetchLiveAds: opts.fetchLiveAds === true,
      })
    )
  );
  return results;
}

export function extractBrandContext(websiteContent: string, websiteUrl?: string): {
  brand: string;
  category: string;
  hook: string;
} {
  const parts = websiteContent
    .split('|')
    .map((p) => cleanText(p))
    .filter((p) => p && !p.startsWith('site:') && !isNoise(p));

  const sitePart = websiteContent.match(/site:([^\s|]+)/)?.[1] || '';
  let hostBrand = '';
  if (websiteUrl) {
    try {
      hostBrand = new URL(websiteUrl).hostname
        .replace(/^www\./, '')
        .split('.')[0]
        .replace(/[-_]/g, ' ');
    } catch {
      hostBrand = '';
    }
  }
  if (!hostBrand && sitePart) {
    hostBrand = sitePart.split('.')[0].replace(/[-_]/g, ' ');
  }

  const rawTitle = parts[0] || hostBrand || 'Your Brand';
  // Split on hyphen, en-dash, em-dash, pipe, colon, middle dot
  const brand = rawTitle
    .split(/\s*[-–—|·:]\s*/)[0]
    .replace(/\b(official|store|shop|india|home|online)\b/gi, '')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 48) || hostBrand || 'Your Brand';

  const categoryHint = rawTitle
    .split(/\s*[-–—|·:]\s*/)
    .slice(1)
    .join(' ')
    .trim();

  const description = parts.find((p) => p !== parts[0] && p.length > 20) || '';
  // Detect category from description / title
  const category =
    (description + ' ' + categoryHint).match(
      /\b(pickles?|foods?|snacks?|fashion|skincare|beauty|electronics|jewellery|jewelry|home|grocery|organic|spices?|apparel|footwear)\b/i
    )?.[1] ||
    categoryHint ||
    'products';

  // Prefer a shorter product-focused category label
  const categoryLabel = /pickle/i.test(String(category))
    ? 'pickles'
    : String(category).toLowerCase();

  const rawDesc = description || categoryHint || '';
  let hook = rawDesc;

  // Aggressive cleanup of CTA / storefront phrasing from scraped meta text
  hook = hook
    .replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '')
    .replace(/\b(buy|shop|order|get|discover|explore)\s+(online\s*)?/gi, '')
    .replace(/\bonline\b/gi, '')
    .replace(/\s*Taste like B[^.]*\.?/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s—–\-:|]+/, '')
    .replace(/[\s—–\-:|]+$/, '')
    .trim();

  if (/pickle/i.test(rawDesc + ' ' + categoryLabel)) {
    const flavors = rawDesc.match(/Chana Keri|Sweet Mango|Sweet Lime|Methia Keri|Garlic/gi);
    const flavorBit = flavors?.length
      ? ` — ${[...new Set(flavors)].slice(0, 3).join(', ')} & more`
      : '';
    hook = `100% natural handmade Saurashtra pickles${flavorBit}`;
  } else if (hook.length > 100) {
    hook = hook.slice(0, 97).replace(/\s+\S*$/, '') + '…';
  }

  if (!hook || isNoise(hook) || hook.length < 12) {
    hook = `authentic ${categoryLabel} loved across India`;
  }

  return { brand, category: categoryLabel, hook };
}

/** Free offline ad copy — no API key or credits required */
export function generateFreeAdCopy(
  websiteContent: string,
  competitors: Array<{ url: string; type: string }> = [],
  websiteUrl?: string
): Array<{ variant_number: number; copy_text: string; angle: string }> {
  const { brand, category, hook } = extractBrandContext(websiteContent, websiteUrl);
  const competitorHint =
    competitors.find((c) => c.type === 'website')?.url || competitors[0]?.url || null;
  const competitorHost = competitorHint
    ? competitorHint.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    : null;

  const templates: Record<string, string> = {
    'competitor-beat': competitorHost
      ? `Switched from ${competitorHost.split('.')[0]} to ${brand}? Here's why thousands of shoppers are making the move: 100% sun-dried Saurashtra mangos, 0 artificial acidity, and real homemade taste. ${hook} 🏆`
      : `Why compare when you can get authentic? ${brand} delivers 100% sun-dried ${category.toLowerCase()} with 0 preservatives. Better taste, honest ingredients.`,
    'trending-ugc': `3 reasons why everyone is ordering ${brand}'s ${category.toLowerCase()}: 1️⃣ Traditional authentic recipe 2️⃣ ${hook} 3️⃣ Unmatched taste. Try it once and you won't go back! 🔥`,
    'unboxing-pov': `POV: You finally unboxed your ${brand} order 😍 Smells like home, tastes like pure nostalgia. ${hook}. Get yours today before stocks clear 🛍️`,
    'rating-social-proof': `"Hands down the best ${category.toLowerCase()} I've ordered online!" ⭐⭐⭐⭐⭐ Over 10,000+ happy Indian families trust ${brand}. ${hook}. Order your batch today!`,
    'stock-fomo': `🚨 RESTOCK ALERT! ${brand}'s best-selling ${category.toLowerCase()} is back after selling out 3x. ${hook}. Grab your jar before stocks clear again ⏰`,
    'clean-ingredient': `Zero preservatives. Zero shortcuts. 100% authentic sun-dried & handmade ${category.toLowerCase()} by ${brand}. ${hook}. Taste pure tradition 🌿`,
    'festive-celebration': `Bring festival warmth & authentic taste to your table with ${brand}. ${hook}. Special festive offer live — shop now! ✨`,
    'comparison': competitorHost
      ? `Compared ${competitorHost} and still came back to ${brand}. Reason: ${hook}. Choose authentic over average.`
      : `Skip the generic aisle. ${brand} stands out with ${hook}. Taste the difference yourself.`,
    'aesthetic-studio': `Crafted for true food lovers. ${brand} delivers ${hook}. Elevate every meal with authentic Indian taste 🍽️`,
    'founder-craft': `Started in a home kitchen with a simple promise: real ${category.toLowerCase()}, no compromise. Today ${brand} brings ${hook} straight to your doorstep 🏡`,
    'offer-led': `🔥 ${brand} special bundle deal! Get ${hook}. Free delivery on orders today — shop authentic ${category.toLowerCase()} now 🎁`,
    // Legacy fallbacks
    'ugc-style': `Not gonna lie… ${brand} surprised me 😍 Tried their ${category.toLowerCase()} and the quality feels homemade-premium. ${hook}. Linking before it sells out 👀`,
    'testimonial': `"Once you try ${brand}, everything else feels average." Families across India trust our ${category.toLowerCase()}. ${hook} ⭐`,
    'urgency': `⏰ Selling fast! ${brand}'s best ${category.toLowerCase()} won't last the weekend. ${hook}. Order today.`,
    'benefit-led': `Why choose ${brand}? You get ${hook}. Honest ingredients, careful sourcing, and delivery across India.`,
    'problem-solution': `Done with bland, mass-market ${category.toLowerCase()}? ${brand} brings ${hook}. One switch — better taste.`,
    'lifestyle': `Bring home the taste of tradition with ${brand}. ${hook}. Perfect for modern Indian kitchens and celebrations ✨`,
    'founder-story': `${brand} started with a simple promise — real ${category.toLowerCase()}, no shortcuts. Today that means ${hook}. Try what families already love.`,
    'social-proof': `Loved by shoppers across India 🇮🇳 ${brand} — ${hook}. High reorders. Honest reviews. Join the community.`,
  };

  return AD_ANGLES.map((a, i) => ({
    variant_number: i + 1,
    copy_text: templates[a.angle] || `${brand}: ${hook}`,
    angle: a.angle,
  }));
}

async function generateWithGroq(
  websiteContent: string,
  competitors: Array<{ url: string; type: string }>
): Promise<Array<{ variant_number: number; copy_text: string; angle: string }> | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const competitorBlock =
    competitors.length > 0
      ? `Competitors:\n${competitors.map((c, i) => `${i + 1}. (${c.type}) ${c.url}`).join('\n')}`
      : '';

  const prompt = `You are an expert Meta ads copywriter for D2C brands in India.
Website info: ${websiteContent}
${competitorBlock}
Generate exactly 10 ad variants as JSON: {"variants":[{"variant_number":1,"copy_text":"...","angle":"offer-led"}, ...]}
Angles: ${AD_ANGLES.map((a) => a.angle).join(', ')}. Each copy 2-3 sentences, Indian audience, emojis ok. Use the real brand name from the website info. Never use generic phrases like "Buy Online" as the product benefit.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  const variants = parsed.variants || parsed.ads || [];
  return Array.isArray(variants) && variants.length > 0 ? variants : null;
}

export async function generateAdCopy(
  websiteContent: string,
  competitors: Array<{ url: string; type: string }> = [],
  websiteUrl?: string
): Promise<Array<{ variant_number: number; copy_text: string; angle: string }>> {
  const openai = getOpenAI();
  if (openai) {
    try {
      const competitorBlock =
        competitors.length > 0
          ? `Competitors:\n${competitors.map((c, i) => `${i + 1}. (${c.type}) ${c.url}`).join('\n')}`
          : '';

      const prompt = `You are an expert Meta (Facebook/Instagram) ads copywriter for D2C Shopify brands in India.

Website info: ${websiteContent}
${competitorBlock}

Generate exactly 10 ad copy variants, one for each angle:
${AD_ANGLES.map((a, i) => `${i + 1}. ${a.angle}: ${a.description}`).join('\n')}

Rules: use the real brand name; never use filler like "Buy Online" as the benefit; 2-3 sentences; Indian audience; emojis ok.
Return JSON: {"variants":[{ "variant_number": number, "copy_text": string, "angle": string }]}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      const variants = parsed.variants || parsed.ads || Object.values(parsed)[0] || [];
      if (Array.isArray(variants) && variants.length > 0) return variants;
    } catch (err) {
      console.warn('[AI] OpenAI failed, using free generator:', err);
    }
  }

  try {
    const groq = await generateWithGroq(websiteContent, competitors);
    if (groq) return groq;
  } catch (err) {
    console.warn('[AI] Groq failed, using free generator:', err);
  }

  return generateFreeAdCopy(websiteContent, competitors, websiteUrl);
}

export async function generateAdImage(
  copyText: string,
  angle: string,
  variantNumber: number,
  brandName?: string,
  category?: string,
  websiteImageUrl?: string | null
): Promise<string> {
  // Variant #1: prefer a real image from the brand website (instant + authentic)
  if (variantNumber === 1 && websiteImageUrl) {
    return websiteImageUrl;
  }

  // Paid OpenAI images only when explicitly enabled
  if (process.env.OPENAI_API_KEY && process.env.USE_OPENAI_IMAGES === 'true') {
    const openai = getOpenAI();
    if (openai) {
      try {
        const response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: buildImagePrompt(copyText, angle, brandName, category),
          n: 1,
          size: '1024x1024',
        });
        if (response.data?.[0]?.url) return response.data[0].url;
      } catch {
        // fall through to free generator
      }
    }
  }

  // Free AI images via Pollinations (no API key / no credits)
  // First load can take 10–60s while the image is generated
  return getFreeAiImage(copyText, angle, variantNumber, brandName, category);
}

function buildImagePrompt(
  copyText: string,
  angle: string,
  brandName?: string,
  category?: string
): string {
  const product = category || 'D2C product';
  const brand = brandName || 'Indian D2C brand';
  const sceneHints: Record<string, string> = {
    'offer-led': 'festive sale energy, bright warm lighting, gift-ready product flat lay',
    'ugc-style': 'casual smartphone photo aesthetic, natural light, lifestyle kitchen table',
    'testimonial': 'happy Indian family dining moment, warm home kitchen, product on table',
    'urgency': 'dramatic lighting, limited stock vibe, bold commercial product shot',
    'benefit-led': 'clean premium product photography, soft studio light, appetizing details',
    'problem-solution': 'before-after feel, premium vs bland packaging contrast, clean backdrop',
    'lifestyle': 'modern Indian home celebration, thali and jars, lifestyle magazine look',
    'comparison': 'side-by-side premium product hero shot, sharp commercial lighting',
    'founder-story': 'artisan handmade feel, traditional ingredients, rustic wooden table',
    'social-proof': 'multiple product jars styled together, social-media ready flat lay',
  };

  const scene = sceneHints[angle] || 'premium ecommerce product photography';

  return [
    `photorealistic product photo of ${product} for ${brand}`,
    scene,
    'Indian D2C ecommerce advertising style',
    'no text, no watermark, no logo letters, square composition, high detail',
  ].join(', ');
}

/** Free image generation — Pollinations.ai (no paid credits) */
function getFreeAiImage(
  copyText: string,
  angle: string,
  variantNumber: number,
  brandName?: string,
  category?: string
): string {
  const product = (category || 'indian food product').replace(/[^\w\s]/g, ' ').trim();
  const style =
    angle === 'ugc-style'
      ? 'casual phone photo'
      : angle === 'lifestyle'
        ? 'lifestyle home kitchen'
        : 'studio product photography';

  // Keep prompt short — long URLs often fail in the browser
  const prompt = `${product}, ${style}, photorealistic, appetizing, no text`;
  const seed = 1000 + variantNumber * 97;
  const params = new URLSearchParams({
    width: '768',
    height: '768',
    nologo: 'true',
    seed: String(seed),
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
}

/** Reliable free stock fallback if AI image CDN fails */
export function getStockFallbackImage(category?: string, variantNumber = 1): string {
  const keyword = encodeURIComponent(
    /pickle/i.test(category || '')
      ? 'pickle,jar,food'
      : `${(category || 'food').split(' ')[0]},product,india`
  );
  return `https://loremflickr.com/768/768/${keyword}?lock=${variantNumber + 20}`;
}

export { AD_ANGLES };
