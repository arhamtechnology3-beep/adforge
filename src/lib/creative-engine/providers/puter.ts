import type {
  GeneratedAsset,
  ImageGenerationProvider,
  ProviderHealth,
  VideoGenerationProvider,
} from '../types';

/** Optional BYOP provider — requires end-user Puter authorization in the browser. */
export class PuterImageProvider implements ImageGenerationProvider {
  readonly id = 'puter';

  async healthCheck(): Promise<ProviderHealth> {
    return {
      available: process.env.PUTER_BYOP_ENABLED === 'true',
      reason: 'Puter BYOP must be enabled per workspace',
    };
  }

  async generate(): Promise<GeneratedAsset | null> {
    return null;
  }
}

export class PuterVideoProvider implements VideoGenerationProvider {
  readonly id = 'puter-video';

  async healthCheck(): Promise<ProviderHealth> {
    return {
      available: process.env.PUTER_BYOP_ENABLED === 'true',
      reason: 'Puter BYOP video requires user authorization',
    };
  }

  async generate(): Promise<GeneratedAsset | null> {
    return null;
  }
}
