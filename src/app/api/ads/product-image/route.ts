import { NextResponse } from 'next/server';
import sharp from 'sharp';
import {
  measureOpaqueRatio,
  padImageToAspect,
  restoreInvisiblePackshot,
} from '@/lib/creative-assets';

/**
 * Same-origin product image proxy so Meta creatives can embed brand photos
 * without the OG renderer hanging on flaky external hosts.
 * Also repairs historical cutouts that were saved fully transparent.
 * Optional `pad=9:16|4:5|1:1` fits the image into that canvas without cropping.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get('src');
  const pad = searchParams.get('pad');

  if (!src || !/^https?:\/\//i.test(src)) {
    return NextResponse.json({ error: 'Valid src required' }, { status: 400 });
  }

  try {
    const res = await fetch(src, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 MetaAdsBot/1.0',
        Accept: 'image/*',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream image failed' }, { status: 502 });
    }

    let contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 400 });
    }

    let output: Buffer = Buffer.from(await res.arrayBuffer());
    if (!output.length) {
      return NextResponse.json({ error: 'Empty image' }, { status: 502 });
    }

    try {
      if ((await measureOpaqueRatio(output)) < 0.02) {
        const restored = await restoreInvisiblePackshot(output);
        if (restored) {
          output = Buffer.from(restored);
          contentType = 'image/png';
        }
      }
    } catch {
      /* keep original bytes if sharp can't inspect */
    }

    const padAspect =
      pad === '9:16' || pad === '4:5' || pad === '1:1' ? pad : null;
    if (padAspect) {
      try {
        let source = output;
        // Strip prior black/dark letterbox so we can rebuild a full-bleed cover
        if (padAspect !== '1:1') {
          try {
            const trimmed = await sharp(output)
              .trim({
                background: { r: 17, g: 24, b: 39, alpha: 1 },
                threshold: 32,
              })
              .png()
              .toBuffer();
            const before = await sharp(output).metadata();
            const after = await sharp(trimmed).metadata();
            if (
              before.height &&
              after.height &&
              after.height < before.height * 0.92
            ) {
              source = trimmed;
            }
          } catch {
            /* keep source */
          }
        }
        const meta = await sharp(source).metadata();
        const ratio =
          meta.width && meta.height ? meta.width / meta.height : 1;
        const expected =
          padAspect === '9:16' ? 9 / 16 : padAspect === '4:5' ? 4 / 5 : 1;
        // Always rebuild vertical canvases for full-bleed cover (not solid bars)
        if (padAspect !== '1:1' || Math.abs(ratio - expected) > 0.03) {
          const padded = await padImageToAspect(source, padAspect);
          output = Buffer.from(padded.buffer);
          contentType = 'image/png';
        }
      } catch {
        /* keep original if pad fails */
      }
    }

    return new NextResponse(new Uint8Array(output), {
      status: 200,
      headers: {
        'Content-Type': contentType.startsWith('image/') ? contentType : 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}
