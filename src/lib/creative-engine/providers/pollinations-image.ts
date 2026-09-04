import type {
  GeneratedAsset,
  ImageGenerationProvider,
  ImageGenerationRequest,
  ProviderHealth,
} from '../types';
import { persistSceneUrl } from '@/lib/persist-scene';

type PollinationsModel = {
  name: string;
  type?: string;
  pricing?: { input?: number; output?: number };
};

let cachedModels: PollinationsModel[] | null = null;
let cachedAt = 0;

async function discoverImageModels(): Promise<PollinationsModel[]> {
  if (cachedModels && Date.now() - cachedAt < 15 * 60_000) return cachedModels;
  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) return [];
  try {
    const response = await fetch('https://gen.pollinations.ai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { data?: PollinationsModel[] } | PollinationsModel[];
    const models = Array.isArray(payload) ? payload : payload.data || [];
    cachedModels = models.filter((model) => /image/i.test(String(model.type || model.name)));
    cachedAt = Date.now();
    return cachedModels;
  } catch {
    return [];
  }
}

export class PollinationsImageProvider implements ImageGenerationProvider {
  readonly id = 'pollinations';

  async healthCheck(): Promise<ProviderHealth> {
    return {
      available: true,
      freeQuotaRemaining: 500,
    };
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedAsset | null> {
    const models = await discoverImageModels();
    const model = models[0]?.name;
    const width = request.aspect === '9:16' ? 768 : request.aspect === '4:5' ? 1080 : 1080;
    const height = request.aspect === '9:16' ? 1344 : request.aspect === '4:5' ? 1350 : 1080;
    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      nologo: 'true',
      seed: String(request.seed),
      ...(model ? { model } : {}),
    });
    const prompt = `${request.prompt} Avoid: ${request.negativePrompt}`.slice(0, 1800);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
    const persisted = await persistSceneUrl(url);
    return {
      url: persisted,
      provider: this.id,
      model: model || 'pollinations-default',
      isFinalCreative: false,
      estimatedCost: 0,
      quotaUsed: 1,
    };
  }
}
