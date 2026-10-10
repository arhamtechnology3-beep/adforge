import { META_AD_FORMATS } from '@/lib/creatives';
import { CAROUSEL_URL_MAX, CAROUSEL_URL_MIN } from '@/lib/carousel-limits';
import { suggestProductFromPage, parseProductPageHtml } from '@/lib/product-page-suggestions';
import type { AdMediaPayload, CarouselCard } from '@/types/database';
import {
  CAROUSEL_STORY_MAX_PRODUCTS,
  buildCarouselCardUrl,
  deriveCarouselHook,
  domainFromUrl,
  mineBenefitPhrases,
  shortProductName,
} from '@/lib/carousel-story';
import { unwrapProxiedProductImage } from '@/lib/product-image-preference';

export { CAROUSEL_URL_MAX, CAROUSEL_URL_MIN } from '@/lib/carousel-limits';

export type ResolvedCarouselProduct = {
  product_url: string;
  product_name: string;
  brand_name: string;
  price: string;
  image_url: string | null;
  error?: string;
  /** Page description + benefits — the only text a card's benefit overlay may come from */
  claims_text?: string;
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
    carousel_story: AdMediaPayload['carousel_story'];
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
      claims_text: [
        suggestion.description,
        ...(suggestion.benefits || []),
        ...(suggestion.approved_claims || []),
      ]
        .filter(Boolean)
        .join(' . ')
        .slice(0, 4000),
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

function imageKey(url: string): string {
  return unwrapProxiedProductImage(url).split('?')[0]!.toLowerCase();
}

/** Drop repeat photos / repeat product names so Meta doesn't flag redundant cards. */
function dedupeProducts(products: ResolvedCarouselProduct[]): {
  unique: ResolvedCarouselProduct[];
  duplicates: ResolvedCarouselProduct[];
} {
  const seenImages = new Set<string>();
  const seenNames = new Set<string>();
  const unique: ResolvedCarouselProduct[] = [];
  const duplicates: ResolvedCarouselProduct[] = [];
  for (const product of products) {
    const img = imageKey(product.image_url || '');
    const name = shortProductName(product.product_name).toLowerCase();
    if (seenImages.has(img) || (name && name !== 'product' && seenNames.has(name))) {
      duplicates.push(product);
      continue;
    }
    seenImages.add(img);
    if (name) seenNames.add(name);
    unique.push(product);
  }
  return { unique, duplicates };
}

export function buildProductUrlCarouselAd(input: {
  campaignInputId: string;
  products: ResolvedCarouselProduct[];
  brandName?: string;
  productId?: string | null;
  variantNumber?: number;
  ctaLabel?: string;
  /** Card 1 headline typed by the user; otherwise derived from approved claims */
  hookOverride?: string | null;
  /** User-provided benefit overlays for cards 2..n (comma / newline list) */
  overlays?: string[];
  /** Selected product's approved claims + benefits */
  approvedClaims?: string[];
  category?: string | null;
  offer?: string | null;
  /** Store home / collection URL for the Shop Now end card */
  storeUrl?: string | null;
}): {
  ad: ProductUrlCarouselAd | null;
  skipped: ResolvedCarouselProduct[];
  warnings: string[];
  reelsFrames: string[];
} {
  const withImage = input.products.filter((p) => p.image_url);
  const skipped = input.products.filter((p) => !p.image_url);
  const warnings = skipped.map(
    (p) => `${p.product_url}: ${p.error || 'No image — card skipped'}`
  );
  const { unique, duplicates } = dedupeProducts(withImage);
  for (const duplicate of duplicates) {
    warnings.push(`${duplicate.product_url}: same photo/product as another card — skipped`);
  }

  if (unique.length < CAROUSEL_URL_MIN) {
    return {
      ad: null,
      skipped,
      reelsFrames: [],
      warnings: [
        ...warnings,
        `Need at least ${CAROUSEL_URL_MIN} product URLs with images (got ${unique.length}).`,
      ],
    };
  }

  const usable = unique.slice(0, CAROUSEL_STORY_MAX_PRODUCTS);
  if (unique.length > usable.length) {
    warnings.push(
      `Kept the first ${usable.length} products so the story stays tight — use the other ${
        unique.length - usable.length
      } URL(s) in a second carousel.`
    );
  }

  const brand =
    input.brandName ||
    usable.find((p) => p.brand_name)?.brand_name ||
    'Your brand';
  const ctaLabel = input.ctaLabel || 'Shop Now';
  const storeUrl =
    input.storeUrl ||
    (() => {
      try {
        return new URL(usable[0]!.product_url).origin;
      } catch {
        return usable[0]!.product_url;
      }
    })();
  const domain = domainFromUrl(storeUrl);
  const approvedClaims = input.approvedClaims || [];

  const hook = deriveCarouselHook({
    hookOverride: input.hookOverride,
    claimsText: [...approvedClaims, ...usable.map((p) => p.claims_text)],
    category: input.category,
    brand,
  });

  const userOverlays = (input.overlays || []).filter(Boolean);
  const perCard = usable.map((p) => mineBenefitPhrases([p.claims_text], 4));
  const frequency = new Map<string, number>();
  for (const phrases of perCard) {
    for (const phrase of phrases) frequency.set(phrase, (frequency.get(phrase) || 0) + 1);
  }
  const rangeBenefits = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase);
  const copyBenefits = (
    userOverlays.length
      ? userOverlays
      : rangeBenefits.length
        ? rangeBenefits
        : mineBenefitPhrases(approvedClaims, 3)
  ).slice(0, 3);

  const chips: Array<string | undefined> = [];
  usable.forEach((_, i) => {
    if (i === 0) {
      chips.push(undefined);
      return;
    }
    if (userOverlays.length) {
      chips.push(userOverlays[(i - 1) % userOverlays.length]);
      return;
    }
    const previous = chips[i - 1];
    const own = perCard[i] || [];
    chips.push(own.find((phrase) => phrase !== previous) || own[0]);
  });

  const total = usable.length + 1;
  const productCards: CarouselCard[] = usable.map((product, i) => {
    const name = shortProductName(product.product_name);
    const price = product.price.replace(/\.00\b/, '');
    const role = i === 0 ? 'hook' : 'benefit';
    const chip = chips[i];
    return {
      image_url: buildCarouselCardUrl({
        role,
        brand,
        images: [product.image_url!],
        headline: i === 0 ? hook : undefined,
        product: name,
        price,
        chip,
        index: i + 1,
        total,
      }),
      source_image_url: product.image_url!,
      overlay_role: role,
      overlay_text: i === 0 ? hook : chip,
      headline: name.slice(0, 40),
      description: [price, chip || brand].filter(Boolean).join(' · ').slice(0, 30),
      link: product.product_url,
      product_url: product.product_url,
      product_name: product.product_name,
      price: product.price || undefined,
    };
  });

  const endHeadline = 'Shop the full range';
  const endCard: CarouselCard = {
    image_url: buildCarouselCardUrl({
      role: 'cta',
      brand,
      images: usable.map((p) => p.image_url!),
      headline: endHeadline,
      cta: ctaLabel,
      domain,
    }),
    source_image_url: usable[0]!.image_url!,
    overlay_role: 'cta',
    overlay_text: ctaLabel,
    headline: endHeadline,
    description: (input.offer || domain || brand).slice(0, 30),
    link: storeUrl,
  };
  const cards = [...productCards, endCard];

  const reelsFrames = [
    buildCarouselCardUrl({
      role: 'hook',
      format: 'story_9x16',
      brand,
      images: [usable[0]!.image_url!],
      headline: hook,
      product: shortProductName(usable[0]!.product_name),
      price: usable[0]!.price.replace(/\.00\b/, ''),
    }),
    ...usable.slice(1, 5).map((product, i) =>
      buildCarouselCardUrl({
        role: 'benefit',
        format: 'story_9x16',
        brand,
        images: [product.image_url!],
        product: shortProductName(product.product_name),
        price: product.price.replace(/\.00\b/, ''),
        chip: chips[i + 1],
      })
    ),
    buildCarouselCardUrl({
      role: 'cta',
      format: 'story_9x16',
      brand,
      images: usable.map((p) => p.image_url!),
      headline: endHeadline,
      cta: ctaLabel,
      domain,
    }),
  ];

  const names = usable
    .slice(0, 3)
    .map((p) => shortProductName(p.product_name, 28))
    .join(', ');
  const copyLines = [
    `${hook}${/[.!?]$/.test(hook) ? '' : '.'}${
      copyBenefits.length ? ` ${copyBenefits.join(' · ')}.` : ''
    }`,
    `Swipe to pick your favourite: ${names}${usable.length > 3 ? ' & more' : ''}.`,
    input.offer ? input.offer : '',
    `Tap ${ctaLabel} to order online from ${brand}.`,
  ].filter(Boolean);

  return {
    ad: {
      campaign_input_id: input.campaignInputId,
      variant_number: input.variantNumber || 1,
      copy_text: copyLines.join('\n').slice(0, 2200),
      image_url: cards[0]!.image_url,
      status: 'pending',
      ad_format: 'carousel',
      headline: hook.slice(0, 40),
      angle: 'product-url-carousel',
      media_payload: {
        placement: META_AD_FORMATS.carousel.placement,
        aspect: '1:1',
        cards,
        product_id: input.productId || null,
        product_name: cards[0]?.product_name || null,
        primary_packshot: usable[0]!.image_url,
        template: 'Story carousel (hook · benefits · Shop Now)',
        carousel_source: 'product_urls',
        skipped_urls: [...skipped, ...duplicates].map((p) => p.product_url),
        carousel_story: { hook, benefits: copyBenefits },
      },
    },
    skipped,
    warnings,
    reelsFrames,
  };
}
