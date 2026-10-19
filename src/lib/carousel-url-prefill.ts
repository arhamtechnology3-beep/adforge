import { CAROUSEL_URL_MAX } from '@/lib/carousel-limits';

/** Survives tab close / refresh (user edits on /ads). */
export const CAROUSEL_URL_PREFILL_KEY = 'adforge_carousel_product_urls';
/** Legacy session-only key from onboarding — still read once for migration. */
const LEGACY_SESSION_KEY = 'adforge_carousel_product_urls';

function cleanUrlList(urls: string[]): string[] {
  return urls
    .map((url) => url.trim())
    .filter(Boolean)
    .filter((url) => !/store\.com\/products\/product-\d+/i.test(url))
    .slice(0, CAROUSEL_URL_MAX);
}

/** Persist product URLs for Ads studio carousel (onboarding + /ads edits). */
export function saveCarouselUrlPrefill(urls: string[]): void {
  if (typeof window === 'undefined') return;
  const cleaned = cleanUrlList(urls);
  if (!cleaned.length) {
    localStorage.removeItem(CAROUSEL_URL_PREFILL_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
    return;
  }
  const payload = JSON.stringify(cleaned);
  localStorage.setItem(CAROUSEL_URL_PREFILL_KEY, payload);
  // Keep session in sync so older tabs still see the same list
  sessionStorage.setItem(LEGACY_SESSION_KEY, payload);
}

export function loadCarouselUrlPrefill(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const fromLocal = localStorage.getItem(CAROUSEL_URL_PREFILL_KEY);
    const fromSession = sessionStorage.getItem(LEGACY_SESSION_KEY);
    const raw = fromLocal || fromSession;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned = cleanUrlList(
      parsed.map((item) => (typeof item === 'string' ? item : ''))
    );
    // Migrate session-only onboarding list into localStorage
    if (cleaned.length && !fromLocal) {
      localStorage.setItem(CAROUSEL_URL_PREFILL_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function clearCarouselUrlPrefill(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CAROUSEL_URL_PREFILL_KEY);
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
}
