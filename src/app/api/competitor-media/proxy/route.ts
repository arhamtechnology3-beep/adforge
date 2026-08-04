import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mediaUrl = searchParams.get('url');

  if (!mediaUrl) {
    return NextResponse.json({ error: 'Missing media URL parameter' }, { status: 400 });
  }

  // Handle data: URLs directly
  if (mediaUrl.startsWith('data:')) {
    const parts = mediaUrl.split(',');
    const mimeMatch = parts[0].match(/data:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/svg+xml';
    const body = decodeURIComponent(parts[1] || '');
    return new NextResponse(body, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  try {
    const res = await fetch(mediaUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Upstream returned HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    // Return SVG fallback if remote image fails
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
      <rect width="600" height="450" fill="#F3F4F6"/>
      <rect x="200" y="120" width="200" height="180" rx="16" fill="#E5E7EB" stroke="#D1D5DB" stroke-width="4"/>
      <circle cx="300" cy="180" r="40" fill="#9CA3AF"/>
      <polygon points="300,160 315,190 285,190" fill="#FFFFFF"/>
      <text x="300" y="340" font-family="sans-serif" font-size="16" font-weight="bold" fill="#6B7280" text-anchor="middle">Meta Ad Library Media</text>
    </svg>`;

    return new NextResponse(fallbackSvg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
      },
    });
  }
}
