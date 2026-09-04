import type {
  GeneratedAsset,
  ImageGenerationProvider,
  ImageGenerationRequest,
  ProviderHealth,
} from '../types';
import { generateCloudflareImage } from '@/lib/cloudflare-creative';
import { persistSceneUrl } from '@/lib/persist-scene';

export class CloudflareImageProvider implements ImageGenerationProvider {
  readonly id = 'cloudflare';

  async healthCheck(): Promise<ProviderHealth> {
    const available = Boolean(
      process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID
    );
    return {
      available,
      reason: available ? undefined : 'Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID',
      freeQuotaRemaining: available ? 10_000 : 0,
    };
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedAsset | null> {
    const aspect = request.aspect === '9:16' ? '9:16' : request.aspect === '4:5' ? '4:5' : '1:1';
    const result = await generateCloudflareImage({
      prompt: `${request.prompt} Avoid: ${request.negativePrompt}`.slice(0, 2048),
      aspect,
      brand: request.brand,
      hasProductRef: Boolean(request.productImageUrl),
    });
    if (!result?.url) return null;
    const url = await persistSceneUrl(result.url);
    return {
      url,
      provider: this.id,
      model: process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell',
      isFinalCreative: false,
      estimatedCost: 0,
      quotaUsed: 50,
    };
  }
}
