import sharp from 'sharp';

type RegionMetrics = {
  spread: number;
  saturation: number;
  meanLuminance: number;
};

/**
 * Detect AI-generated scenes that drew a product/jar in the center zone
 * where we composite the real packshot — the main cause of "ghost product" backgrounds.
 */
export async function evaluateScenePurity(
  sceneSource: string | Buffer
): Promise<{ pure: boolean; score: number; reason?: string }> {
  try {
    const metrics = await analyzeScenePurityMetrics(sceneSource);
    if (!metrics) return { pure: false, score: 0, reason: 'Could not load scene' };

    const flags: string[] = [];
    if (
      metrics.centerStats.spread > metrics.peripherySpread * 1.28 + 8 &&
      metrics.centerStats.spread > 14
    ) {
      flags.push('Center zone has object-like contrast vs periphery');
    }
    if (metrics.edgeDensity > metrics.peripheryEdgeDensity * 1.8 + 0.04) {
      flags.push('High edge density in product placement zone');
    }
    if (metrics.luminanceDelta > 22) {
      flags.push('Center luminance differs strongly from periphery');
    }

    const score = Math.max(0, 100 - flags.length * 30);
    return {
      pure: flags.length === 0,
      score,
      reason: flags.length ? flags.join('; ') : undefined,
    };
  } catch (error) {
    return {
      pure: true,
      score: 70,
      reason: `Purity check skipped: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function analyzeScenePurityMetrics(sceneSource: string | Buffer) {
  const input =
    typeof sceneSource === 'string' ? await loadSceneBuffer(sceneSource) : sceneSource;
  if (!input) return null;

  const meta = await sharp(input).metadata();
  const w = meta.width || 1080;
  const h = meta.height || 1080;

  const centerW = Math.max(64, Math.round(w * 0.44));
  const centerH = Math.max(64, Math.round(h * 0.44));
  const centerLeft = Math.round((w - centerW) / 2);
  const centerTop = Math.round((h - centerH) / 2);

  const strip = Math.max(40, Math.round(Math.min(w, h) * 0.14));

  const [centerStats, topStrip, bottomStrip, leftStrip, rightStrip, edgeDensity, peripheryEdge] =
    await Promise.all([
      regionStats(input, centerLeft, centerTop, centerW, centerH),
      regionStats(input, 0, 0, w, strip),
      regionStats(input, 0, h - strip, w, strip),
      regionStats(input, 0, 0, strip, h),
      regionStats(input, w - strip, 0, strip, h),
      centerEdgeDensity(input, centerLeft, centerTop, centerW, centerH),
      peripheryEdgeDensity(input, w, h, strip),
    ]);

  const peripherySpread =
    (topStrip.spread + bottomStrip.spread + leftStrip.spread + rightStrip.spread) / 4;
  const peripheryMeanLuminance =
    (topStrip.meanLuminance +
      bottomStrip.meanLuminance +
      leftStrip.meanLuminance +
      rightStrip.meanLuminance) /
    4;

  return {
    centerStats,
    peripherySpread,
    peripheryMeanLuminance,
    edgeDensity,
    peripheryEdgeDensity: peripheryEdge,
    luminanceDelta: Math.abs(centerStats.meanLuminance - peripheryMeanLuminance),
  };
}

async function regionStats(
  input: Buffer,
  left: number,
  top: number,
  width: number,
  height: number
): Promise<RegionMetrics> {
  const extracted = await sharp(input)
    .extract({ left, top, width, height })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const stats = await sharp(extracted.data, { raw: extracted.info })
    .resize(96, 96)
    .stats();
  const spread = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0);
  const r = stats.channels[0]?.mean || 0;
  const g = stats.channels[1]?.mean || 0;
  const b = stats.channels[2]?.mean || 0;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max > 0 ? ((max - min) / max) * 100 : 0;
  const meanLuminance = r * 0.299 + g * 0.587 + b * 0.114;
  return { spread, saturation, meanLuminance };
}

async function centerEdgeDensity(
  input: Buffer,
  left: number,
  top: number,
  width: number,
  height: number
): Promise<number> {
  return edgeDensityForRegion(input, left, top, width, height);
}

async function peripheryEdgeDensity(
  input: Buffer,
  width: number,
  height: number,
  strip: number
): Promise<number> {
  const samples = await Promise.all([
    edgeDensityForRegion(input, 0, 0, width, strip),
    edgeDensityForRegion(input, 0, height - strip, width, strip),
    edgeDensityForRegion(input, 0, 0, strip, height),
    edgeDensityForRegion(input, width - strip, 0, strip, height),
  ]);
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

async function edgeDensityForRegion(
  input: Buffer,
  left: number,
  top: number,
  width: number,
  height: number
): Promise<number> {
  const extracted = await sharp(input)
    .extract({ left, top, width, height })
    .resize(128, 128)
    .greyscale()
    .raw()
    .toBuffer();
  const w = 128;
  const h = 128;
  let edges = 0;
  let samples = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const gx = Math.abs(extracted[i + 1] - extracted[i - 1]);
      const gy = Math.abs(extracted[i + w] - extracted[i - w]);
      if (gx + gy > 28) edges += 1;
      samples += 1;
    }
  }
  return samples ? edges / samples : 0;
}

async function loadSceneBuffer(source: string): Promise<Buffer | null> {
  if (source.startsWith('/uploads/') || source.startsWith('/api/')) {
    const { readFile } = await import('fs/promises');
    const path = await import('path');
    if (source.startsWith('/api/')) return null;
    try {
      return await readFile(path.join(process.cwd(), 'public', source.replace(/^\//, '')));
    } catch {
      return null;
    }
  }
  const response = await fetch(source, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}
