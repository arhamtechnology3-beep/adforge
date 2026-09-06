import { META_AD_FORMATS } from '@/lib/creatives';
import { CAROUSEL_URL_MAX, CAROUSEL_URL_MIN } from '@/lib/carousel-limits';
import { suggestProductFromPage, parseProductPageHtml } from '@/lib/product-page-suggestions';
import type { CarouselCard } from '@/types/database';

export { CAROUSEL_URL_MAX, CAROUSEL_URL_MIN } from '@/lib/carousel-limits';

export type ResolvedCarouselProduct = {
  product_url: string;
  product_name: string;
  brand_name: string;
  price: string;
  image_url: string | null;
  error?: string;
};

export type ProductUrlCarouselAd = {
  campaign_input_id: string;
  variant_number: number;
  copy_text: string;
  image_url: string;
  status: 'pending';
  ad_format: 'carousel';
  headline: string;
  angle: string;
  media_payload: {
    placement: string;
    aspect: '1:1';
    cards: CarouselCard[];
    product_id?: string | null;
    product_name?: string | null;
    primary_packshot?: string | null;
    template: string;
    carousel_source: 'product_urls';
    skipped_urls?: string[];
  };
};

function normalizeUrlList(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw.map((item) => String(item || '').trim())
    : String(raw || '')
        .split(/[\n,]+/)
        .map((item) => item.trim());
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (!item) continue;
    let href = item;
    if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
    try {
      const url = new URL(href);
      const key = url.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    } catch {
      // skip invalid
    }
  }
  return out.slice(0, CAROUSEL_URL_MAX);
}

export function parseCarouselProductUrls(raw: unknown): string[] {
  return normalizeUrlList(raw);
}

function proxiedImageUrl(src: string): string {
  return `/api/ads/product-image?src=${encodeURIComponent(src)}`;
}

async function resolveOne(productUrl: string): Promise<ResolvedCarouselProduct> {
  try {
    // Shopify JSON (+ fuzzy handle match) first — more reliable than HTML scrape
    const { suggestFromShopifyStore } = await import('@/lib/product-page-suggestions');
    let suggestion =
      (await suggestFromShopifyStore(productUrl).catch(() => null)) ||
      (await suggestProductFromPage(productUrl).catch(() => null));

    if (!suggestion?.image_urls?.[0]) {
      try {
        const workerPort = process.env.AD_LIBRARY_WORKER_PORT || '3021';
        const response = await fetch(`http://127.0.0.1:${workerPort}/product-page`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: productUrl }),
          signal: AbortSignal.timeout(45000),
          cache: 'no-store',
        });
        const payload = await response.json();
        if (response.ok && payload.html && payload.url) {
          suggestion = parseProductPageHtml(payload.html, payload.url);
        }
      } catch {
        // keep prior result
      }
    }

    if (!suggestion) {
      return {
        product_url: productUrl,
        product_name: 'Product',
        brand_name: '',
        price: '',
        image_url: null,
        error: 'Could not read product page',
      };
    }

    const image = suggestion.image_urls?.[0] || null;
    return {
      product_url: suggestion.product_url || productUrl,
      product_name: suggestion.product_name || 'Product',
      brand_name: suggestion.brand_name || '',
      price: suggestion.price || '',
      image_url: image ? proxiedImageUrl(image) : null,
      error: image ? undefined : 'No product image found on this page',
    };
  } catch (error) {
    return {
      product_url: productUrl,
      product_name: 'Product',
      brand_name: '',
      price: '',
      image_url: null,
      error: error instanceof Error ? error.message : 'Could not read product page',
    };
  }
}

/** Resolve many product URLs → image + title (skips failures with error). */
export async function resolveCarouselProductUrls(
  rawUrls: unknown
): Promise<{ products: ResolvedCarouselProduct[]; urls: string[] }> {
  const urls = parseCarouselProductUrls(rawUrls);
  const products: ResolvedCarouselProduct[] = [];
  for (const url of urls) {
    products.push(await resolveOne(url));
  }
  return { products, urls };
}

export function buildProductUrlCarouselAd(input: {
  campaignInputId: string;
  products: ResolvedCarouselProduct[];
  brandName?: string;
  productId?: string | null;
  variantNumber?: number;
  ctaLabel?: string;
}): { ad: ProductUrlCarouselAd | null; skipped: ResolvedCarouselProduct[]; warnings: string[] } {
  const usable = input.products.filter((p) => p.image_url);
  const skipped = input.products.filter((p) => !p.image_url);
  const warnings = skipped.map(
    (p) => `${p.product_url}: ${p.error || 'No image — card skipped'}`
  );

  if (usable.length < CAROUSEL_URL_MIN) {
    return {
      ad: null,
      skipped,
      warnings: [
        ...warnings,
        `Need at least ${CAROUSEL_URL_MIN} product URLs with images (got ${usable.length}).`,
      ],
    };
  }

  const brand =
    input.brandName ||
    usable.find((p) => p.brand_name)?.brand_name ||
    'Your brand';
  const cards: CarouselCard[] = usable.slice(0, CAROUSEL_URL_MAX).map((product) => ({
    image_url: product.image_url!,
    headline: product.product_name.slice(0, 40),
    description: [product.price, brand].filter(Boolean).join(' · ').slice(0, 90),
    link: product.product_url,
    product_url: product.product_url,
    product_name: product.product_name,
    price: product.price || undefined,
  }));

  const copyLines = [
    `Shop ${brand} — swipe to explore ${cards.length} products.`,
    cards
      .slice(0, 3)
      .map((c) => c.product_name)
      .filter(Boolean)
      .join(' · '),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    ad: {
      campaign_input_id: input.campaignInputId,
      variant_number: input.variantNumber || 1,
      copy_text: copyLines.slice(0, 2200),
      image_url: cards[0]!.image_url,
      status: 'pending',
      ad_format: 'carousel',
      headline: `${brand} · Shop the collection`.slice(0, 40),
      angle: 'product-url-carousel',
      media_payload: {
        placement: META_AD_FORMATS.carousel.placement,
        aspect: '1:1',
        cards,
        product_id: input.productId || null,
        product_name: cards[0]?.product_name || null,
        primary_packshot: cards[0]?.image_url || null,
        template: 'Product URL carousel',
        carousel_source: 'product_urls',
        skipped_urls: skipped.map((p) => p.product_url),
      },
    },
    skipped,
    warnings,
  };
}
