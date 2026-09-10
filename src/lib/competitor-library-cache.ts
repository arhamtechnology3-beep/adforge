import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { CompetitorIntel, MetaAdLibraryAd } from '@/lib/ai';
import { createServiceClient } from '@/lib/supabase/server';

export type LibraryCacheRow = {
  competitor_key: string;
  competitor_url?: string | null;
  domain?: string | null;
  meta_page_id?: string | null;
  brand?: string | null;
  library_url?: string | null;
  ads: MetaAdLibraryAd[];
  fetch_method?: string | null;
  fetched_at: string;
};

/** Stable key for any competitor URL / page the user entered. */
export function competitorLibraryKey(comp: {
  meta_page_id?: string | null;
  domain?: string | null;
  url?: string | null;
}): string {
  const pageId = String(comp.meta_page_id || '').trim();
  if (pageId && /^\d{5,}$/.test(pageId)) return `page:${pageId}`;

  let domain = String(comp.domain || '').replace(/^www\./i, '').toLowerCase().trim();
  if (!domain && comp.url) {
    try {
      domain = new URL(comp.url).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
      /* ignore */
    }
  }
  if (domain) return `domain:${domain}`;
  return `url:${String(comp.url || 'unknown').slice(0, 180)}`;
}

function demoUserCachePath(userId: string): string {
  return path.join(process.cwd(), '.data', `competitor-library-cache-${userId}.json`);
}

function demoPageCachePath(): string {
  return path.join(process.cwd(), '.data', 'meta-library-page-cache.json');
}

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

/** Best-effort: copy remote Library media into our storage so previous ads keep images. */
export async function archiveLibraryMedia(
  scope: string,
  ads: MetaAdLibraryAd[]
): Promise<MetaAdLibraryAd[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return ads;
  }

  let admin;
  try {
    admin = await createServiceClient();
  } catch {
    return ads;
  }

  const safeScope = scope.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 80);

  return Promise.all(
    ads.map(async (ad) => {
      const media = String(ad.media_url || '').trim();
      if (!media || media.startsWith('/') || media.includes('supabase.co/storage')) {
        return ad;
      }
      if (!/^https?:\/\//i.test(media)) return ad;

      try {
        const res = await fetch(media, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: 'https://www.facebook.com/ads/library/',
            Accept: 'image/*,video/*,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return ad;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 500) return ad;
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const ext = contentType.includes('mp4')
          ? 'mp4'
          : contentType.includes('webp')
            ? 'webp'
            : contentType.includes('png')
              ? 'png'
              : 'jpg';
        const objectPath = `competitor-library/${safeScope}/${ad.library_id || ad.id}.${ext}`;
        const { error } = await admin.storage.from('creative-assets').upload(objectPath, buf, {
          contentType,
          upsert: true,
        });
        if (error) return ad;
        const { data } = admin.storage.from('creative-assets').getPublicUrl(objectPath);
        return { ...ad, media_url: data.publicUrl || ad.media_url };
      } catch {
        return ad;
      }
    })
  );
}

function rowFromIntel(
  key: string,
  intel: CompetitorIntel,
  ads: MetaAdLibraryAd[]
): LibraryCacheRow {
  return {
    competitor_key: key,
    competitor_url: intel.url,
    domain: intel.domain,
    meta_page_id: intel.meta_page_id || null,
    brand: intel.brand,
    library_url: intel.meta_ad_library_url,
    ads: ads.slice(0, 10),
    fetch_method: ads[0]?.source || 'web_library',
    fetched_at: new Date().toISOString(),
  };
}

/** Shared Library creatives by Meta page/domain (migration 014). */
export async function savePageLibraryCache(
  row: LibraryCacheRow,
  isDemo?: boolean
): Promise<void> {
  if (!row.ads.length) return;

  if (isDemo) {
    const all = await readJsonFile<Record<string, LibraryCacheRow>>(demoPageCachePath(), {});
    all[row.competitor_key] = row;
    await writeJsonFile(demoPageCachePath(), all);
    return;
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.from('meta_library_page_cache').upsert(
    {
      competitor_key: row.competitor_key,
      competitor_url: row.competitor_url,
      domain: row.domain,
      meta_page_id: row.meta_page_id,
      brand: row.brand,
      library_url: row.library_url,
      ads: row.ads,
      fetch_method: row.fetch_method,
      fetched_at: row.fetched_at,
      updated_at: row.fetched_at,
    },
    { onConflict: 'competitor_key' }
  );
  if (error) {
    throw new Error(error.message);
  }
}

export async function loadPageLibraryCache(opts: {
  isDemo?: boolean;
  intel: CompetitorIntel;
}): Promise<LibraryCacheRow | null> {
  const key = competitorLibraryKey(opts.intel);

  if (opts.isDemo) {
    const all = await readJsonFile<Record<string, LibraryCacheRow>>(demoPageCachePath(), {});
    return all[key] || null;
  }

  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('meta_library_page_cache')
      .select('*')
      .eq('competitor_key', key)
      .maybeSingle();
    if (error || !data?.ads || !Array.isArray(data.ads) || data.ads.length === 0) {
      return null;
    }
    return {
      competitor_key: data.competitor_key,
      competitor_url: data.competitor_url,
      domain: data.domain,
      meta_page_id: data.meta_page_id,
      brand: data.brand,
      library_url: data.library_url,
      ads: data.ads as MetaAdLibraryAd[],
      fetch_method: data.fetch_method,
      fetched_at: data.fetched_at,
    };
  } catch {
    return null;
  }
}

export async function saveCompetitorLibraryCache(opts: {
  userId: string;
  isDemo?: boolean;
  intel: CompetitorIntel;
}): Promise<void> {
  const ads = (opts.intel.live_meta_ads || []).filter((a) => a.source !== 'manual');
  if (!ads.length) return;

  const key = competitorLibraryKey(opts.intel);
  const archived = await archiveLibraryMedia(key, ads);
  const row = rowFromIntel(key, opts.intel, archived);

  try {
    await savePageLibraryCache(row, opts.isDemo);
  } catch (err) {
    console.warn(
      '[meta-library-page-cache] save failed (run migration 014?)',
      err instanceof Error ? err.message : err
    );
  }

  if (opts.isDemo) {
    const all = await readJsonFile<Record<string, LibraryCacheRow>>(
      demoUserCachePath(opts.userId),
      {}
    );
    all[key] = row;
    await writeJsonFile(demoUserCachePath(opts.userId), all);
    return;
  }

  try {
    const supabase = await createServiceClient();
    const { error } = await supabase.from('competitor_library_cache').upsert(
      {
        user_id: opts.userId,
        competitor_key: key,
        competitor_url: row.competitor_url,
        domain: row.domain,
        meta_page_id: row.meta_page_id,
        brand: row.brand,
        library_url: row.library_url,
        ads: row.ads,
        fetch_method: row.fetch_method,
        fetched_at: row.fetched_at,
        updated_at: row.fetched_at,
      },
      { onConflict: 'user_id,competitor_key' }
    );
    if (error) {
      console.warn('[competitor-library-cache] save failed', error.message);
    }
  } catch (err) {
    console.warn(
      '[competitor-library-cache] save failed',
      err instanceof Error ? err.message : err
    );
  }
}

export async function loadCompetitorLibraryCache(opts: {
  userId: string;
  isDemo?: boolean;
  intel: CompetitorIntel;
}): Promise<LibraryCacheRow | null> {
  const key = competitorLibraryKey(opts.intel);

  if (opts.isDemo) {
    const all = await readJsonFile<Record<string, LibraryCacheRow>>(
      demoUserCachePath(opts.userId),
      {}
    );
    if (all[key]) return all[key];
    return loadPageLibraryCache({ isDemo: true, intel: opts.intel });
  }

  try {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from('competitor_library_cache')
      .select('*')
      .eq('user_id', opts.userId)
      .eq('competitor_key', key)
      .maybeSingle();

    if (data?.ads && Array.isArray(data.ads) && data.ads.length > 0) {
      return {
        competitor_key: data.competitor_key,
        competitor_url: data.competitor_url,
        domain: data.domain,
        meta_page_id: data.meta_page_id,
        brand: data.brand,
        library_url: data.library_url,
        ads: data.ads as MetaAdLibraryAd[],
        fetch_method: data.fetch_method,
        fetched_at: data.fetched_at,
      };
    }
  } catch {
    /* fall through */
  }

  return loadPageLibraryCache({ isDemo: false, intel: opts.intel });
}

/**
 * 1) Keep live Library ads and persist them (user + shared page).
 * 2) If live empty → user previous → shared page previous.
 * 3) Leave empty for caller’s soft website-intel fallback.
 */
export async function applyCompetitorLibraryCache(
  userId: string,
  intel: CompetitorIntel[],
  opts?: { isDemo?: boolean }
): Promise<CompetitorIntel[]> {
  const out: CompetitorIntel[] = [];

  for (const comp of intel) {
    const hasLive =
      (comp.live_meta_ads?.length || 0) > 0 &&
      comp.live_meta_ads!.some((a) => a.source !== 'manual');

    if (hasLive) {
      await saveCompetitorLibraryCache({
        userId,
        isDemo: opts?.isDemo,
        intel: comp,
      });
      const saved = await loadCompetitorLibraryCache({
        userId,
        isDemo: opts?.isDemo,
        intel: comp,
      });
      out.push({
        ...comp,
        live_meta_ads: (saved?.ads || comp.live_meta_ads || []).slice(0, 10),
        meta_ads_count: Math.min(
          (saved?.ads || comp.live_meta_ads || []).length,
          10
        ),
        library_fetch_note:
          comp.library_fetch_note ||
          `Loaded ${(saved?.ads || comp.live_meta_ads || []).length} live Ad Library creatives.`,
      });
      continue;
    }

    const prev = await loadCompetitorLibraryCache({
      userId,
      isDemo: opts?.isDemo,
      intel: comp,
    });
    if (prev?.ads?.length) {
      const when = prev.fetched_at
        ? new Date(prev.fetched_at).toLocaleString('en-IN')
        : 'earlier';
      out.push({
        ...comp,
        live_meta_ads: prev.ads.slice(0, 10),
        meta_ads_count: Math.min(prev.ads.length, 10),
        meta_ad_library_url: prev.library_url || comp.meta_ad_library_url,
        meta_page_id: prev.meta_page_id || comp.meta_page_id,
        library_fetch_note: [
          (comp.library_fetch_note || '').trim(),
          `Live fetch unavailable on this server — showing previous Ad Library ads saved ${when} for this competitor.`,
        ]
          .filter(Boolean)
          .join(' '),
      });
      continue;
    }

    out.push(comp);
  }

  return out;
}
