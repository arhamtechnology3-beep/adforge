import type { MetaAdLibraryAd } from '@/lib/ai';

export type AdLibraryFetchInput = {
  pageId?: string | null;
  searchTerms?: string | null;
  country?: string;
  publisherPlatform?: 'instagram' | 'facebook' | 'all';
  /** Prefer ads ranked like Library UI total_impressions desc when available */
  sortByImpressions?: boolean;
  limit?: number;
};

export type AdLibraryFetchResult = {
  ads: MetaAdLibraryAd[];
  method: 'official_api' | 'web_library' | 'none';
  libraryUrl: string;
  error?: string;
  note?: string;
};

/** Bootstrap map — extend via competitor.meta_page_id in onboarding */
export const KNOWN_COMPETITOR_PAGE_IDS: Record<string, string> = {
  'farmdidi.com': '108788791719221',
  farmdidi: '108788791719221',
};

export function resolveMetaPageId(opts: {
  domain?: string | null;
  url?: string | null;
  metaPageId?: string | null;
}): string | null {
  if (opts.metaPageId && /^\d{5,}$/.test(opts.metaPageId.trim())) {
    return opts.metaPageId.trim();
  }

  // Paste full Ad Library URL → extract page_ids[0] / view_all_page_id
  if (opts.url && /facebook\.com\/ads\/library/i.test(opts.url)) {
    try {
      const u = new URL(opts.url);
      const fromPageIds =
        u.searchParams.get('page_ids[0]') ||
        u.searchParams.get('page_ids%5B0%5D') ||
        u.searchParams.get('view_all_page_id');
      if (fromPageIds && /^\d{5,}$/.test(fromPageIds)) return fromPageIds;
      // Some clients encode brackets oddly — fall back to regex
      const m =
        opts.url.match(/page_ids(?:\[|%5B)0(?:\]|%5D)=(\d{5,})/i) ||
        opts.url.match(/view_all_page_id=(\d{5,})/i);
      if (m?.[1]) return m[1];
    } catch {
      /* ignore */
    }
  }

  const host = (opts.domain || '')
    .replace(/^www\./, '')
    .toLowerCase();
  if (host && KNOWN_COMPETITOR_PAGE_IDS[host]) return KNOWN_COMPETITOR_PAGE_IDS[host];
  const brand = host.split('.')[0];
  if (brand && KNOWN_COMPETITOR_PAGE_IDS[brand]) return KNOWN_COMPETITOR_PAGE_IDS[brand];
  try {
    if (opts.url) {
      const h = new URL(opts.url).hostname.replace(/^www\./, '').toLowerCase();
      if (KNOWN_COMPETITOR_PAGE_IDS[h]) return KNOWN_COMPETITOR_PAGE_IDS[h];
      const b = h.split('.')[0];
      if (KNOWN_COMPETITOR_PAGE_IDS[b]) return KNOWN_COMPETITOR_PAGE_IDS[b];
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function buildAdLibraryUrl(input: AdLibraryFetchInput): string {
  const country = input.country || 'IN';
  const params = new URLSearchParams();
  params.set('active_status', 'active');
  params.set('ad_type', 'all');
  params.set('country', country);
  params.set('is_targeted_country', 'false');
  params.set('media_type', 'all');
  if (input.pageId) {
    params.set('page_ids[0]', input.pageId);
  }
  if (input.publisherPlatform && input.publisherPlatform !== 'all') {
    params.set('publisher_platforms[0]', input.publisherPlatform);
  }
  if (input.searchTerms) {
    params.set('q', `"${input.searchTerms.replace(/"/g, '')}"`);
    params.set('search_type', 'keyword_exact_phrase');
  } else if (input.pageId) {
    params.set('view_all_page_id', input.pageId);
    params.set('search_type', 'page');
  }
  if (input.sortByImpressions !== false) {
    params.set('sort_data[mode]', 'total_impressions');
    params.set('sort_data[direction]', 'desc');
  }
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

function mapOfficialAd(raw: Record<string, unknown>): MetaAdLibraryAd {
  const bodies = (raw.ad_creative_bodies as string[]) || [];
  const titles = (raw.ad_creative_link_titles as string[]) || [];
  const platforms = (raw.publisher_platforms as string[]) || [];
  const start = raw.ad_delivery_start_time
    ? String(raw.ad_delivery_start_time).slice(0, 10)
    : null;
  return {
    id: `lib_${raw.id}`,
    library_id: String(raw.id),
    ad_format: 'single_image',
    primary_text: bodies[0] || '',
    headline: titles[0] || '',
    cta: 'Learn More',
    active_status: 'ACTIVE',
    started_date: start,
    publisher_platforms: platforms.map((p) =>
      p.charAt(0) + p.slice(1).toLowerCase()
    ),
    media_url: null,
    snapshot_url: String(raw.ad_snapshot_url || ''),
    source: 'ad_library_api',
  };
}

/** Official Graph ads_archive — commercial ads mainly when EU-reached; India commercial often empty. */
export async function fetchAdLibraryOfficialApi(
  input: AdLibraryFetchInput
): Promise<AdLibraryFetchResult> {
  const libraryUrl = buildAdLibraryUrl(input);
  const token =
    process.env.META_AD_LIBRARY_TOKEN ||
    process.env.META_ACCESS_TOKEN ||
    '';

  if (!token || (!input.pageId && !input.searchTerms)) {
    return {
      ads: [],
      method: 'none',
      libraryUrl,
      note: 'No META_AD_LIBRARY_TOKEN / page id — skipping official API',
    };
  }

  const fields = [
    'id',
    'ad_creative_bodies',
    'ad_creative_link_titles',
    'ad_creative_link_captions',
    'ad_creative_link_descriptions',
    'ad_delivery_start_time',
    'ad_snapshot_url',
    'page_id',
    'page_name',
    'publisher_platforms',
  ].join(',');

  const params = new URLSearchParams({
    access_token: token,
    ad_reached_countries: `['${input.country || 'IN'}']`,
    ad_type: 'ALL',
    ad_active_status: 'ACTIVE',
    fields,
    limit: String(input.limit || 25),
  });
  if (input.pageId) params.set('search_page_ids', input.pageId);
  if (input.searchTerms) {
    params.set('search_terms', input.searchTerms);
    params.set('search_type', 'KEYWORD_EXACT_PHRASE');
  }

  try {
    const version = process.env.META_API_VERSION || 'v21.0';
    const res = await fetch(
      `https://graph.facebook.com/${version}/ads_archive?${params}`,
      { signal: AbortSignal.timeout(20000) }
    );
    const json = await res.json();
    if (!res.ok) {
      return {
        ads: [],
        method: 'official_api',
        libraryUrl,
        error: json?.error?.message || `HTTP ${res.status}`,
        note: 'Official Ad Library API rejected the request (common for India-only commercial ads).',
      };
    }
    const data = (json.data || []) as Record<string, unknown>[];
    const { rankLibraryAds } = await import('@/lib/ad-performance');
    const mapped = rankLibraryAds(data.map(mapOfficialAd).slice(0, input.limit || 25));
    return {
      ads: mapped,
      method: 'official_api',
      libraryUrl,
      note:
        mapped.length === 0
          ? 'Official API returned 0 ads. Meta often omits India-only commercial ads from ads_archive — use web Library fetch.'
          : undefined,
    };
  } catch (err) {
    return {
      ads: [],
      method: 'official_api',
      libraryUrl,
      error: String(err),
    };
  }
}

function extractAdsFromGraphqlPayload(json: unknown): MetaAdLibraryAd[] {
  const ads: MetaAdLibraryAd[] = [];
  const seen = new Set<string>();

  const textFromBody = (body: unknown): string => {
    if (!body) return '';
    if (typeof body === 'string') return body;
    if (typeof body === 'object' && body !== null && 'text' in body) {
      return String((body as { text?: string }).text || '');
    }
    return '';
  };

  const mediaFromSnapshot = (snap: Record<string, unknown>): {
    media: string | null;
    isVideo: boolean;
    isCarousel: boolean;
    body: string;
    headline: string;
    cta: string;
  } => {
    const cards = (snap.cards as Array<Record<string, unknown>>) || [];
    const images = (snap.images as Array<Record<string, unknown>>) || [];
    const videos = (snap.videos as Array<Record<string, unknown>>) || [];

    const card0 = cards[0] || {};
    const body =
      textFromBody(card0.body) ||
      textFromBody(snap.body) ||
      String(card0.link_description || snap.link_description || '');
    const headline = String(
      card0.title || snap.title || snap.link_title || ''
    ).replace(/\{\{[^}]+\}\}/g, '').trim();
    const cta = String(
      card0.cta_text || snap.cta_text || card0.cta_type || snap.cta_type || 'Shop Now'
    ).replace(/_/g, ' ');

    const media =
      (card0.original_image_url as string) ||
      (card0.resized_image_url as string) ||
      (card0.video_preview_image_url as string) ||
      (images[0]?.original_image_url as string) ||
      (images[0]?.resized_image_url as string) ||
      (videos[0]?.video_preview_image_url as string) ||
      null;

    const isVideo = Boolean(
      card0.video_hd_url ||
        card0.video_sd_url ||
        (Array.isArray(videos) && videos.length > 0)
    );
    const isCarousel = cards.length > 1;

    return { media, isVideo, isCarousel, body, headline, cta };
  };

  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const n = node as Record<string, unknown>;

    const archiveId = n.ad_archive_id || n.adArchiveId;
    if (archiveId && n.snapshot) {
      const id = String(archiveId);
      if (!seen.has(id)) {
        seen.add(id);
        const snap = (n.snapshot || {}) as Record<string, unknown>;
        const extracted = mediaFromSnapshot(snap);
        const platforms = (n.publisher_platform || n.publisher_platforms || []) as string[];
        const startTs = n.start_date || n.ad_delivery_start_time;
        let started: string | null = null;
        if (typeof startTs === 'number') {
          started = new Date(startTs * 1000).toISOString().slice(0, 10);
        } else if (typeof startTs === 'string') {
          started = startTs.slice(0, 10);
        }
        const activeTime =
          typeof n.total_active_time === 'number' ? n.total_active_time : null;
        const collationCount =
          typeof n.collation_count === 'number' ? n.collation_count : null;
        ads.push({
          id: `lib_${id}`,
          library_id: id,
          ad_format: extracted.isVideo
            ? 'video'
            : extracted.isCarousel
              ? 'carousel'
              : 'single_image',
          primary_text: extracted.body || '',
          headline: extracted.headline,
          cta: extracted.cta,
          active_status: n.is_active === false ? 'UNKNOWN' : 'ACTIVE',
          started_date: started,
          publisher_platforms: platforms.map((p) =>
            String(p)
              .toLowerCase()
              .replace(/^\w/, (c) => c.toUpperCase())
          ),
          media_url: extracted.media,
          snapshot_url: `https://www.facebook.com/ads/library/?id=${id}`,
          source: 'web_library',
          total_active_time: activeTime,
          has_multiple_versions: collationCount != null ? collationCount > 1 : undefined,
        });
      }
    }

    if (n.collated_results) visit(n.collated_results);
    for (const v of Object.values(n)) {
      if (v && typeof v === 'object') visit(v);
    }
  };

  visit(json);
  return ads;
}

/**
 * Headless Ad Library fetch — matches public Library UI (works for India commercial ads).
 * Requires: `npx playwright install chromium`
 */
export async function fetchAdLibraryViaWeb(
  input: AdLibraryFetchInput
): Promise<AdLibraryFetchResult> {
  const libraryUrl = buildAdLibraryUrl(input);
  const limit = input.limit || 20;

  if (!input.pageId && !input.searchTerms) {
    return {
      ads: [],
      method: 'none',
      libraryUrl,
      error: 'Need meta_page_id or search terms',
    };
  }

  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    const collected: MetaAdLibraryAd[] = [];
    const seen = new Set<string>();
    const pending: Promise<void>[] = [];

    page.on('response', (response) => {
      const task = (async () => {
        try {
          const url = response.url();
          if (!url.includes('graphql')) return;
          const status = response.status();
          if (status < 200 || status >= 300) return;
          const text = await response.text();
          if (!/ad_archive_id|adArchiveId|collated_results/i.test(text)) return;
          let json: unknown;
          try {
            json = JSON.parse(text);
          } catch {
            return;
          }
          for (const ad of extractAdsFromGraphqlPayload(json)) {
            if (seen.has(ad.library_id)) continue;
            seen.add(ad.library_id);
            collected.push(ad);
          }
        } catch {
          /* ignore intercept errors */
        }
      })();
      pending.push(task);
    });

    await page.goto(libraryUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    for (let i = 0; i < 8 && collected.length < limit; i++) {
      await page.mouse.wheel(0, 2400);
      await page.waitForTimeout(1400);
    }

    // Critical: wait for async response handlers to finish before closing
    await Promise.allSettled(pending);
    await page.waitForTimeout(500);

    await browser.close();

    const { rankLibraryAds } = await import('@/lib/ad-performance');
    const ranked = rankLibraryAds(
      collected.map((ad) => ({
        ...ad,
        source: 'web_library' as const,
      }))
    ).slice(0, limit);

    return {
      ads: ranked,
      method: 'web_library',
      libraryUrl,
      note:
        ranked.length === 0
          ? 'Web Library returned 0 ads (Meta may have blocked the headless session). Open the Library URL manually and confirm page_id.'
          : `Fetched ${ranked.length} live ads from Meta Ad Library (sorted like Library total impressions). Badges use Library rank + runtime — Meta does not publish commercial spend for these ads.`,
    };
  } catch (err) {
    return {
      ads: [],
      method: 'web_library',
      libraryUrl,
      error: String(err),
      note: 'Install Chromium: npx playwright install chromium. Web fetch required for India commercial ads.',
    };
  }
}

export async function fetchCompetitorLiveAds(
  input: AdLibraryFetchInput
): Promise<AdLibraryFetchResult> {
  const libraryUrl = buildAdLibraryUrl(input);

  // 1) Official API (may be empty for IN commercial)
  const official = await fetchAdLibraryOfficialApi(input);
  if (official.ads.length > 0) return official;

  // 2) Web Library via Playwright (India commercial)
  if (process.env.META_AD_LIBRARY_WEB_FETCH === 'false') {
    return {
      ...official,
      libraryUrl,
      method: 'none',
      note:
        (official.note || official.error || '') +
        ' Web fetch disabled (META_AD_LIBRARY_WEB_FETCH=false).',
    };
  }

  const web = await fetchAdLibraryViaWeb(input);
  if (web.ads.length > 0) return web;

  return {
    ads: [],
    method: web.method === 'web_library' ? 'web_library' : official.method,
    libraryUrl,
    error: web.error || official.error,
    note:
      web.note ||
      official.note ||
      'No live Meta ads fetched. Set competitor Meta Page ID and ensure Playwright Chromium is installed.',
  };
}
