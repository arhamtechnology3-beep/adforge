import type {
  GeneratedAsset,
  ProviderHealth,
  VideoGenerationProvider,
  VideoGenerationRequest,
} from '../types';
import { freeLlmConfigured, generateFreeLlmVideo } from '@/lib/freellmapi';

export class FreeLLMVideoProvider implements VideoGenerationProvider {
  readonly id = 'freellm-video';

  async healthCheck(): Promise<ProviderHealth> {
    const available = freeLlmConfigured();
    return {
      available,
      reason: available ? undefined : 'Missing FREELLM_API_KEY',
      freeQuotaRemaining: available ? 50 : 0,
    };
  }

  async generate(request: VideoGenerationRequest): Promise<GeneratedAsset | null> {
    const firstFrame = request.images[0]?.url;
    const absoluteFrame =
      firstFrame && !firstFrame.startsWith('http')
        ? `${request.publicOrigin.replace(/\/$/, '')}${firstFrame}`
        : firstFrame;

    const prompt =
      request.scenePlan?.scenes?.[0]?.headline ||
      request.images[0]?.headline ||
      'Premium product ad motion video, smooth camera push-in, social media UGC style';

    const result = await generateFreeLlmVideo({
      prompt,
      aspect: request.aspect === '9:16' ? '9:16' : request.aspect === '4:5' ? '4:5' : '1:1',
      durationSeconds: request.durationSeconds,
      imageUrl: absoluteFrame,
    });
    if (!result?.url) return null;

    return {
      url: result.url,
      provider: this.id,
      model: result.model || process.env.FREELLM_VIDEO_MODEL || 'auto',
      isFinalCreative: true,
      estimatedCost: 0,
      quotaUsed: Math.ceil(request.durationSeconds),
    };
  }
}
