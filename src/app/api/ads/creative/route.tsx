import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';
import {
  ANGLE_PALETTES,
  META_CREATIVE_SPECS,
  type CreativeFormat,
} from '@/lib/creatives';
import { optimizeProductImageUrl } from '@/lib/creatives';
import { ogSafeText } from '@/lib/og-text';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_HERO_BYTES = 3_500_000;
const fontData = [
  {
    name: 'Noto Sans',
    data: Uint8Array.from(
      fs.readFileSync(
        path.join(
          process.cwd(),
          'node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'
        )
      )
    ).buffer,
    weight: 400 as const,
  },
  {
    name: 'Noto Sans',
    data: Uint8Array.from(
      fs.readFileSync(
        path.join(
          process.cwd(),
          'node_modules/@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff'
        )
      )
    ).buffer,
    weight: 700 as const,
  },
  {
    name: 'Noto Sans Devanagari',
    data: Uint8Array.from(
      fs.readFileSync(
        path.join(
          process.cwd(),
          'node_modules/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff'
        )
      )
    ).buffer,
    weight: 400 as const,
  },
  {
    name: 'Noto Sans Devanagari',
    data: Uint8Array.from(
      fs.readFileSync(
        path.join(
          process.cwd(),
          'node_modules/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff'
        )
      )
    ).buffer,
    weight: 700 as const,
  },
];

function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Fetch hero image into a PNG data URL so ImageResponse never hangs on
 * multi-MB Shopify banners, WebP/AVIF, or flaky remote hosts.
 */
async function loadHeroDataUrl(raw: string | null, origin?: string): Promise<string | null> {
  if (!raw) return null;
  try {
    let buf: Buffer;
    if (raw.startsWith('/uploads/')) {
      const local = await readLocalUploadBuffer(raw);
      if (!local) return null;
      buf = local;
    } else {
      const resolved = raw.startsWith('/') && origin ? `${origin}${raw}` : raw;
      const src = optimizeProductImageUrl(resolved, 1080);
      const res = await fetchWithTimeout(
        src,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          },
          cache: 'no-store',
        },
        12000
      );
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
        return null;
      }
      buf = Buffer.from(await res.arrayBuffer());
    }
    if (buf.length === 0 || buf.length > MAX_HERO_BYTES * 4) return null;

    // Always normalize to PNG — Satori crashes on WebP/AVIF ("a is not iterable").
    let png = await sharp(buf)
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();

    // Historical cutouts sometimes wiped alpha to 0 while keeping RGB — restore so bake isn't blank.
    const { measureOpaqueRatio, restoreInvisiblePackshot } = await import('@/lib/creative-assets');
    if ((await measureOpaqueRatio(png)) < 0.02) {
      const restored = await restoreInvisiblePackshot(png);
      if (restored) png = restored;
    }
    if ((await measureOpaqueRatio(png)) < 0.02) return null;

    // Keep under ImageResponse payload limits without dropping valid packshots.
    if (png.length > MAX_HERO_BYTES) {
      png = await sharp(png)
        .resize(900, 900, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
    }
    if (!png.length || png.length > MAX_HERO_BYTES) return null;
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch (err) {
    console.warn('[creative] hero fetch skipped', err instanceof Error ? err.message : err);
    return null;
  }
}

async function readLocalUploadBuffer(publicPath: string): Promise<Buffer | null> {
  try {
    const absolute = path.join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
    return await fs.promises.readFile(absolute);
  } catch {
    return null;
  }
}

/**
 * Meta Feed 1:1 creative matched to ad content.
 * Layout: full-bleed product/scene photo + gradient + badge/headline/subline/CTA
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = new URL(request.url).origin;
    const brand = ogSafeText(searchParams.get('brand') || 'Your Brand', 48);
    const headline = ogSafeText(searchParams.get('headline') || 'Discover quality products', 60);
    const subline = ogSafeText(searchParams.get('subline') || 'Authentic products for India', 70);
    const angle = searchParams.get('angle') || 'offer-led';
    const cta = ogSafeText(searchParams.get('cta') || 'Shop Now', 24);
    const badge = ogSafeText(searchParams.get('badge') || 'FEATURED', 28);
    const productImage = searchParams.get('img');
    const sceneImage = searchParams.get('scene');
    const format = (searchParams.get('format') || 'feed_1x1') as CreativeFormat;
    const template = searchParams.get('template') || 'hero-product';

    const spec = META_CREATIVE_SPECS[format] || META_CREATIVE_SPECS.feed_1x1;
    const palette = ANGLE_PALETTES[angle] || ANGLE_PALETTES['offer-led'];
    const isStory = format === 'story_9x16';
    const isPortrait = format === 'feed_4x5';
    const isLandscape = format === 'landscape_1_91';
    const pad = isStory ? 56 : isLandscape ? 36 : isPortrait ? 40 : 44;
    const headlineSize = isStory ? 64 : isLandscape ? 42 : isPortrait ? 48 : 52;
    const sublineSize = isStory ? 30 : 26;
    const badgeSize = isStory ? 26 : 24;
    const ctaSize = isStory ? 30 : 28;

    // Load authentic website product packshot and AI background scene
    const [productSrc, sceneSrc] = await Promise.all([
      loadHeroDataUrl(productImage, origin),
      loadHeroDataUrl(sceneImage, origin),
    ]);
    if (!productImage || !productSrc) {
      return NextResponse.json(
        { error: 'An approved, loadable product packshot is required' },
        { status: 422 }
      );
    }

    const bgSrc = sceneSrc;

    // Template labels describe layout only; they never introduce unapproved claims.
    const templateLabels: Record<string, string> = {
      'offer-card': 'SPECIAL OFFER',
      'benefit-proof': 'PRODUCT BENEFIT',
      'recipe-lifestyle': 'LIFESTYLE IDEA',
      'variety-grid': 'PRODUCT RANGE',
      'hero-product': 'FEATURED PRODUCT',
    };
    const trendCallout = templateLabels[template] || null;
    const productTop =
      template === 'recipe-lifestyle'
        ? isStory
          ? '18%'
          : '18%'
        : isStory
          ? '12%'
          : '12%';
    // Stories need a taller product window so packshots aren't squeezed/cropped by overlays
    const productHeight =
      template === 'offer-card' ? (isStory ? '52%' : '44%') : isStory ? '58%' : '50%';

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: palette.bg,
            fontFamily: 'Noto Sans, Noto Sans Devanagari',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background Layer (Campaign Scene Backdrop or Rich Gradient) */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
            }}
          >
            {bgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bgSrc}
                alt=""
                width={spec.width}
                height={spec.height}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: productSrc ? 'brightness(0.9) saturate(1.05)' : 'none',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  background: `radial-gradient(circle at 50% 35%, ${palette.accent}44 0%, ${palette.bg} 85%)`,
                }}
              />
            )}
          </div>

          {/* Vignette Overlay for Crisp Contrast */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              display: 'flex',
              background: `linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 25%, ${palette.overlay} 65%, ${palette.overlay} 100%)`,
            }}
          />

          {/* Darken center zone so AI ghost products don't show through the packshot */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: productTop,
              height: productHeight,
              display: 'flex',
              background:
                'radial-gradient(ellipse 72% 88% at 50% 48%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.28) 52%, transparent 78%)',
            }}
          />

          {/* Authentic Product Hero Spotlight — Product kept 100% intact (logo, colors, design, shape) */}
          {productSrc && (
            <div
              style={{
                position: 'absolute',
                top: productTop,
                left: '8%',
                right: '8%',
                height: productHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Soft contact shadow under packshot */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '6%',
                  width: '58%',
                  height: '10%',
                  display: 'flex',
                  background:
                    'radial-gradient(ellipse at center, rgba(0,0,0,0.48) 0%, transparent 72%)',
                  filter: 'blur(10px)',
                }}
              />
              {/* Product Hero Image with objectFit contain so product is never cropped/altered */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={productSrc}
                alt={brand}
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  filter:
                    'drop-shadow(0 24px 36px rgba(0,0,0,0.55)) drop-shadow(0 4px 12px rgba(0,0,0,0.35))',
                }}
              />
            </div>
          )}

          {/* Header Bar: Badge & Brand Tag */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: `${pad}px ${pad}px`,
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  background: palette.accent,
                  color: '#111827',
                  fontSize: badgeSize,
                  fontWeight: 800,
                  padding: '10px 20px',
                  borderRadius: 999,
                  letterSpacing: 0.5,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                }}
              >
                {badge}
              </div>
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: badgeSize,
                  fontWeight: 700,
                  padding: '10px 20px',
                  borderRadius: 999,
                }}
              >
                {brand}
              </div>
            </div>

            {/* Market Trend Callout Sticker */}
            {trendCallout && (
              <div
                style={{
                  display: 'flex',
                  alignSelf: 'flex-start',
                  background: 'rgba(255,255,255,0.92)',
                  color: '#0f172a',
                  fontSize: badgeSize - 4,
                  fontWeight: 800,
                  padding: '8px 16px',
                  borderRadius: 12,
                  boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                  letterSpacing: 0.3,
                }}
              >
                {trendCallout}
              </div>
            )}
          </div>

          {/* Bottom Card: Subline, Headline, CTA */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: `${pad}px ${pad}px ${pad + 6}px`,
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                color: palette.muted,
                fontSize: sublineSize,
                fontWeight: 600,
                letterSpacing: 0.2,
              }}
            >
              {subline}
            </div>

            <div
              style={{
                display: 'flex',
                color: palette.text,
                fontSize: headlineSize,
                fontWeight: 800,
                lineHeight: 1.15,
                maxWidth: isStory ? 960 : 960,
              }}
            >
              {headline}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  background: palette.accent,
                  color: '#111827',
                  fontSize: ctaSize,
                  fontWeight: 800,
                  padding: '16px 32px',
                  borderRadius: 16,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                }}
              >
                {cta}
              </div>
              <div
                style={{
                  display: 'flex',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: isStory ? 22 : 20,
                  fontWeight: 600,
                }}
              >
                {spec.label} · {spec.width}×{spec.height}
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: spec.width,
        height: spec.height,
        fonts: fontData,
      }
    );
  } catch (err) {
    console.error('[creative]', err);
    return new Response('Creative render failed', { status: 500 });
  }
}
