import type { ProductBrief } from '@/lib/creative-quality';
import type { CreativeQaScores, ProductTruthSheet } from './types';
import { evaluateCreativeQuality } from '@/lib/creative-quality';

export async function evaluateProductIntegrity(input: {
  packshotUrl: string;
  renderedUrl?: string | null;
}): Promise<{ score: number; flags: string[] }> {
  const flags: string[] = [];
  if (!input.packshotUrl) {
    return { score: 0, flags: ['Missing approved packshot'] };
  }
  if (!input.renderedUrl) {
    return { score: 60, flags: ['Rendered creative unavailable for integrity check'] };
  }
  try {
    const sharp = (await import('sharp')).default;
    const [packshot, rendered] = await Promise.all([
      loadImageBuffer(input.packshotUrl),
      loadImageBuffer(input.renderedUrl),
    ]);
    if (!packshot || !rendered) {
      return { score: 55, flags: ['Could not load images for integrity comparison'] };
    }
    const packStats = await sharp(packshot).resize(128, 128).stats();
    const renderMeta = await sharp(rendered).metadata();
    const w = renderMeta.width || 1080;
    const h = renderMeta.height || 1080;
    const cropW = Math.max(64, Math.round(w * 0.48));
    const cropH = Math.max(64, Math.round(h * 0.42));
    const left = Math.max(0, Math.round((w - cropW) / 2));
    const top = Math.max(0, Math.round(h * 0.14));
    const renderStats = await sharp(rendered)
      .extract({
        left: Math.min(left, Math.max(0, w - cropW)),
        top: Math.min(top, Math.max(0, h - cropH)),
        width: Math.min(cropW, w),
        height: Math.min(cropH, h),
      })
      .resize(128, 128)
      .stats();
    const colorDelta =
      Math.abs(packStats.channels[0].mean - renderStats.channels[0].mean) +
      Math.abs(packStats.channels[1].mean - renderStats.channels[1].mean) +
      Math.abs(packStats.channels[2].mean - renderStats.channels[2].mean);
    if (colorDelta > 220) flags.push('Rendered palette diverges from approved packshot');
    const packMeta = await sharp(packshot).metadata();
    if (packMeta.width && renderMeta.width) {
      const ratio = (packMeta.height || 1) / packMeta.width;
      const renderRatio = (renderMeta.height || 1) / renderMeta.width;
      if (Math.abs(ratio - renderRatio) > 0.8) {
        flags.push('Product proportions may be distorted in render');
      }
    }
    return {
      score: Math.max(40, 100 - flags.length * 20 - Math.min(30, Math.round(colorDelta / 10))),
      flags,
    };
  } catch (error) {
    return {
      score: 50,
      flags: [
        `Integrity check skipped: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

async function loadImageBuffer(url: string): Promise<Buffer | null> {
  if (url.startsWith('/uploads/') || url.startsWith('/api/')) {
    const { readFile } = await import('fs/promises');
    const path = await import('path');
    const local = url.startsWith('/api/')
      ? null
      : path.join(process.cwd(), 'public', url.replace(/^\//, ''));
    if (!local) return null;
    return readFile(local);
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

export async function evaluateCreativeQa(input: {
  headline: string;
  primaryText: string;
  imageUrl?: string | null;
  product: ProductBrief;
  truth: ProductTruthSheet;
  competitorNames?: string[];
  conceptName?: string;
  provider?: string;
}): Promise<{ scores: CreativeQaScores; valid: boolean; flags: string[] }> {
  const copy = evaluateCreativeQuality({
    headline: input.headline,
    primaryText: input.primaryText,
    imageUrl: input.imageUrl,
    product: input.product,
    competitorNames: input.competitorNames,
  });
  const integrity = await evaluateProductIntegrity({
    packshotUrl: input.truth.primaryPackshot,
    renderedUrl: input.imageUrl,
  });

  const hookStrength = input.headline.length >= 12 && input.headline.length <= 40 ? 88 : 65;
  const ctaClarity = /shop|buy|order|get/i.test(`${input.headline} ${input.primaryText}`) ? 90 : 70;
  const mobileReadability = input.headline.length <= 34 ? 92 : 75;
  const creativeUniqueness = input.conceptName ? 85 : 70;
  const policyRisk = copy.flags.some((flag) => /Prohibited|Competitor/.test(flag)) ? 35 : 90;
  const brandConsistency = copy.flags.some((flag) => /Brand name/.test(flag)) ? 60 : 92;
  const visualQuality = input.imageUrl ? 85 : 40;

  const scores: CreativeQaScores = {
    productIntegrity: integrity.score,
    visualQuality,
    brandConsistency,
    hookStrength,
    ctaClarity,
    mobileReadability,
    creativeUniqueness,
    policyRisk,
    overall: Math.round(
      (integrity.score +
        visualQuality +
        brandConsistency +
        hookStrength +
        ctaClarity +
        mobileReadability +
        creativeUniqueness +
        policyRisk) /
        8
    ),
  };

  const flags = [...copy.flags, ...integrity.flags];
  const valid = scores.overall >= 75 && integrity.score >= 70 && copy.valid && policyRisk >= 60;
  return { scores, valid, flags };
}

export function shouldAutoRegenerate(scores: CreativeQaScores): boolean {
  return scores.overall < 75 || scores.productIntegrity < 70 || scores.policyRisk < 60;
}
