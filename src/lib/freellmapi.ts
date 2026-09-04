import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { buildGuardedScenePrompt } from '@/lib/creative-product-guardrails';

const DEFAULT_BASE_URL = 'http://localhost:3001/v1';
const IMAGE_TIMEOUT_MS = 120_000;
const VIDEO_TIMEOUT_MS = 300_000;

export type FreeLLMImageInput = {
  prompt: string;
  negativePrompt?: string;
  aspect: '1:1' | '4:5' | '9:16';
  brand?: string;
  mode?: 'background' | 'full';
  model?: string;
};

export type FreeLLMVideoInput = {
  prompt: string;
  aspect: '1:1' | '4:5' | '9:16';
  durationSeconds?: number;
  seed?: number;
  imageUrl?: string;
  model?: string;
};

export function freeLlmConfigured(): boolean {
  return Boolean(process.env.FREELLM_API_KEY?.trim());
}

export function freeLlmBaseUrl(): string {
  return (process.env.FREELLM_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

export function freeLlmApiKey(): string | null {
  const key = process.env.FREELLM_API_KEY?.trim();
  return key || null;
}

function imageSizeForAspect(aspect: FreeLLMImageInput['aspect']): string {
  if (aspect === '9:16') return '1024x1792';
  if (aspect === '4:5') return '1024x1280';
  return '1024x1024';
}

function videoAspectRatio(aspect: FreeLLMVideoInput['aspect']): '16:9' | '9:16' {
  return aspect === '9:16' || aspect === '4:5' ? '9:16' : '16:9';
}

async function saveImageAsset(bytes: Buffer): Promise<string> {
  const dir = path.join(process.cwd(), 'public', 'uploads', 'freellm');
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.png`;
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/freellm/${filename}`;
}

export async function saveFreeLlmVideoAsset(bytes: Buffer): Promise<string> {
  const dir = path.join(process.cwd(), 'public', 'uploads', 'freellm-videos');
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.mp4`;
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/freellm-videos/${filename}`;
}

export async function generateFreeLlmImage(
  input: FreeLLMImageInput
): Promise<{ url: string; model?: string; provider?: string } | null> {
  const apiKey = freeLlmApiKey();
  if (!apiKey) return null;

  const mode = input.mode ?? 'background';
  const guarded = buildGuardedScenePrompt(
    [
      input.prompt,
      input.negativePrompt ? `Avoid: ${input.negativePrompt}` : '',
      mode === 'background'
        ? 'Empty studio environment only — no products, jars, bottles, or packaging.'
        : '',
    ]
      .filter(Boolean)
      .join(' '),
    { mode, brand: mode === 'background' ? undefined : input.brand, hasProductRef: mode === 'full' }
  );

  const body = {
    model: input.model || process.env.FREELLM_IMAGE_MODEL || 'auto',
    prompt: guarded.prompt.slice(0, 4000),
    n: 1,
    size: imageSizeForAspect(input.aspect),
    response_format: 'b64_json' as const,
  };

  try {
    const response = await fetch(`${freeLlmBaseUrl()}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      const detail = contentType.includes('json')
        ? JSON.stringify(await response.json().catch(() => ({})))
        : await response.text().catch(() => response.statusText);
      console.warn('[freellm-image]', response.status, detail.slice(0, 240));
      return null;
    }

    const json = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
      model?: string;
      provider?: string;
    };

    const item = json.data?.[0];
    if (item?.b64_json) {
      const saved = await saveImageAsset(Buffer.from(item.b64_json, 'base64'));
      return { url: saved, model: json.model, provider: json.provider };
    }
    if (item?.url) {
      const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
      if (!imgRes.ok) return null;
      const saved = await saveImageAsset(Buffer.from(await imgRes.arrayBuffer()));
      return { url: saved, model: json.model, provider: json.provider };
    }
    return null;
  } catch (error) {
    console.warn('[freellm-image]', error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function generateFreeLlmVideo(
  input: FreeLLMVideoInput
): Promise<{ url: string; model?: string; provider?: string } | null> {
  const apiKey = freeLlmApiKey();
  if (!apiKey) return null;

  const body: Record<string, unknown> = {
    model: input.model || process.env.FREELLM_VIDEO_MODEL || 'auto',
    prompt: input.prompt.slice(0, 4000),
    duration: Math.min(12, Math.max(4, Math.round(input.durationSeconds || 8))),
    aspect_ratio: videoAspectRatio(input.aspect),
    seed: input.seed,
    audio: false,
  };
  if (input.imageUrl?.startsWith('http')) {
    body.image = input.imageUrl;
  }

  try {
    const response = await fetch(`${freeLlmBaseUrl()}/videos/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(VIDEO_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      console.warn('[freellm-video]', response.status, detail.slice(0, 240));
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) return null;

    const saved = await saveFreeLlmVideoAsset(bytes);
    return {
      url: saved,
      model: response.headers.get('X-Model') || undefined,
      provider: response.headers.get('X-Provider') || undefined,
    };
  } catch (error) {
    console.warn('[freellm-video]', error instanceof Error ? error.message : String(error));
    return null;
  }
}
