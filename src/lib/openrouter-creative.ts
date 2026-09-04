import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { buildGuardedScenePrompt } from '@/lib/creative-product-guardrails';

const API_URL = 'https://openrouter.ai/api/v1/images';
const DEFAULT_MODEL = 'black-forest-labs/flux.2-klein-4b';

export type OpenRouterImageInput = {
  prompt: string;
  aspect: '1:1' | '9:16' | '4:5';
  brand?: string;
  headline?: string;
  productImageUrl?: string | null;
  seed?: number;
  /** background = scene only (product composited later); full = entire creative */
  mode?: 'background' | 'full';
};

function apiKey(): string | null {
  return process.env.OPENROUTER_API_KEY || null;
}

function modelId(): string {
  return process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_MODEL;
}

async function saveAsset(bytes: Buffer): Promise<string> {
  const dir = path.join(process.cwd(), 'public', 'uploads', 'openrouter');
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.png`;
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/openrouter/${filename}`;
}

/**
 * Generate ad scene via OpenRouter Image API (FLUX and other models).
 * Supports product reference via input_references when productImageUrl is set.
 */
export async function generateOpenRouterImage(
  input: OpenRouterImageInput
): Promise<{ url: string } | null> {
  const key = apiKey();
  if (!key) return null;

  const aspectHint =
    input.aspect === '9:16'
      ? 'Vertical 9:16 portrait for Instagram Stories/Reels.'
      : 'Square 1:1 for Meta Feed.';

  const mode = input.mode ?? (input.productImageUrl ? 'background' : 'full');
  const guarded = buildGuardedScenePrompt(
    [
      input.prompt,
      aspectHint,
      input.brand ? `Brand: ${input.brand}.` : '',
      input.headline ? `Ad theme: ${input.headline}.` : '',
      'Photorealistic Indian D2C food product advertising photography.',
    ]
      .filter(Boolean)
      .join(' '),
    { mode, brand: input.brand, hasProductRef: Boolean(input.productImageUrl) }
  );

  const body: Record<string, unknown> = {
    model: modelId(),
    prompt: guarded.prompt,
    negative_prompt: guarded.negativePrompt,
    aspect_ratio: input.aspect === '9:16' ? '9:16' : input.aspect === '4:5' ? '4:5' : '1:1',
    output_format: 'png',
    n: 1,
  };

  if (input.seed != null) body.seed = input.seed;

  // Only use reference when generating a full creative (no separate product compositing)
  if (input.productImageUrl && mode === 'full') {
    body.input_references = [
      {
        type: 'image_url',
        image_url: { url: input.productImageUrl },
      },
    ];
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'AdForge',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    const json = (await res.json()) as {
      error?: { message?: string };
      data?: Array<{ b64_json?: string; url?: string }>;
    };

    if (!res.ok) {
      console.warn('[openrouter-image]', json.error?.message || res.status);
      return null;
    }

    const item = json.data?.[0];
    if (item?.b64_json) {
      const saved = await saveAsset(Buffer.from(item.b64_json, 'base64'));
      return { url: saved };
    }
    if (item?.url) {
      const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(60000) });
      if (!imgRes.ok) return null;
      const saved = await saveAsset(Buffer.from(await imgRes.arrayBuffer()));
      return { url: saved };
    }

    return null;
  } catch (err) {
    console.warn('[openrouter-image]', err instanceof Error ? err.message : err);
    return null;
  }
}
