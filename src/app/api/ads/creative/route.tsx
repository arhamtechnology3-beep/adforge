import { ImageResponse } from 'next/og';
import {
  ANGLE_PALETTES,
  META_CREATIVE_SPECS,
  type CreativeFormat,
} from '@/lib/creatives';
import { optimizeProductImageUrl } from '@/lib/creatives';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_HERO_BYTES = 1_400_000;

/**
 * Fetch hero image into a data URL so ImageResponse never hangs on
 * multi-MB Shopify banners or flaky remote hosts.
 */
async function loadHeroDataUrl(raw: string | null): Promise<string | null> {
  if (!raw) return null;
  try {
    const src = optimizeProductImageUrl(raw, 1080);
    const res = await fetch(src, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/jpeg,image/png,image/*,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;
    // Satori/ImageResponse crashes on WebP ("a is not iterable")
    if (/webp/i.test(contentType)) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_HERO_BYTES) return null;

    const safeType = /png/i.test(contentType)
      ? 'image/png'
      : /gif/i.test(contentType)
        ? 'image/gif'
        : 'image/jpeg';

    return `data:${safeType};base64,${buf.toString('base64')}`;
  } catch (err) {
    console.warn('[creative] hero fetch skipped', err instanceof Error ? err.message : err);
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
    const brand = searchParams.get('brand') || 'Your Brand';
    const headline = searchParams.get('headline') || 'Discover quality products';
    const subline = searchParams.get('subline') || 'Authentic products for India';
    const angle = searchParams.get('angle') || 'offer-led';
    const cta = searchParams.get('cta') || 'Shop Now';
    const badge = searchParams.get('badge') || 'FEATURED';
    const productImage = searchParams.get('img');
    const sceneImage = searchParams.get('scene');
    const format = (searchParams.get('format') || 'feed_1x1') as CreativeFormat;

    const spec = META_CREATIVE_SPECS[format] || META_CREATIVE_SPECS.feed_1x1;
    const palette = ANGLE_PALETTES[angle] || ANGLE_PALETTES['offer-led'];
    const isStory = format === 'story_9x16';
    const isLandscape = format === 'landscape_1_91';
    const pad = isStory ? 56 : isLandscape ? 36 : 44;
    const headlineSize = isStory ? 64 : isLandscape ? 42 : 52;
    const sublineSize = isStory ? 30 : 26;
    const badgeSize = isStory ? 26 : 24;
    const ctaSize = isStory ? 30 : 28;

    // Load authentic website product packshot and AI background scene
    const [productSrc, sceneSrc] = await Promise.all([
      loadHeroDataUrl(productImage),
      loadHeroDataUrl(sceneImage),
    ]);

    // Fallback if neither loaded: use whichever is available or gradient
    const bgSrc = sceneSrc || (!productSrc ? await loadHeroDataUrl(productImage) : null);

    // Trend-based floating sticker callout
    const trendCallouts: Record<string, string> = {
      'competitor-beat': '🏆 OUR BATCH vs OTHER BRANDS · WHY SHOPPERS SWITCH',
      'trending-ugc': '⭐ 4.9/5 RATED · 10,000+ HAPPY BUYERS',
      'unboxing-pov': '📦 VIRAL UNBOXING FIND ON REELS',
      'rating-social-proof': '⭐⭐⭐⭐⭐ 4.9/5 VERIFIED CUSTOMER REVIEWS',
      'stock-fomo': '🚨 RESTOCK ALERT · BATCH #4 SELLING FAST',
      'clean-ingredient': '🌿 100% NATURAL · ZERO PRESERVATIVES',
      'festive-celebration': '✨ FESTIVE THALI & CELEBRATION SPECIAL',
      comparison: '⚖️ AUTHENTIC BATCH vs MASS MARKET',
      'aesthetic-studio': '💎 D2C PREMIUM SELECTION',
      'founder-craft': '🏡 TRADITIONAL HANDMADE SAURASHTRA RECIPE',
      'offer-led': '🔥 EXCLUSIVE BUNDLE OFFER LIVE',
    };
    const trendCallout = trendCallouts[angle] || null;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: palette.bg,
            fontFamily: 'sans-serif',
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
                  filter: productSrc ? 'blur(3px) brightness(0.85)' : 'none',
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

          {/* Authentic Product Hero Spotlight — Product kept 100% intact (logo, colors, design, shape) */}
          {productSrc && (
            <div
              style={{
                position: 'absolute',
                top: isStory ? '18%' : '14%',
                left: '8%',
                right: '8%',
                height: isStory ? '48%' : '48%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Product Hero Image with objectFit contain so product is never cropped/altered */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={productSrc}
                alt={brand}
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.5))',
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
      }
    );
  } catch (err) {
    console.error('[creative]', err);
    return new Response('Creative render failed', { status: 500 });
  }
}
