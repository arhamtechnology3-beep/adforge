import http from 'http';
import https from 'https';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function fetchRemote(
  mediaUrl: string,
  timeoutMs: number
): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(mediaUrl);
    } catch {
      reject(new Error('Invalid media URL'));
      return;
    }

    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(
      parsed,
      {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          Referer: 'https://www.facebook.com/ads/library/',
        },
      },
      (res) => {
        if ((res.statusCode || 0) >= 300 && (res.statusCode || 0) < 400 && res.headers.location) {
          fetchRemote(res.headers.location, timeoutMs).then(resolve).catch(reject);
          return;
        }
        if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) {
          reject(new Error(`Upstream returned HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: res.headers['content-type'] || 'image/jpeg',
          });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Upstream fetch timed out'));
    });
    req.on('error', reject);
    req.end();
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mediaUrl = searchParams.get('url');

  if (!mediaUrl) {
    return NextResponse.json({ error: 'Missing media URL parameter' }, { status: 400 });
  }

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
    const { buffer, contentType } = await fetchRemote(mediaUrl, 15000);
    return new NextResponse(Uint8Array.from(buffer).buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[competitor-media/proxy]', err instanceof Error ? err.message : err);
    }

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
        'X-Proxy-Error': err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      },
    });
  }
}
