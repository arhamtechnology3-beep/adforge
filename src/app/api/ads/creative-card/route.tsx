import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { ogSafeText } from '@/lib/og-text';
import { loadOgFonts } from '@/lib/og-fonts';
import { optimizeProductImageUrl } from '@/lib/creatives';
import { unwrapProxiedProductImage } from '@/lib/product-image-preference';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PALETTE = {
  bg: '#1c1209',
  accent: '#f59e0b',
  accentText: '#1c1209',
  text: '#ffffff',
  muted: '#fde7c2',
};

// Shared hosting fails image decoding when many cards render at once — cap in-flight work.
const MAX_IMAGE_JOBS = 2;
let activeImageJobs = 0;
const imageQueue: Array<() => void> = [];

async function withImageSlot<T>(job: () => Promise<T>): Promise<T> {
  if (activeImageJobs >= MAX_IMAGE_JOBS) {
    await new Promise<void>((resolve) => imageQueue.push(resolve));
  }
  activeImageJobs += 1;
  try {
    return await job();
  } finally {
    activeImageJobs -= 1;
    imageQueue.shift()?.();
  }
}

async function readCoverImage(
  raw: string,
  origin: string,
  width: number,
  height: number
): Promise<string> {
  const unwrapped = unwrapProxiedProductImage(raw);
  let buf: Buffer;
  if (unwrapped.startsWith('/uploads/')) {
    buf = await fs.promises.readFile(
      path.join(process.cwd(), 'public', unwrapped.replace(/^\//, ''))
    );
  } else {
    const absolute = unwrapped.startsWith('/') ? `${origin}${unwrapped}` : unwrapped;
    const res = await fetch(optimizeProductImageUrl(absolute, 1080), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`image HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  if (!buf.length) throw new Error('image empty');
  const jpeg = await sharp(buf)
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 84 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

async function loadCoverDataUrl(
  raw: string,
  origin: string,
  width: number,
  height: number
): Promise<{ data: string | null; error?: string }> {
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return { data: await withImageSlot(() => readCoverImage(raw, origin, width, height)) };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn('[creative-card] image attempt failed', attempt + 1, lastError);
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return { data: null, error: lastError };
}

function cleanPrice(price: string): string {
  return price.replace(/\.00\b/, '').trim();
}

/**
 * Story-led carousel / Reels card.
 * role=hook: card 1 headline · role=benefit: benefit chip + product · role=cta: Shop Now end card.
 */
export async function GET(request: Request) {
  try {
    const fonts = loadOgFonts();
    const url = new URL(request.url);
    const q = url.searchParams;
    const role = q.get('role') || 'benefit';
    const isStory = q.get('format') === 'story_9x16';
    const width = 1080;
    const height = isStory ? 1920 : 1080;
    const brand = ogSafeText(q.get('brand') || '', 48);
    const headline = ogSafeText(q.get('headline') || '', 60);
    const product = ogSafeText(q.get('product') || '', 40);
    const price = cleanPrice(ogSafeText(q.get('price') || '', 16));
    const chip = ogSafeText(q.get('chip') || '', 28);
    const cta = ogSafeText(q.get('cta') || 'Shop Now', 20);
    const domain = ogSafeText(q.get('domain') || '', 48);
    const index = Number(q.get('i')) || 0;
    const total = Number(q.get('n')) || 0;
    const images = q.getAll('img').filter(Boolean);
    const pad = 56;

    if (role === 'cta') {
      const thumbSize = isStory ? 260 : 250;
      const thumbs = (
        await Promise.all(
          images.slice(0, 4).map((src) => loadCoverDataUrl(src, url.origin, thumbSize, thumbSize))
        )
      )
        .map((result) => result.data)
        .filter((src): src is string => Boolean(src));
      const grid = thumbs.length >= 4 ? thumbs.slice(0, 4) : thumbs.slice(0, Math.min(2, thumbs.length));

      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isStory ? 28 : 30,
              // 9:16: content stays between 14% from the top and 35% from the bottom.
              padding: isStory ? '270px 64px 672px' : `${pad}px`,
              background: `radial-gradient(circle at 50% 30%, #4a2a0c 0%, ${PALETTE.bg} 75%)`,
              fontFamily: 'Noto Sans, Noto Sans Devanagari',
              color: PALETTE.text,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: isStory ? 40 : 32,
                fontWeight: 700,
                color: PALETTE.muted,
                letterSpacing: 1,
              }}
            >
              {brand.toUpperCase()}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: isStory ? 72 : 60,
                fontWeight: 700,
                lineHeight: 1.1,
                textAlign: 'center',
                justifyContent: 'center',
                maxWidth: 940,
              }}
            >
              {headline || 'Shop the full range'}
            </div>
            {grid.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: 18,
                  width: thumbSize * 2 + 18,
                }}
              >
                {grid.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={src}
                    alt=""
                    width={thumbSize}
                    height={thumbSize}
                    style={{ borderRadius: 24, border: '4px solid rgba(255,255,255,0.15)' }}
                  />
                ))}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                background: PALETTE.accent,
                color: PALETTE.accentText,
                fontSize: isStory ? 54 : 50,
                fontWeight: 700,
                padding: isStory ? '24px 80px' : '22px 72px',
                borderRadius: 999,
                boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
              }}
            >
              {cta}
            </div>
            {domain && (
              <div style={{ display: 'flex', fontSize: isStory ? 34 : 28, color: PALETTE.muted }}>
                {domain}
              </div>
            )}
          </div>
        ),
        { width, height, fonts }
      );
    }

    const loaded = images[0]
      ? await loadCoverDataUrl(images[0], url.origin, width, height)
      : { data: null, error: 'no img param' };
    const photo = loaded.data;
    if (!photo) {
      return NextResponse.json(
        { error: 'Product image could not be loaded', detail: loaded.error },
        { status: 422 }
      );
    }

    const isHook = role === 'hook';
    // Reels/Stories: all text sits in the band below the top 14% (Meta UI covers top + bottom 35%).
    const textTop = isStory ? Math.round(height * 0.14) : pad;

    const productBlock = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!isHook && chip && (
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              background: PALETTE.accent,
              color: PALETTE.accentText,
              fontSize: isStory ? 48 : 40,
              fontWeight: 700,
              padding: '12px 28px',
              borderRadius: 16,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            }}
          >
            {chip}
          </div>
        )}
        {product && (
          <div
            style={{
              display: 'flex',
              fontSize: isStory ? 64 : 54,
              fontWeight: 700,
              lineHeight: 1.1,
              textShadow: '0 4px 14px rgba(0,0,0,0.6)',
            }}
          >
            {product}
          </div>
        )}
        {price && (
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              background: 'rgba(255,255,255,0.92)',
              color: '#111827',
              fontSize: isStory ? 40 : 34,
              fontWeight: 700,
              padding: '8px 22px',
              borderRadius: 999,
            }}
          >
            {price}
          </div>
        )}
      </div>
    );

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            position: 'relative',
            fontFamily: 'Noto Sans, Noto Sans Devanagari',
            color: PALETTE.text,
            background: PALETTE.bg,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            width={width}
            height={height}
            style={{ position: 'absolute', top: 0, left: 0, width, height }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              background: isStory
                ? 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.55) 32%, rgba(0,0,0,0) 50%)'
                : isHook
                ? 'linear-gradient(to bottom, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 38%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)'
                : 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.8) 100%)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: textTop,
              left: pad,
              right: pad,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(0,0,0,0.55)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  fontSize: 28,
                  fontWeight: 700,
                  padding: '8px 20px',
                  borderRadius: 999,
                }}
              >
                {brand}
              </div>
              {total > 1 && index > 0 && !isStory && (
                <div
                  style={{
                    display: 'flex',
                    background: 'rgba(0,0,0,0.55)',
                    fontSize: 26,
                    fontWeight: 700,
                    padding: '8px 18px',
                    borderRadius: 999,
                  }}
                >
                  {`${index}/${total}`}
                </div>
              )}
            </div>
            {isHook && headline && (
              <div
                style={{
                  display: 'flex',
                  fontSize: isStory ? 92 : 80,
                  fontWeight: 700,
                  lineHeight: 1.06,
                  maxWidth: 940,
                  textShadow: '0 4px 18px rgba(0,0,0,0.6)',
                }}
              >
                {headline}
              </div>
            )}
            {isHook && !isStory && (
              <div
                style={{
                  display: 'flex',
                  alignSelf: 'flex-start',
                  background: PALETTE.accent,
                  color: PALETTE.accentText,
                  fontSize: 30,
                  fontWeight: 700,
                  padding: '10px 24px',
                  borderRadius: 999,
                }}
              >
                Swipe to explore
              </div>
            )}
            {isStory && productBlock}
          </div>

          {!isStory && (
            <div
              style={{
                position: 'absolute',
                left: pad,
                right: pad,
                bottom: pad,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {productBlock}
            </div>
          )}
        </div>
      ),
      { width, height, fonts }
    );
  } catch (error) {
    console.error('[creative-card]', error);
    return NextResponse.json(
      {
        error: 'Creative card render failed',
        detail: error instanceof Error ? error.message.slice(0, 300) : String(error),
      },
      { status: 500 }
    );
  }
}
