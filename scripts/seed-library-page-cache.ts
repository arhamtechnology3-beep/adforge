/**
 * One-shot: fetch live Meta Ad Library ads (local worker) and upsert shared page cache.
 *
 * Usage:
 *   npx tsx scripts/seed-library-page-cache.ts 108788791719221 farmdidi.com "FarmDidi"
 */
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

import {
  archiveLibraryMedia,
  savePageLibraryCache,
  type LibraryCacheRow,
} from '../src/lib/competitor-library-cache';
import type { MetaAdLibraryAd } from '../src/lib/ai';

async function main() {
  const pageId = process.argv[2] || '108788791719221';
  const domain = process.argv[3] || 'farmdidi.com';
  const brand = process.argv[4] || 'FarmDidi';
  const worker =
    process.env.AD_LIBRARY_WORKER_URL || 'http://127.0.0.1:3021';

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log(`[seed] Fetching Ad Library page ${pageId} via ${worker}/fetch …`);
  const res = await fetch(`${worker}/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pageId,
      country: 'IN',
      limit: 10,
      activeStatus: 'active',
    }),
    signal: AbortSignal.timeout(120000),
  });
  const json = (await res.json()) as {
    ads?: MetaAdLibraryAd[];
    libraryUrl?: string;
    error?: string;
  };
  const ads = (json.ads || []).filter((a) => a.source !== 'manual');
  if (!ads.length) {
    throw new Error(json.error || 'Worker returned 0 ads — is Chromium/worker running?');
  }

  const key = `page:${pageId}`;
  console.log(`[seed] Got ${ads.length} ads — archiving media to Supabase storage…`);
  const archived = await archiveLibraryMedia(key, ads.slice(0, 10));
  const withStorage = archived.filter((a) =>
    String(a.media_url || '').includes('supabase.co/storage')
  ).length;
  console.log(`[seed] Archived media for ${withStorage}/${archived.length} ads`);

  const row: LibraryCacheRow = {
    competitor_key: key,
    competitor_url: `https://${domain}`,
    domain,
    meta_page_id: pageId,
    brand,
    library_url:
      json.libraryUrl ||
      `https://www.facebook.com/ads/library/?view_all_page_id=${pageId}&country=IN`,
    ads: archived,
    fetch_method: 'web_library',
    fetched_at: new Date().toISOString(),
  };

  await savePageLibraryCache(row, false);
  console.log(`[seed] Upserted meta_library_page_cache key=${key}`);
  console.log('[seed] Done. Run migration 014 in Supabase first if the table is missing.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
