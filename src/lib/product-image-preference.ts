/**
 * Prefer live storefront / PDP images over broken normalized cutouts.
 */

export function unwrapProxiedProductImage(url: string): string {
  if (!url) return '';
  try {
    if (url.includes('/api/ads/product-image')) {
      const parsed = url.startsWith('http')
        ? new URL(url)
        : new URL(url, 'http://localhost');
      const src = parsed.searchParams.get('src');
      if (src) return src;
    }
  } catch {
    /* keep original */
  }
  return url;
}

export function isNormalizedCutoutUrl(url: string): boolean {
  return /\/normalized\//i.test(url) || /-cutout\.png($|\?)/i.test(url);
}

export function isStorefrontProductImage(url: string): boolean {
  const raw = unwrapProxiedProductImage(url);
  return (
    /cdn\.shopify\.com/i.test(raw) ||
    /\/cdn\/shop\//i.test(raw) ||
    /\.(myshopify\.com|shopify\.com)\//i.test(raw)
  );
}

/** Dedupe and rank: storefront first, then non-cutouts, then everything else. */
export function rankProductImageUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of urls) {
    if (!raw?.trim()) continue;
    const url = unwrapProxiedProductImage(raw.trim());
    if (!url || seen.has(url)) continue;
    seen.add(url);
    cleaned.push(url);
  }
  return cleaned.sort((a, b) => {
    const score = (url: string) => {
      if (isStorefrontProductImage(url)) return 0;
      if (!isNormalizedCutoutUrl(url)) return 1;
      return 2;
    };
    return score(a) - score(b);
  });
}
