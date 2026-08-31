/**
 * Pluggable image providers for agency-grade ad creatives.
 *
 * Provider priority (set keys in .env.local):
 * 1. OPENROUTER_API_KEY — FLUX via OpenRouter Image API (product reference supported)
 * 2. CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID — FLUX Schnell (~200 free images/day)
 * 2. PHOTOROOM_API_KEY — product cutout + AI scene
 * 3. FAL_KEY — FLUX backgrounds
 * 4. OPENAI_API_KEY + USE_OPENAI_IMAGES=true — DALL·E 3
 * 5. Pollinations.ai — free fallback
 */

import type { CreativeBrief } from '@/lib/creative-brief';
import { productSceneUrl } from '@/lib/creatives';
import { generateOpenRouterImage } from '@/lib/openrouter-creative';
import { generateCloudflareImage } from '@/lib/cloudflare-creative';

export type SceneGenerateInput = {
  brief: CreativeBrief;
  category: string;
  angle: string;
  seed: number;
  aspect: '1:1' | '9:16';
  productImageUrl?: string | null;
  brand?: string;
  headline?: string;
};

export type SceneGenerateResult = {
  url: string;
  provider: 'openrouter' | 'cloudflare' | 'photoroom' | 'fal' | 'openai' | 'pollinations';
  /** When true, use URL as final creative (skip Satori text overlay) */
  isFinalCreative?: boolean;
};

/** Generate a scene/background URL using the best available provider */
export async function generateSceneImage(
  input: SceneGenerateInput
): Promise<SceneGenerateResult> {
  const prompt =
    input.aspect === '9:16' ? input.brief.storyPrompt : input.brief.scenePrompt;

  // 1) OpenRouter — FLUX + reference image
  if (process.env.OPENROUTER_API_KEY) {
    const or = await generateOpenRouterImage({
      prompt,
      aspect: input.aspect,
      brand: input.brand,
      headline: input.headline,
      productImageUrl: input.productImageUrl,
      seed: input.seed,
    });
    if (or?.url) {
      return { url: or.url, provider: 'openrouter', isFinalCreative: true };
    }
  }

  // 2) Cloudflare Workers AI — FLUX Schnell (free tier)
  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    const cf = await generateCloudflareImage({
      prompt,
      aspect: input.aspect,
      brand: input.brand,
      headline: input.headline,
    });
    if (cf?.url) {
      return { url: cf.url, provider: 'cloudflare', isFinalCreative: true };
    }
  }

  // 3) Photoroom — product-in-scene (agency D2C standard)
  if (process.env.PHOTOROOM_API_KEY && input.productImageUrl) {
    const url = await generatePhotoroomScene(input.productImageUrl, prompt, input.aspect);
    if (url) return { url, provider: 'photoroom', isFinalCreative: true };
  }

  // 4) Fal.ai FLUX — high-quality scene generation
  if (process.env.FAL_KEY) {
    const url = await generateFalFlux(prompt, input.aspect, input.seed);
    if (url) return { url, provider: 'fal' };
  }

  // 5) OpenAI DALL·E 3
  if (process.env.OPENAI_API_KEY && process.env.USE_OPENAI_IMAGES === 'true') {
    const url = await generateOpenAiScene(prompt);
    if (url) return { url, provider: 'openai' };
  }

  // 6) Free fallback — Pollinations
  const seed = input.seed;
  const sceneUrl = productSceneUrl(input.category, input.angle, seed);
  const params = new URLSearchParams({
    width: input.aspect === '9:16' ? '768' : '1080',
    height: input.aspect === '9:16' ? '1344' : '1080',
    nologo: 'true',
    seed: String(seed),
  });
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
  return { url: pollinationsUrl || sceneUrl, provider: 'pollinations' };
}

async function generatePhotoroomScene(
  productUrl: string,
  scenePrompt: string,
  aspect: '1:1' | '9:16'
): Promise<string | null> {
  try {
    const res = await fetch('https://sdk.photoroom.com/v1/render', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.PHOTOROOM_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl: productUrl,
        background: { prompt: scenePrompt },
        outputSize: aspect === '9:16' ? '1080x1920' : '1080x1080',
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const b64 = buf.toString('base64');
    const ct = res.headers.get('content-type') || 'image/png';
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

async function generateFalFlux(
  prompt: string,
  aspect: '1:1' | '9:16',
  seed: number
): Promise<string | null> {
  try {
    const imageSize =
      aspect === '9:16' ? { width: 768, height: 1344 } : { width: 1024, height: 1024 };
    const res = await fetch('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: imageSize,
        num_inference_steps: 28,
        seed,
      }),
      signal: AbortSignal.timeout(90000),
    });
    const json = await res.json();
    return json?.images?.[0]?.url || null;
  } catch {
    return null;
  }
}

async function generateOpenAiScene(prompt: string): Promise<string | null> {
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 1000),
      n: 1,
      size: '1024x1024',
    });
    return response.data?.[0]?.url || null;
  } catch {
    return null;
  }
}
