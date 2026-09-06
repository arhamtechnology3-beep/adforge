import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';

export type ProductPageSuggestions = {
  product_url: string;
  brand_name: string;
  product_name: string;
  category: string;
  description: string;
  benefits: string[];
  ingredients: string[];
  approved_claims: string[];
  prohibited_claims: string[];
  price: string;
  offer: string;
  image_urls: string[];
};

const DEFAULT_PROHIBITED_CLAIMS = [
  'Cures disease or medical conditions',
  'FDA approved / clinically proven (unless documented)',
  'Guaranteed results or 100% effectiveness',
  'Before/after medical transformation claims',
  'Weight-loss or detox miracle claims',
];

function splitDescriptionLines(description: string, max = 6): string[] {
  return description
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length >= 18 && sentence.length <= 180)
    .slice(0, max);
}

function extractIngredientsFromText(text: string): string[] {
  const match = text.match(
    /(?:ingredients?|materials?|contains?)\s*[:\-–]\s*([^\n.!?]{8,400})/i
  );
  if (!match?.[1]) return [];
  return match[1]
    .split(/[,;|•]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 80)
    .slice(0, 30);
}

/** Fill gaps and derive reviewable claims so users mostly approve, not type. */
export function enrichProductSuggestions(
  suggestions: Omit<ProductPageSuggestions, 'approved_claims' | 'prohibited_claims'> &
    Partial<Pick<ProductPageSuggestions, 'approved_claims' | 'prohibited_claims'>>
): ProductPageSuggestions {
  const benefits =
    suggestions.benefits?.length > 0
      ? suggestions.benefits
      : splitDescriptionLines(suggestions.description, 5);
  const ingredients =
    suggestions.ingredients?.length > 0
      ? suggestions.ingredients
      : extractIngredientsFromText(suggestions.description);

  const approved =
    suggestions.approved_claims?.length
      ? suggestions.approved_claims
      : benefits
          .slice(0, 5)
          .map((line) => line.replace(/^[•\-\d.)\s]+/, '').trim())
          .filter(Boolean);

  const prohibited =
    suggestions.prohibited_claims?.length
      ? suggestions.prohibited_claims
      : DEFAULT_PROHIBITED_CLAIMS;

  return {
    ...suggestions,
    benefits,
    ingredients,
    approved_claims: approved,
    prohibited_claims: prohibited,
  };
}

function isPrivateAddress(address: string): boolean {
  if (address === '::1' || address.startsWith('fc') || address.startsWith('fd')) return true;
  if (address.startsWith('fe80:')) return true;
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}

async function publicAddresses(host: string): Promise<Array<{ address: string; family: number }>> {
  let addresses: Array<{ address: string; family: number }> = [];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    const response = await fetch(
      `https://1.1.1.1/dns-query?name=${encodeURIComponent(host)}&type=A`,
      {
        headers: { Accept: 'application/dns-json', Host: 'cloudflare-dns.com' },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      }
    );
    if (!response.ok) throw new Error('Could not resolve the product website');
    const payload = (await response.json()) as {
      Answer?: Array<{ type?: number; data?: string }>;
    };
    addresses = (payload.Answer || [])
      .filter((answer) => answer.type === 1 && answer.data && isIP(answer.data))
      .map((answer) => ({ address: answer.data!, family: 4 }));
  }
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('Product URL must resolve to a public website');
  }
  return addresses;
}

async function validatedUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS product URL');
  if (url.username || url.password) throw new Error('Product URL cannot contain credentials');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || (isIP(host) && isPrivateAddress(host))) {
    throw new Error('Private or local product URLs are not allowed');
  }
  await publicAddresses(host);
  return url;
}

function decode(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meta(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return decode(
    html.match(
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
        'i'
      )
    )?.[1] ||
      html.match(
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
          'i'
        )
      )?.[1] ||
      ''
  );
}

function findProduct(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProduct(item);
      if (found) return found;
    }
    return null;
  }
  const record = node as Record<string, unknown>;
  const type = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
  if (type.some((item) => String(item).toLowerCase() === 'product')) return record;
  for (const value of Object.values(record)) {
    const found = findProduct(value);
    if (found) return found;
  }
  return null;
}

function strings(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .flatMap((item) =>
      typeof item === 'object' && item
        ? [String((item as Record<string, unknown>).contentUrl || (item as Record<string, unknown>).url || '')]
        : [String(item)]
    )
    .map(decode)
    .filter(Boolean);
}

async function fetchPage(url: URL, redirects = 0): Promise<{ html: string; url: URL }> {
  const addresses = await publicAddresses(url.hostname);
  const transport = url.protocol === 'https:' ? https : http;
  const result = await new Promise<{
    status: number;
    headers: http.IncomingHttpHeaders;
    html: string;
  }>((resolve, reject) => {
    const request = transport.request(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        lookup: (_hostname, _options, callback) => {
          const selected = addresses[0];
          if (!selected?.address) {
            callback(new Error('Could not resolve product host') as NodeJS.ErrnoException, '', 4);
            return;
          }
          callback(null, selected.address, selected.family);
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 4_000_000) {
            request.destroy(new Error('Product page is too large to import'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode || 0,
            headers: response.headers,
            html: Buffer.concat(chunks).toString('utf8'),
          })
        );
      }
    );
    request.setTimeout(15000, () => request.destroy(new Error('Product page request timed out')));
    request.on('error', reject);
    request.end();
  });
  const location = result.headers.location;
  if (result.status >= 300 && result.status < 400 && location) {
    if (redirects >= 3) throw new Error('Too many redirects');
    return fetchPage(await validatedUrl(new URL(location, url).toString()), redirects + 1);
  }
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Product page returned HTTP ${result.status}`);
  }
  const type = result.headers['content-type'] || '';
  if (!type.includes('text/html')) throw new Error('Product URL did not return an HTML page');
  return { html: result.html, url };
}

export function parseProductPageHtml(
  html: string,
  pageUrl: string | URL
): ProductPageSuggestions {
  const url = pageUrl instanceof URL ? pageUrl : new URL(pageUrl);
  let product: Record<string, unknown> | null = null;
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      product ||= findProduct(JSON.parse(match[1]));
    } catch {
      // Ignore malformed analytics/schema blocks.
    }
  }

  const offerRaw = product?.offers;
  const offer = Array.isArray(offerRaw)
    ? (offerRaw[0] as Record<string, unknown> | undefined)
    : (offerRaw as Record<string, unknown> | undefined);
  const brandRaw = product?.brand;
  const brand =
    typeof brandRaw === 'object' && brandRaw
      ? String((brandRaw as Record<string, unknown>).name || '')
      : String(brandRaw || '');
  const productImages = strings(product?.image);
  const ogImage = meta(html, 'og:image');
  const embeddedImages = [
    ...html.matchAll(
      /["'](?:src|originalSrc)["']\s*:\s*["']((?:(?:\\\/){2}|https?:\/\/)[^"']*cdn(?:\\\/|\/)shop(?:\\\/|\/)(?:files|products)(?:\\\/|\/)[^"']+\.(?:png|jpe?g|webp)[^"']*)["']/gi
    ),
  ].map((match) => match[1].replace(/\\\//g, '/').replace(/^\/\//, 'https://'));
  const images = [...productImages, ogImage, ...embeddedImages]
    .filter(Boolean)
    .map((image) => {
      try {
        return new URL(image, url).toString();
      } catch {
        return '';
      }
    })
    .filter(Boolean)
    .filter((image, index, all) => all.indexOf(image) === index)
    .slice(0, 8);
  const additional = Array.isArray(product?.additionalProperty)
    ? product.additionalProperty
    : [];
  const properties = additional
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      name: decode(String(item.name || '')),
      value: decode(String(item.value || '')),
    }));
  const ingredientProperty = properties.find((item) => /ingredient|material/i.test(item.name));
  const benefits = properties
    .filter((item) => !/ingredient|material|sku|weight|dimension/i.test(item.name))
    .map((item) => `${item.name}: ${item.value}`.replace(/^:\s*/, ''))
    .filter((item) => item.length > 3)
    .slice(0, 8);
  const currency = String(offer?.priceCurrency || '');
  const rawPrice = String(offer?.price || offer?.lowPrice || '');
  const currencyMark = currency === 'INR' ? '₹' : currency ? `${currency} ` : '';
  const title =
    decode(String(product?.name || '')) ||
    meta(html, 'og:title') ||
    decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');

  const description = decode(
    String(product?.description || meta(html, 'og:description'))
  ).slice(0, 1200);
  const inferredCategory = (() => {
    const text = `${title} ${description}`.toLowerCase();
    if (/pickle|achar|achaar/.test(text)) return 'Pickles';
    if (/spice|masala|seasoning/.test(text)) return 'Spices';
    if (/snack|namkeen|chips/.test(text)) return 'Snacks';
    if (/beverage|juice|drink|tea|coffee/.test(text)) return 'Beverages';
    if (/skin|serum|cream|beauty|cosmetic/.test(text)) return 'Beauty & Personal Care';
    if (/shirt|dress|apparel|clothing|fashion/.test(text)) return 'Fashion';
    return '';
  })();
  const descriptionBenefits = description
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20 && sentence.length <= 180)
    .slice(0, 5);

  return enrichProductSuggestions({
    product_url: url.toString(),
    brand_name: decode(brand || meta(html, 'og:site_name')),
    product_name: title.slice(0, 180),
    category: (decode(String(product?.category || '')) || inferredCategory).slice(0, 120),
    description,
    benefits: benefits.length ? benefits : descriptionBenefits,
    ingredients: ingredientProperty
      ? ingredientProperty.value.split(/[,|]/).map((item) => item.trim()).filter(Boolean).slice(0, 30)
      : extractIngredientsFromText(description),
    price: rawPrice ? `${currencyMark}${rawPrice}` : '',
    offer: '',
    image_urls: images,
  });
}

type ShopifyProductJson = {
  id?: number;
  title?: string;
  handle?: string;
  vendor?: string;
  product_type?: string;
  body_html?: string;
  images?: Array<{ src?: string }>;
  image?: { src?: string };
  variants?: Array<{ price?: string }>;
};

function productHandleFromUrl(url: URL): string | null {
  const match = url.pathname.match(/\/products\/([^/?#]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return match[1].trim();
  }
}

function shopifyToSuggestions(
  product: ShopifyProductJson,
  storeOrigin: string,
  requestedUrl: string
): ProductPageSuggestions {
  const handle = product.handle || productHandleFromUrl(new URL(requestedUrl)) || '';
  const canonical = handle ? `${storeOrigin}/products/${handle}` : requestedUrl;
  const images = [
    ...(product.images || []).map((img) => String(img.src || '')),
    String(product.image?.src || ''),
  ]
    .filter(Boolean)
    .filter((image, index, all) => all.indexOf(image) === index)
    .slice(0, 8);
  const price = product.variants?.[0]?.price
    ? `₹${product.variants[0].price}`
    : '';
  const description = decode(String(product.body_html || '')).slice(0, 1200);
  return enrichProductSuggestions({
    product_url: canonical,
    brand_name: decode(String(product.vendor || '')),
    product_name: decode(String(product.title || handle || 'Product')).slice(0, 180),
    category: decode(String(product.product_type || '')).slice(0, 120),
    description,
    benefits: splitDescriptionLines(description, 5),
    ingredients: extractIngredientsFromText(description),
    price,
    offer: '',
    image_urls: images,
  });
}

function scoreShopifyHandle(requested: string, candidate: string): number {
  const a = requested.toLowerCase();
  const b = candidate.toLowerCase();
  if (a === b) return 1000;
  if (b.startsWith(`${a}-`)) return 800 - Math.min(200, b.length - a.length);
  if (b.includes(a)) return 500 - Math.min(200, b.length - a.length);
  const aParts = a.split('-').filter(Boolean);
  const bParts = new Set(b.split('-').filter(Boolean));
  const overlap = aParts.filter((part) => bParts.has(part)).length;
  if (overlap === 0) return -1;
  return overlap * 50 + (overlap === aParts.length ? 100 : 0);
}

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; json: unknown }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
    redirect: 'follow',
  });
  if (!response.ok) {
    return { ok: false, status: response.status, json: null };
  }
  const json = await response.json().catch(() => null);
  return { ok: true, status: response.status, json };
}

/**
 * Shopify-friendly resolver: /products/{handle}.json, then catalog fuzzy match
 * when short handles 404 (e.g. gor-keri-pickle → gor-keri-pickle-jaggery-...).
 */
export async function suggestFromShopifyStore(
  value: string
): Promise<ProductPageSuggestions | null> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  const handle = productHandleFromUrl(url);
  if (!handle) return null;
  const origin = url.origin;

  const exact = await fetchJson(`${origin}/products/${encodeURIComponent(handle)}.json`);
  if (exact.ok && exact.json && typeof exact.json === 'object') {
    const product = (exact.json as { product?: ShopifyProductJson }).product;
    if (product?.title || product?.images?.length) {
      return shopifyToSuggestions(product, origin, value);
    }
  }

  const catalog = await fetchJson(`${origin}/products.json?limit=250`);
  if (!catalog.ok || !catalog.json || typeof catalog.json !== 'object') return null;
  const products = (catalog.json as { products?: ShopifyProductJson[] }).products || [];
  let best: { product: ShopifyProductJson; score: number } | null = null;
  for (const product of products) {
    if (!product.handle) continue;
    const score = scoreShopifyHandle(handle, product.handle);
    if (score < 0) continue;
    if (!best || score > best.score) best = { product, score };
  }
  if (!best || best.score < 100) return null;
  return shopifyToSuggestions(best.product, origin, value);
}

export async function suggestProductFromPage(value: string): Promise<ProductPageSuggestions> {
  const shopify = await suggestFromShopifyStore(value);
  if (shopify?.image_urls?.length) return enrichProductSuggestions(shopify);

  const initial = await validatedUrl(value);
  try {
    const { html, url } = await fetchPage(initial);
    const parsed = parseProductPageHtml(html, url);
    if (parsed.image_urls.length || !shopify) return enrichProductSuggestions(parsed);
    return enrichProductSuggestions(shopify);
  } catch (error) {
    if (shopify) return enrichProductSuggestions(shopify);
    // Last resort: plain fetch (avoids custom DNS lookup failures)
    try {
      const response = await fetch(initial.toString(), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(20000),
        cache: 'no-store',
        redirect: 'follow',
      });
      if (!response.ok) throw new Error(`Product page returned HTTP ${response.status}`);
      const html = await response.text();
      return enrichProductSuggestions(parseProductPageHtml(html, response.url || initial.toString()));
    } catch {
      throw error;
    }
  }
}

/** Safe fetch of a public product image for packshot import (SSRF-hardened). */
export async function fetchPublicProductImage(value: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const url = await validatedUrl(value);
  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`Image URL returned HTTP ${response.status}`);
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) {
    throw new Error('URL did not return an image');
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error('The image is empty');
  if (buffer.length > 10 * 1024 * 1024) throw new Error('Image too large (max 10MB)');
  return { buffer, contentType };
}
