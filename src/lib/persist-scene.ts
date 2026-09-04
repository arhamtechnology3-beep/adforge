import { mkdir, writeFile } from 'fs/promises';
import https from 'https';
import http from 'http';
import path from 'path';
import { randomUUID } from 'crypto';

function fetchBuffer(url: string, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error('Invalid URL'));
      return;
    }
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(
      parsed,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/*',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchBuffer(res.headers.location, timeoutMs).then(resolve).catch(reject);
          return;
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

/** Save remote scene to /public/uploads/scenes for short creative URLs + reliable Satori load. */
export async function persistSceneUrl(url: string): Promise<string> {
  if (!url || url.startsWith('/uploads/') || url.startsWith('/api/')) return url;
  try {
    const buf = await fetchBuffer(url, 45000);
    if (buf.length < 500) return url;
    const dir = path.join(process.cwd(), 'public', 'uploads', 'scenes');
    await mkdir(dir, { recursive: true });
    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.jpg`;
    await writeFile(path.join(dir, filename), buf);
    return `/uploads/scenes/${filename}`;
  } catch (err) {
    console.warn('[persist-scene]', err instanceof Error ? err.message : err);
    return url;
  }
}
