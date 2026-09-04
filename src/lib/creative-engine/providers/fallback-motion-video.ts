import type {
  GeneratedAsset,
  VideoGenerationProvider,
  VideoGenerationRequest,
  ProviderHealth,
} from '../types';
import {
  renderMotionTemplateVideo,
  type MotionVideoImage,
} from '@/lib/motion-video';
import { readFile } from 'fs/promises';
import path from 'path';

export class FallbackMotionVideoProvider implements VideoGenerationProvider {
  readonly id = 'fallback-motion';

  async healthCheck(): Promise<ProviderHealth> {
    return { available: true, freeQuotaRemaining: Number.MAX_SAFE_INTEGER };
  }

  async generate(request: VideoGenerationRequest): Promise<GeneratedAsset | null> {
    const images: MotionVideoImage[] = request.images.map((image) =>
      image.url.startsWith('/uploads/')
        ? { kind: 'local', path: image.url }
        : { kind: 'remote', url: image.url }
    );
    const result = await renderMotionTemplateVideo({
      images,
      aspect: request.aspect === '9:16' ? '9:16' : request.aspect === '4:5' ? '4:5' : '1:1',
      durationSeconds: request.durationSeconds,
      publicOrigin: request.publicOrigin,
      filenamePrefix: request.filenamePrefix,
    });
    if (!result.ok) return null;
    const videoBuffer = await readFile(
      path.join(process.cwd(), 'public', result.videoPath.replace(/^\//, ''))
    );
    return {
      url: result.videoUrl,
      provider: this.id,
      model: 'ffmpeg-motion-template',
      estimatedCost: 0,
      quotaUsed: Math.ceil(request.durationSeconds),
      isFinalCreative: true,
      ...( { posterUrl: result.posterUrl, videoBuffer: videoBuffer.length } as Record<string, unknown> ),
    };
  }
}
