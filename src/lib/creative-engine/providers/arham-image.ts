import type {
  GeneratedAsset,
  ImageGenerationProvider,
  ImageGenerationRequest,
  ProviderHealth,
} from '../types';
import { arhamImageConfigured, generateArhamImage } from '@/lib/arham-image-api';

export class ArhamImageProvider implements ImageGenerationProvider {
  readonly id = 'arham';

  async healthCheck(): Promise<ProviderHealth> {
    const available = arhamImageConfigured();
    return {
      available,
      reason: available ? undefined : 'Missing ARHAM_IMAGE_API_TOKEN',
      freeQuotaRemaining: available ? Number.MAX_SAFE_INTEGER : 0,
    };
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedAsset | null> {
    const aspect =
      request.aspect === '9:16' ? '9:16' : request.aspect === '4:5' ? '4:5' : '1:1';
    const result = await generateArhamImage({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      aspect,
    });
    if (!result?.url) return null;
    return {
      url: result.url,
      provider: this.id,
      model: result.model,
      isFinalCreative: false,
      estimatedCost: 0,
      quotaUsed: 1,
    };
  }
}
