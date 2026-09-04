import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const DEFAULT_URL = 'https://image-api.arhamtechnology3.workers.dev';
const TIMEOUT_MS = 90_000;

export type ArhamImageInput = {
  prompt: string;
  negativePrompt?: string;
  aspect?: '1:1' | '4:5' | '9:16';
};

function apiUrl(): string {
  return (process.env.ARHAM_IMAGE_API_URL || DEFAULT_URL).replace(/\/$/, '');
}

function apiToken(): string | null {
  const token = process.env.ARHAM_IMAGE_API_TOKEN?.trim();
  return token || null;
}

export function arhamImageConfigured(): boolean {
  return Boolean(apiToken());
}

async function saveSceneBytes(bytes: Buffer): Promise<string> {
  const dir = path.join(process.cwd(), 'public', 'uploads', 'scenes');
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.jpg`;
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/scenes/${filename}`;
}

/**
 * Generate an image via the Arham Cloudflare Worker proxy.
 * POST { prompt } → raw image bytes (jpeg).
 */
export async function generateArhamImage(
  input: ArhamImageInput
): Promise<{ url: string; model: string } | null> {
  const token = apiToken();
  if (!token) return null;

  const aspectHint =
    input.aspect === '9:16'
      ? 'Vertical 9:16 portrait composition.'
      : input.aspect === '4:5'
        ? 'Vertical 4:5 portrait composition.'
        : 'Square 1:1 composition.';
  const prompt = [
    input.prompt,
    aspectHint,
    input.negativePrompt ? `Avoid: ${input.negativePrompt}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000);

  try {
    const response = await fetch(apiUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      const detail = contentType.includes('json')
        ? JSON.stringify(await response.json().catch(() => ({})))
        : (await response.text().catch(() => response.statusText)).slice(0, 240);
      console.warn('[arham-image]', response.status, detail);
      return null;
    }

    if (contentType.includes('json')) {
      const json = (await response.json()) as {
        url?: string;
        image?: string;
        b64_json?: string;
        data?: Array<{ url?: string; b64_json?: string }>;
        error?: string;
      };
      if (json.error) {
        console.warn('[arham-image]', json.error);
        return null;
      }
      const item = json.data?.[0];
      const b64 = json.b64_json || json.image || item?.b64_json;
      if (b64) {
        const raw = b64.includes(',') ? b64.split(',')[1]! : b64;
        return { url: await saveSceneBytes(Buffer.from(raw, 'base64')), model: 'arham-worker' };
      }
      const remote = json.url || item?.url;
      if (remote) {
        const imgRes = await fetch(remote, { signal: AbortSignal.timeout(60_000) });
        if (!imgRes.ok) return null;
        return {
          url: await saveSceneBytes(Buffer.from(await imgRes.arrayBuffer())),
          model: 'arham-worker',
        };
      }
      console.warn('[arham-image] unexpected JSON response');
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 500) {
      console.warn('[arham-image] response too small', bytes.length);
      return null;
    }
    return { url: await saveSceneBytes(bytes), model: 'arham-worker' };
  } catch (error) {
    console.warn('[arham-image]', error instanceof Error ? error.message : String(error));
    return null;
  }
}
