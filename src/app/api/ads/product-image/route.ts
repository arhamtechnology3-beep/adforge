import { NextResponse } from 'next/server';

/**
 * Same-origin product image proxy so Meta creatives can embed brand photos
 * without the OG renderer hanging on flaky external hosts.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get('src');

  if (!src || !/^https?:\/\//i.test(src)) {
    return NextResponse.json({ error: 'Valid src required' }, { status: 400 });
  }

  try {
    const res = await fetch(src, {
      signal: AbortSignal.timeout(6000),
      headers: {
        'User-Agent': 'Mozilla/5.0 MetaAdsBot/1.0',
        Accept: 'image/*',
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream image failed' }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 400 });
    }

    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}
