import type {
  GeneratedAsset,
  ImageGenerationProvider,
  ImageGenerationRequest,
  ProviderHealth,
} from '../types';
import { productSceneUrl } from '@/lib/creatives';

export class LocalImageProvider implements ImageGenerationProvider {
  readonly id = 'local';

  async healthCheck(): Promise<ProviderHealth> {
    return { available: true, freeQuotaRemaining: Number.MAX_SAFE_INTEGER };
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedAsset | null> {
    const category = request.category || request.brand || 'product';
    const angle =
      request.angle ||
      (request.prompt.includes('UGC') ? 'trending-ugc' : 'premium-hero');
    return {
      url: productSceneUrl(
        category,
        angle,
        request.seed,
        request.aspect,
        request.scenePresetId
      ),
      provider: this.id,
      model: request.scenePresetId || 'local-default',
      isFinalCreative: false,
      estimatedCost: 0,
      quotaUsed: 0,
    };
  }
}
