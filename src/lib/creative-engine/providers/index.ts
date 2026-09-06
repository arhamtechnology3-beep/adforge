import type {
  GeneratedAsset,
  ImageGenerationProvider,
  ImageGenerationRequest,
  VideoGenerationProvider,
} from '../types';
import { ArhamImageProvider } from './arham-image';
import { FreeLLMVideoProvider } from './freellm-video';
import { PuterVideoProvider } from './puter';
import { FallbackMotionVideoProvider } from './fallback-motion-video';
import { recordCreativeUsage } from '../usage-ledger';
import { reserveProviderQuota } from '../quota-manager';
import { evaluateScenePurity } from '@/lib/scene-purity';

/** Sole image provider — Arham Cloudflare Worker API only */
const imageProviders: ImageGenerationProvider[] = [new ArhamImageProvider()];

const videoProviders: VideoGenerationProvider[] = [
  new FreeLLMVideoProvider(),
  new FallbackMotionVideoProvider(),
  new PuterVideoProvider(),
];

async function acceptSceneAsset(
  asset: GeneratedAsset,
  mode: ImageGenerationRequest['mode']
): Promise<GeneratedAsset | null> {
  if (!asset?.url) return null;
  if (mode !== 'background' || asset.provider === 'local') return asset;
  const purity = await evaluateScenePurity(asset.url);
  // Accept score >= 40 when only 2 flags — prefer AI over flat SVG; packshot covers center
  if (purity.pure || purity.score >= 40) return asset;
  console.warn(
    `[scene-purity] rejected ${asset.provider} scene (score ${purity.score}): ${purity.reason}`
  );
  return null;
}

export async function generateSceneWithProviders(
  request: ImageGenerationRequest & {
    headline?: string;
    userId?: string;
    workspaceId?: string;
  }
): Promise<GeneratedAsset> {
  const requiredQuota = 1;
  const presetLabel = request.scenePresetId || request.scenePresetName || 'unknown';

  for (const provider of imageProviders) {
    const health = await provider.healthCheck();
    if (!health.available) {
      console.warn(`[scene-gen] skip ${provider.id}: ${health.reason || 'unavailable'}`);
      continue;
    }
    const reserved = await reserveProviderQuota(provider.id, requiredQuota, request.userId);
    if (!reserved) {
      console.warn(`[scene-gen] skip ${provider.id}: quota exhausted`);
      continue;
    }

    const asset = await provider.generate(request);
    if (!asset) continue;

    const accepted = await acceptSceneAsset(asset, request.mode);
    if (accepted?.url) {
      console.info(
        `[scene-gen] preset=${presetLabel} provider=${accepted.provider} model=${accepted.model || 'n/a'}`
      );
      await recordCreativeUsage({
        userId: request.userId,
        workspaceId: request.workspaceId,
        provider: provider.id,
        model: accepted.model,
        assetType: 'image',
        requests: 1,
        imagesGenerated: 1,
        estimatedCost: accepted.estimatedCost,
        freeQuotaConsumed: 0,
      });
      return accepted;
    }
  }

  console.warn(
    `[scene-gen] Arham image API failed for preset=${presetLabel} — packshot-only creative will be used`
  );
  // Do not return a flat SVG scene: Meta creatives must show the approved product packshot.
  return {
    url: '',
    provider: 'packshot-fallback',
    isFinalCreative: false,
  };
}

export async function generateVideoWithProviders(
  request: Parameters<VideoGenerationProvider['generate']>[0] & {
    userId?: string;
    workspaceId?: string;
  }
): Promise<GeneratedAsset | null> {
  for (const provider of videoProviders) {
    const health = await provider.healthCheck();
    if (!health.available) continue;
    const asset = await provider.generate(request);
    if (asset?.url) {
      await recordCreativeUsage({
        userId: request.userId,
        workspaceId: request.workspaceId,
        provider: provider.id,
        model: asset.model,
        assetType: 'video',
        requests: 1,
        videoSeconds: request.durationSeconds,
        estimatedCost: asset.estimatedCost,
      });
      return asset;
    }
  }
  return null;
}
