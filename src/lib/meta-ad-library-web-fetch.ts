/**
 * Playwright Ad Library fetch — runs in a child process from Next.js API routes
 * (Playwright cannot be bundled into Next/webpack reliably).
 */
import type { MetaAdLibraryAd } from '@/lib/ai';
import { rankLibraryAds } from '@/lib/ad-performance';
import {
  buildAdLibraryUrl,
  type AdLibraryFetchInput,
  type AdLibraryFetchResult,
} from '@/lib/meta-ad-library';
import { extractAdsFromGraphqlPayload } from '@/lib/meta-ad-library-parse';
import {
  chromiumLaunchOptions,
  isBrowserLaunchError,
  resolveChromiumExecutable,
} from '@/lib/playwright-browser';

export async function runAdLibraryWebFetchInProcess(
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
    const playwright = await import('playwright');
    const executablePath = resolveChromiumExecutable(process.cwd());
    if (!executablePath) {
      throw new Error(
        'Chromium executable not found. On macOS install Google Chrome, or run: npx playwright install chromium'
      );
    }
    const browser = await playwright.chromium.launch(chromiumLaunchOptions(executablePath));
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

    await Promise.allSettled(pending);
    await page.waitForTimeout(500);
    await browser.close();

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
    const message = err instanceof Error ? err.message : String(err);
    const needsChromium = isBrowserLaunchError(message);
    return {
      ads: [],
      method: 'web_library',
      libraryUrl,
      error: message,
      note: needsChromium
        ? 'Install Chromium: npx playwright install chromium — then click Refresh from Ad Library.'
        : `Ad Library web fetch failed: ${message.slice(0, 120)}`,
    };
  }
}
