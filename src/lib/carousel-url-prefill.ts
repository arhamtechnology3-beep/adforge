import { CAROUSEL_URL_MAX } from '@/lib/carousel-limits';

export const CAROUSEL_URL_PREFILL_KEY = 'adforge_carousel_product_urls';

/** Persist product URLs collected during onboarding for Ads studio carousel. */
export function saveCarouselUrlPrefill(urls: string[]): void {
  if (typeof window === 'undefined') return;
  const cleaned = urls
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, CAROUSEL_URL_MAX);
  if (!cleaned.length) {
    sessionStorage.removeItem(CAROUSEL_URL_PREFILL_KEY);
    return;
  }
  sessionStorage.setItem(CAROUSEL_URL_PREFILL_KEY, JSON.stringify(cleaned));
}

export function loadCarouselUrlPrefill(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(CAROUSEL_URL_PREFILL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, CAROUSEL_URL_MAX);
  } catch {
    return [];
  }
}

export function clearCarouselUrlPrefill(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CAROUSEL_URL_PREFILL_KEY);
}
