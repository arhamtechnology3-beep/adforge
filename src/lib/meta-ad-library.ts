import type { MetaAdLibraryAd } from '@/lib/ai';
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { isBrowserLaunchError, resolveChromiumExecutable } from '@/lib/playwright-browser';

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

function readCachedLiveAds(
  root: string,
  input: AdLibraryFetchInput,
  libraryUrl: string
): AdLibraryFetchResult | null {
  const key = String(input.pageId || input.searchTerms || 'default').replace(
    /[^a-z0-9_-]/gi,
    '_'
  );
  const candidates = [
    path.join(root, '.cache', 'ad-library', `${key}.json`),
    process.env.HOME
      ? path.join(
          process.env.HOME,
          'Library',
          'Application Support',
          'AdForge',
          'ad-library-worker',
          '.cache',
          'ad-library',
          `${key}.json`
        )
      : '',
  ].filter(Boolean);
  const cacheFile = candidates.find((candidate) => existsSync(candidate));
  if (!cacheFile) return null;

  try {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf8')) as {
      savedAt?: string;
      result?: AdLibraryFetchResult;
    };
    if (!cached.result?.ads?.length) return null;
    const savedAt = cached.savedAt ? Date.parse(cached.savedAt) : 0;
    if (!savedAt || Date.now() - savedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return {
      ...cached.result,
      libraryUrl: cached.result.libraryUrl || libraryUrl,
      note: `Showing cached live Meta ads from ${new Date(savedAt).toLocaleString(
        'en-IN'
      )}. Refresh retries the live source.`,
    };
  } catch {
    return null;
  }
}

/** Bootstrap map — extend via competitor.meta_page_id in onboarding */
export const KNOWN_COMPETITOR_PAGE_IDS: Record<string, string> = {
  'farmdidi.com': '108788791719221',
  farmdidi: '108788791719221',
};

function resolveProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (
      existsSync(path.join(dir, 'package.json')) &&
      existsSync(path.join(dir, 'scripts', 'fetch-ad-library-web.ts'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

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
  // Include inactive/historical creatives — many competitors have paused ads that still teach winning patterns.
  params.set('active_status', 'all');
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
    ad_active_status: 'ALL',
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
    const mapped = rankLibraryAds(data.map(mapOfficialAd).slice(0, input.limit || 25)).slice(
      0,
      Math.min(input.limit || 25, 10)
    );
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

function fetchAdLibraryViaWebSubprocess(
  input: AdLibraryFetchInput
): Promise<AdLibraryFetchResult> {
  const root = resolveProjectRoot();
  const libraryUrl = buildAdLibraryUrl(input);
  const script = path.join(root, 'scripts', 'fetch-ad-library-web.cjs');

  if (!existsSync(script)) {
    return Promise.resolve({
      ads: [],
      method: 'web_library',
      libraryUrl,
      error: `Ad Library script missing: ${script}`,
      note: 'Run: npm run build:ad-library',
    });
  }

  const chromiumExecutable = resolveChromiumExecutable(root);
  return runAdLibrarySubprocess(input, { root, libraryUrl, script, chromiumExecutable });
}

function runAdLibrarySubprocess(
  input: AdLibraryFetchInput,
  ctx: {
    root: string;
    libraryUrl: string;
    script: string;
    chromiumExecutable?: string;
  }
): Promise<AdLibraryFetchResult> {
  const { root, libraryUrl, script, chromiumExecutable } = ctx;

  if (!chromiumExecutable) {
    return Promise.resolve({
      ads: [],
      method: 'web_library',
      libraryUrl,
      error: 'Chromium executable not found',
      note: 'Run: npx playwright install chromium && npm run build:ad-library — then restart the dev server.',
    });
  }

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], {
      cwd: root,
      env: {
        ...process.env,
        PLAYWRIGHT_CHROMIUM_EXECUTABLE: chromiumExecutable,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        ads: [],
        method: 'web_library',
        libraryUrl,
        error: 'Ad Library fetch timed out after 90s',
        note: 'Try Refresh from Ad Library again.',
      });
    }, 90000);

    child.stdin.write(JSON.stringify(input));
    child.stdin.end();

    const tryParseResult = (): AdLibraryFetchResult | null => {
      const trimmed = stdout.trim();
      if (!trimmed) return null;
      // npm/npx may prefix stdout — find the JSON object
      const jsonStart = trimmed.indexOf('{');
      if (jsonStart < 0) return null;
      try {
        return JSON.parse(trimmed.slice(jsonStart)) as AdLibraryFetchResult;
      } catch {
        return null;
      }
    };

    child.on('close', (code) => {
      clearTimeout(timeout);
      const parsed = tryParseResult();
      if (parsed && parsed.ads.length > 0) {
        resolve(parsed);
        return;
      }

      const failNote = parsed?.note || parsed?.error;
      const stderrClean = stderr
        .split('\n')
        .filter((line) => !/^npm warn/i.test(line.trim()))
        .join('\n')
        .trim();
      const message =
        failNote ||
        stderrClean ||
        stdout.trim().slice(0, 300) ||
        `fetch script exited with code ${code ?? 'unknown'}`;
      if (!existsSync(script)) {
        resolve({
          ads: [],
          method: 'web_library',
          libraryUrl,
          error: `Ad Library script missing: ${script}`,
          note: 'Run: npm run build:ad-library',
        });
        return;
      }
      console.warn('[meta-ad-library] subprocess failed:', message.slice(0, 400));
      const needsChromium = isBrowserLaunchError(message);
      resolve({
        ads: [],
        method: 'web_library',
        libraryUrl,
        error: message,
        note: needsChromium
          ? 'Install Chromium: npx playwright install chromium — then click Refresh from Ad Library.'
          : `Ad Library web fetch failed: ${message.slice(0, 120)}`,
      });
    });
  });
}

/**
 * Headless Ad Library fetch — matches public Library UI (works for India commercial ads).
 * Runs Playwright in a child process (Next.js cannot bundle Playwright reliably).
 * Requires: `npx playwright install chromium`
 */
export async function fetchAdLibraryViaWeb(
  input: AdLibraryFetchInput
): Promise<AdLibraryFetchResult> {
  const libraryUrl = buildAdLibraryUrl(input);
  const workerUrl =
    process.env.AD_LIBRARY_WORKER_URL || 'http://127.0.0.1:3021';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    const res = await fetch(`${workerUrl}/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json = (await res.json()) as AdLibraryFetchResult;
    if (json.ads?.length > 0) {
      return { ...json, libraryUrl: json.libraryUrl || libraryUrl };
    }
    if (res.ok && json.ads?.length === 0 && !json.error) {
      return { ...json, libraryUrl: json.libraryUrl || libraryUrl };
    }
  } catch {
    /* worker not running — fall through */
  }

  const root = resolveProjectRoot();
  // Prefer the last real Library response over invented demo ads while the
  // browser service restarts. Cache entries expire after seven days.
  const cached = readCachedLiveAds(root, input, libraryUrl);
  if (cached) return cached;

  const chromium = resolveChromiumExecutable(root);

  if (chromium) {
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE = chromium;
    try {
      const { runAdLibraryWebFetchInProcess } = await import('@/lib/meta-ad-library-web-fetch');
      const inline = await runAdLibraryWebFetchInProcess(input);
      if (inline.ads.length > 0) return inline;
    } catch (err) {
      console.warn(
        '[meta-ad-library] inline fetch failed:',
        err instanceof Error ? err.message : err
      );
    }
  }

  const subprocess = await fetchAdLibraryViaWebSubprocess(input);
  if (subprocess.ads.length > 0) return subprocess;

  return {
    ...subprocess,
    libraryUrl,
    note: sanitizeLibraryNote(
      (subprocess.note ? `${subprocess.note} ` : '') +
        (process.env.NODE_ENV === 'production'
          ? 'Could not load Ad Library creatives right now. Open Meta Ad Library manually, or generate from your product with Meta-style patterns.'
          : 'Start the Ad Library worker in another terminal: npm run ad-library-worker')
    ),
  };
}

function sanitizeLibraryNote(note: string): string {
  if (process.env.NODE_ENV !== 'production') return note;
  return note
    .replace(/Run:\s*npm run build:ad-library[^.!]*/gi, '')
    .replace(/Start the Ad Library worker[^.!]*/gi, '')
    .replace(/npm run ad-library-worker/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function fetchCompetitorLiveAds(
  input: AdLibraryFetchInput
): Promise<AdLibraryFetchResult> {
  const libraryUrl = buildAdLibraryUrl(input);
  const limit = Math.min(input.limit || 20, 10);

  // 1) Official API (may be empty for IN commercial)
  const official = await fetchAdLibraryOfficialApi({ ...input, limit });
  if (official.ads.length > 0) {
    return {
      ...official,
      ads: official.ads.slice(0, limit),
      note: sanitizeLibraryNote(
        official.note ||
          `Loaded ${Math.min(official.ads.length, limit)} Ad Library creatives (active + inactive).`
      ),
    };
  }

  // 2) Web Library via Playwright (India commercial)
  if (process.env.META_AD_LIBRARY_WEB_FETCH === 'false') {
    return {
      ...official,
      libraryUrl,
      method: 'none',
      note: sanitizeLibraryNote(
        (official.note || official.error || '') +
          ' Web fetch disabled (META_AD_LIBRARY_WEB_FETCH=false).'
      ),
    };
  }

  const web = await fetchAdLibraryViaWeb({ ...input, limit });
  if (web.ads.length > 0) {
    return {
      ...web,
      ads: web.ads.slice(0, limit),
      note: sanitizeLibraryNote(
        web.note ||
          `Loaded top ${Math.min(web.ads.length, limit)} Ad Library creatives (includes paused/historical when available).`
      ),
    };
  }

  return {
    ads: [],
    method: web.method === 'web_library' ? 'web_library' : official.method,
    libraryUrl,
    error: web.error || official.error,
    note: sanitizeLibraryNote(
      web.note ||
        official.note ||
        'No Meta Ad Library creatives loaded yet. You can still generate ads from your product using Meta-style patterns.'
    ),
  };
}
