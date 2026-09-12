# Meta Ad Library on Hostinger (AdForge)

## Symptom → root cause

`/ads` shows **SAMPLE**, grey media, or “live Library unavailable on this server”:

- Meta Ad Library in the **browser** often has real ads.
- **Hostinger** usually cannot scrape Library (no Chromium / `SKIP_PLAYWRIGHT` / no `AD_LIBRARY_WORKER_URL`).
- Do **not** treat this as “Meta has no ads” or FarmDidi-only hardcoded seeds as the primary fix.

## Fetch order

1. Live (API → Playwright / `AD_LIBRARY_WORKER_URL`)
2. Per-user `competitor_library_cache` (migration 013)
3. Shared `meta_library_page_cache` (migration 014)
4. SAMPLE placeholders

## Fast fix

```bash
npx tsx scripts/seed-library-page-cache.ts <pageId> <domain> <Brand>
# e.g. 108788791719221 farmdidi.com FarmDidi
```

Requires local Ad Library worker (`npm run ad-library-worker` or dev on `:3021`). Archives media to Supabase `creative-assets`, then **/ads → Refresh**.

## Ongoing (any competitor)

Set Hostinger **`AD_LIBRARY_WORKER_URL`** to a reachable host running the worker.
