import type {
  GeneratedAsset,
  ImageGenerationProvider,
  ImageGenerationRequest,
  ProviderHealth,
} from '../types';
import { freeLlmConfigured, generateFreeLlmImage } from '@/lib/freellmapi';

export class FreeLLMImageProvider implements ImageGenerationProvider {
  readonly id = 'freellm';

  async healthCheck(): Promise<ProviderHealth> {
    const available = freeLlmConfigured();
    return {
      available,
      reason: available ? undefined : 'Missing FREELLM_API_KEY',
      freeQuotaRemaining: available ? 500 : 0,
    };
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedAsset | null> {
    const aspect =
      request.aspect === '9:16' ? '9:16' : request.aspect === '4:5' ? '4:5' : '1:1';
    const result = await generateFreeLlmImage({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      aspect,
      brand: request.brand,
      mode: request.mode,
    });
    if (!result?.url) return null;
    return {
      url: result.url,
      provider: this.id,
      model: result.model || process.env.FREELLM_IMAGE_MODEL || 'auto',
      isFinalCreative: false,
      estimatedCost: 0,
      quotaUsed: 50,
    };
  }
}
