import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { removeBackgroundWithRemoveBg, removeBgConfigured } from '@/lib/remove-bg';

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

type RawRgbaInfo = { width: number; height: number; channels: 4 };

function rgbaRawInfo(info: { width: number; height: number; channels: number }): RawRgbaInfo {
  return { width: info.width, height: info.height, channels: 4 };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function colorDistance(
  pixels: Buffer,
  offset: number,
  bg: [number, number, number]
): number {
  return Math.sqrt(
    (pixels[offset] - bg[0]) ** 2 +
      (pixels[offset + 1] - bg[1]) ** 2 +
      (pixels[offset + 2] - bg[2]) ** 2
  );
}

function estimateBackgroundColor(
  pixels: Buffer,
  width: number,
  height: number,
  channels: number
): [number, number, number] {
  const samples: Array<[number, number, number]> = [];
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 80));
  const sample = (x: number, y: number) => {
    const offset = (y * width + x) * channels;
    samples.push([pixels[offset], pixels[offset + 1], pixels[offset + 2]]);
  };
  for (let x = 0; x < width; x += stride) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y += stride) {
    sample(0, y);
    sample(width - 1, y);
  }
  return [median(samples.map((c) => c[0])), median(samples.map((c) => c[1])), median(samples.map((c) => c[2]))];
}

function floodBackgroundMask(
  pixels: Buffer,
  width: number,
  height: number,
  channels: number,
  bg: [number, number, number],
  tolerance: number
): Uint8Array {
  const total = width * height;
  const mask = new Uint8Array(total);
  const queue = new Int32Array(total);
  let start = 0;
  let end = 0;
  const enqueue = (position: number) => {
    if (mask[position]) return;
    const offset = position * channels;
    if (colorDistance(pixels, offset, bg) > tolerance) return;
    mask[position] = 1;
    queue[end++] = position;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (start < end) {
    const position = queue[start++];
    const x = position % width;
    const y = Math.floor(position / width);
    if (x > 0) enqueue(position - 1);
    if (x + 1 < width) enqueue(position + 1);
    if (y > 0) enqueue(position - width);
    if (y + 1 < height) enqueue(position + width);
  }
  return mask;
}

function largestForegroundComponent(
  foreground: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const total = width * height;
  const labels = new Int32Array(total).fill(-1);
  const sizes: number[] = [];
  let label = 0;

  for (let position = 0; position < total; position += 1) {
    if (!foreground[position] || labels[position] !== -1) continue;
    const queue = [position];
    let qi = 0;
    let size = 0;
    labels[position] = label;
    while (qi < queue.length) {
      const current = queue[qi++];
      size += 1;
      const x = current % width;
      const y = Math.floor(current / width);
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x + 1 < width ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y + 1 < height ? current + width : -1,
      ];
      for (const next of neighbors) {
        if (next < 0 || !foreground[next] || labels[next] !== -1) continue;
        labels[next] = label;
        queue.push(next);
      }
    }
    sizes.push(size);
    label += 1;
  }

  if (!sizes.length) return foreground;
  const bestLabel = sizes.indexOf(Math.max(...sizes));
  const keep = new Uint8Array(total);
  for (let position = 0; position < total; position += 1) {
    if (labels[position] === bestLabel) keep[position] = 1;
  }
  return keep;
}

function morphCloseMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const dilated = new Uint8Array(mask.length);
  const closed = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (mask[ny * width + nx]) on = 1;
        }
      }
      dilated[y * width + x] = on;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 1;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (!dilated[ny * width + nx]) on = 0;
        }
      }
      closed[y * width + x] = on;
    }
  }
  return closed;
}

async function featherAlphaWithSharp(
  pixels: Buffer,
  info: RawRgbaInfo,
  sigma: number
): Promise<Buffer> {
  const alpha = Buffer.alloc(info.width * info.height);
  for (let i = 0, p = 0; p < info.width * info.height; p += 1, i += info.channels) {
    alpha[p] = pixels[i + 3];
  }
  const blurred = await sharp(alpha, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .blur(sigma)
    .raw()
    .toBuffer();
  const output = Buffer.from(pixels);
  for (let p = 0; p < info.width * info.height; p += 1) {
    output[p * info.channels + 3] = blurred[p];
  }
  return output;
}

export function isAlreadyCutoutSource(source: string): boolean {
  return /-cutout\.png($|\?)/i.test(source) || /\/normalized\//i.test(source);
}

/** Share of pixels with meaningful alpha — fully transparent cutouts score ~0. */
export async function measureOpaqueRatio(input: Buffer): Promise<number> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const total = info.width * info.height;
  if (!total) return 0;
  let opaque = 0;
  for (let index = 3; index < data.length; index += info.channels) {
    if (data[index] > 24) opaque += 1;
  }
  return opaque / total;
}

/**
 * remove.bg / local flood-fill sometimes zero alpha while leaving RGB intact.
 * Restore full opacity so Meta previews are not blank white.
 */
export async function restoreInvisiblePackshot(input: Buffer): Promise<Buffer | null> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const total = info.width * info.height;
  if (!total) return null;

  let opaque = 0;
  let colorful = 0;
  for (let position = 0; position < total; position += 1) {
    const offset = position * info.channels;
    if (data[offset + 3] > 24) opaque += 1;
    const luma = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
    if (luma > 8 && luma < 252) colorful += 1;
  }
  if (opaque / total >= 0.02) return null;
  if (colorful / total < 0.02) return null;

  for (let index = 3; index < data.length; index += info.channels) {
    data[index] = 255;
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 8 })
    .toBuffer();
}

async function acceptCutoutOrOriginal(
  candidate: Buffer,
  originalPng: Buffer,
  provider: 'remove-bg' | 'local',
  claimedBackgroundRemoved: boolean
): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  backgroundRemoved: boolean;
  provider?: 'remove-bg' | 'local';
}> {
  if ((await measureOpaqueRatio(candidate)) >= 0.02) {
    const meta = await sharp(candidate).metadata();
    return {
      buffer: candidate,
      width: meta.width || 0,
      height: meta.height || 0,
      backgroundRemoved: claimedBackgroundRemoved,
      provider,
    };
  }

  const restoredCandidate = await restoreInvisiblePackshot(candidate);
  if (restoredCandidate && (await measureOpaqueRatio(restoredCandidate)) >= 0.02) {
    console.warn('[packshot-normalize] invisible cutout recovered by restoring alpha');
    const meta = await sharp(restoredCandidate).metadata();
    return {
      buffer: restoredCandidate,
      width: meta.width || 0,
      height: meta.height || 0,
      backgroundRemoved: false,
      provider,
    };
  }

  const restoredOriginal = (await restoreInvisiblePackshot(originalPng)) || originalPng;
  console.warn('[packshot-normalize] cutout rejected (invisible); using original packshot');
  const meta = await sharp(restoredOriginal).metadata();
  return {
    buffer: restoredOriginal,
    width: meta.width || 0,
    height: meta.height || 0,
    backgroundRemoved: false,
  };
}

function defringePixels(
  pixels: Buffer,
  width: number,
  height: number,
  channels: number,
  bg: [number, number, number]
): void {
  const total = width * height;
  for (let position = 0; position < total; position += 1) {
    const offset = position * channels;
    const alpha = pixels[offset + 3] / 255;
    if (alpha < 0.04) {
      pixels[offset + 3] = 0;
      continue;
    }
    const invAlpha = 1 / Math.max(alpha, 0.05);
    for (let channel = 0; channel < 3; channel += 1) {
      const defringed =
        (pixels[offset + channel] - bg[channel] * (1 - alpha)) * invAlpha;
      pixels[offset + channel] = Math.max(0, Math.min(255, Math.round(defringed)));
    }
  }
}

export async function normalizePackshotBuffer(input: Buffer): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  backgroundRemoved: boolean;
  provider?: 'remove-bg' | 'local';
}> {
  // Recover packshots that were previously saved with alpha wiped to 0.
  const recovered = await restoreInvisiblePackshot(input);
  const sourceInput = recovered || input;
  if (recovered) {
    console.warn('[packshot-normalize] input was invisible; restored RGB under zero alpha');
  }

  let prepared = await sharp(sourceInput)
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let { width, height, channels } = prepared.info;

  // Upscale tiny PDP thumbnails so import doesn't fail the 300×300 gate.
  if (width < 300 || height < 300) {
    prepared = await sharp(sourceInput)
      .rotate()
      .resize(Math.max(300, width), Math.max(300, height), {
        fit: 'inside',
        withoutEnlargement: false,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    ({ width, height, channels } = prepared.info);
  }
  if (width < 300 || height < 300) {
    throw new Error('Packshot must be at least 300×300 pixels');
  }

  const originalPng = await sharp(prepared.data, { raw: rgbaRawInfo(prepared.info) })
    .png({ compressionLevel: 8 })
    .toBuffer();

  const pixels = Buffer.from(prepared.data);
  const total = width * height;
  let transparentPixels = 0;
  for (let index = 3; index < pixels.length; index += channels) {
    if (pixels[index] < 20) transparentPixels += 1;
  }
  // Already a real cutout with enough visible product — keep it.
  if (transparentPixels / total > 0.75 && (await measureOpaqueRatio(originalPng)) >= 0.02) {
    const trimmed = await sharp(originalPng).trim({ threshold: 10 }).png({ compressionLevel: 8 }).toBuffer();
    const meta = await sharp(trimmed).metadata();
    return {
      buffer: trimmed,
      width: meta.width || width,
      height: meta.height || height,
      backgroundRemoved: true,
      provider: 'local',
    };
  }

  if (removeBgConfigured()) {
    const pngInput = await sharp(pixels, { raw: rgbaRawInfo(prepared.info) }).png({ compressionLevel: 6 }).toBuffer();
    const removed = await removeBackgroundWithRemoveBg(pngInput);
    if (removed) {
      const trimmed = await sharp(removed)
        .trim({ threshold: 8 })
        .png({ compressionLevel: 8 })
        .toBuffer();
      return acceptCutoutOrOriginal(trimmed, originalPng, 'remove-bg', true);
    }
  }

  const local = await normalizePackshotBufferLocal(prepared, pixels, width, height, channels, total);
  return acceptCutoutOrOriginal(local.buffer, originalPng, 'local', local.backgroundRemoved);
}

async function normalizePackshotBufferLocal(
  prepared: { info: { width: number; height: number; channels: number } },
  pixels: Buffer,
  width: number,
  height: number,
  channels: number,
  total: number
): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  backgroundRemoved: boolean;
  provider: 'local';
}> {
  const bg = estimateBackgroundColor(pixels, width, height, channels);
  let backgroundMask = floodBackgroundMask(pixels, width, height, channels, bg, 72);
  let removedRatio = backgroundMask.reduce((sum, value) => sum + value, 0) / total;

  if (removedRatio < 0.12 || removedRatio > 0.94) {
    backgroundMask = floodBackgroundMask(pixels, width, height, channels, bg, 110);
    removedRatio = backgroundMask.reduce((sum, value) => sum + value, 0) / total;
  }

  const foreground = new Uint8Array(total);
  for (let position = 0; position < total; position += 1) {
    foreground[position] = backgroundMask[position] ? 0 : 1;
  }

  const rawMask =
    removedRatio >= 0.12 && removedRatio <= 0.94
      ? largestForegroundComponent(foreground, width, height)
      : foreground;
  const productMask = morphCloseMask(rawMask, width, height, 2);

  for (let position = 0; position < total; position += 1) {
    const offset = position * channels;
    if (!productMask[position]) {
      pixels[offset + 3] = 0;
      continue;
    }
    const d = colorDistance(pixels, offset, bg);
    if (d < 32) {
      pixels[offset + 3] = 0;
    } else if (d < 110) {
      pixels[offset + 3] = Math.min(255, Math.round(((d - 32) / 78) * 255));
    } else {
      pixels[offset + 3] = 255;
    }
  }

  const featheredPixels = await featherAlphaWithSharp(pixels, rgbaRawInfo(prepared.info), 2.8);
  pixels.set(featheredPixels);
  defringePixels(pixels, width, height, channels, bg);

  const foregroundKept = Array.from({ length: total }, (_, position) => pixels[position * channels + 3]).filter(
    (value) => value > 30
  ).length;
  const backgroundRemoved = foregroundKept / total >= 0.04 && foregroundKept / total <= 0.88;

  const png = await sharp(pixels, { raw: rgbaRawInfo(prepared.info) })
    .png({ compressionLevel: 8 })
    .toBuffer();
  const trimmed = await sharp(png).trim({ threshold: 8 }).png({ compressionLevel: 8 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  return {
    buffer: trimmed,
    width: meta.width || width,
    height: meta.height || height,
    backgroundRemoved,
    provider: 'local',
  };
}

async function sourceBuffer(source: string): Promise<Buffer> {
  if (source.startsWith('/uploads/')) {
    return readFile(path.join(process.cwd(), 'public', source.replace(/^\//, '')));
  }

  try {
    const parsed = new URL(source);
    if (
      ['localhost', '127.0.0.1'].includes(parsed.hostname) &&
      parsed.pathname.startsWith('/uploads/')
    ) {
      return readFile(path.join(process.cwd(), 'public', parsed.pathname.replace(/^\//, '')));
    }
  } catch {
    /* fetch below */
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(source, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AdForgeAssetBot/1.0', Accept: 'image/*' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Image fetch failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_SOURCE_BYTES) {
      throw new Error('Image is empty or exceeds 15 MB');
    }
    return bytes;
  } finally {
    clearTimeout(timer);
  }
}

export async function normalizePackshot(
  source: string,
  ownerId: string,
  persistToStorage = false,
  options?: { force?: boolean }
): Promise<{ url: string; width: number; height: number; backgroundRemoved: boolean }> {
  if (!options?.force && isAlreadyCutoutSource(source)) {
    const input = await sourceBuffer(source);
    if ((await measureOpaqueRatio(input)) >= 0.02) {
      const meta = await sharp(input).metadata();
      return {
        url: source,
        width: meta.width || 0,
        height: meta.height || 0,
        backgroundRemoved: true,
      };
    }
    // Broken historical cutout (fully transparent) — repair and re-upload.
    console.warn('[packshot-normalize] rejecting invisible cached cutout', source.slice(0, 120));
  }
  const input = await sourceBuffer(source);
  const normalized = await normalizePackshotBuffer(input);
  const output = normalized.buffer;
  if ((await measureOpaqueRatio(output)) < 0.02) {
    throw new Error('Packshot normalize produced an invisible image');
  }
  const dir = path.join(process.cwd(), 'public', 'uploads', ownerId, 'products');
  await mkdir(dir, { recursive: true });
  const digest = createHash('sha1').update(output).digest('hex').slice(0, 12);
  const filename = `${digest}-cutout.png`;
  if (persistToStorage) {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const admin = await createServiceClient();
    const objectPath = `${ownerId}/normalized/${filename}`;
    const { error } = await admin.storage
      .from('product-assets')
      .upload(objectPath, output, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: true,
      });
    if (error) throw new Error(`Packshot storage failed: ${error.message}`);
    return {
      url: admin.storage.from('product-assets').getPublicUrl(objectPath).data.publicUrl,
      width: normalized.width,
      height: normalized.height,
      backgroundRemoved: normalized.backgroundRemoved,
    };
  }
  await writeFile(path.join(dir, filename), output);
  return {
    url: `/uploads/${ownerId}/products/${filename}`,
    width: normalized.width,
    height: normalized.height,
    backgroundRemoved: normalized.backgroundRemoved,
  };
}

/** Target canvas size for Meta placements when padding packshots / fallbacks. */
export function aspectCanvasSize(
  aspect: '1:1' | '4:5' | '9:16'
): { width: number; height: number } {
  if (aspect === '9:16') return { width: 1080, height: 1920 };
  if (aspect === '4:5') return { width: 1080, height: 1350 };
  return { width: 1080, height: 1080 };
}

/**
 * Fill a Meta aspect canvas edge-to-edge (no black letterbox).
 * For 9:16 / 4:5: blurred cover background + sharp packshot in the center safe zone
 * (Meta Stories/Reels: critical product in center ~1:1 on 1080×1920).
 */
export async function padImageToAspect(
  input: Buffer,
  aspect: '1:1' | '4:5' | '9:16',
  background = '#111827'
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { width, height } = aspectCanvasSize(aspect);

  if (aspect === '1:1') {
    const buffer = await sharp(input)
      .rotate()
      .resize(width, height, {
        fit: 'cover',
        position: 'centre',
        background,
      })
      .png({ compressionLevel: 8 })
      .toBuffer();
    return { buffer, width, height };
  }

  const rotated = await sharp(input).rotate().toBuffer();

  // Full-bleed cover background so the phone frame never shows empty bars
  const bg = await sharp(rotated)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .modulate({ brightness: 0.55, saturation: 1.05 })
    .blur(42)
    .png()
    .toBuffer();

  // Meta center-square method: keep product sharp inside ~1080×1080 mid band
  const safeMax = aspect === '9:16' ? 1000 : Math.min(width, height) - 80;
  const fg = await sharp(rotated)
    .resize(safeMax, safeMax, {
      fit: 'inside',
      withoutEnlargement: false,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toBuffer();
  const fgMeta = await sharp(fg).metadata();
  const fgW = fgMeta.width || safeMax;
  const fgH = fgMeta.height || safeMax;
  const left = Math.max(0, Math.round((width - fgW) / 2));
  // Bias slightly upward into Stories safe zone (below top UI, above Reels chrome)
  const topBias = aspect === '9:16' ? Math.round(height * 0.08) : 0;
  const top = Math.max(0, Math.round((height - fgH) / 2) - topBias);

  const buffer = await sharp(bg)
    .composite([{ input: fg, left, top }])
    .png({ compressionLevel: 8 })
    .toBuffer();

  return { buffer, width, height };
}

export async function bakeCreativeAsset(input: {
  creativeUrl: string;
  origin: string;
  ownerId: string;
  expectedAspect: '1:1' | '4:5' | '9:16';
  persistToStorage?: boolean;
}): Promise<{ url: string; width: number; height: number }> {
  const source = input.creativeUrl.startsWith('http')
    ? input.creativeUrl
    : `${input.origin.replace(/\/$/, '')}${input.creativeUrl}`;
  const response = await fetch(source, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Creative render failed: HTTP ${response.status}`);
  let bytes = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error('Rendered creative has no dimensions');
  let outWidth = metadata.width;
  let outHeight = metadata.height;
  const ratio = outWidth / outHeight;
  const expected =
    input.expectedAspect === '9:16' ? 9 / 16 : input.expectedAspect === '4:5' ? 4 / 5 : 1;
  // Square / mismatched renders: pad to the placement canvas instead of failing or cropping.
  if (Math.abs(ratio - expected) > 0.03) {
    const padded = await padImageToAspect(bytes, input.expectedAspect);
    bytes = Buffer.from(padded.buffer);
    outWidth = padded.width;
    outHeight = padded.height;
  }
  const stats = await sharp(bytes).stats();
  const channelSpread = stats.channels.reduce((sum, channel) => sum + channel.stdev, 0);
  if (channelSpread < 6) throw new Error('Rendered creative appears blank');
  const meanLuma =
    stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.mean, 0) / 3;
  // Near-white composites (missing packshot) look "successful" but show empty in the ads UI.
  if (meanLuma > 245 && channelSpread < 40) {
    throw new Error('Rendered creative appears empty/white');
  }

  const output = await sharp(bytes).png({ compressionLevel: 8 }).toBuffer();
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.png`;
  if (input.persistToStorage) {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const admin = await createServiceClient();
    const objectPath = `${input.ownerId}/${filename}`;
    const { error } = await admin.storage
      .from('creative-assets')
      .upload(objectPath, output, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: false,
      });
    if (error) throw new Error(`Creative storage failed: ${error.message}`);
    const { data } = admin.storage.from('creative-assets').getPublicUrl(objectPath);
    return {
      url: data.publicUrl,
      width: outWidth,
      height: outHeight,
    };
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', input.ownerId, 'creatives');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), output);
  return {
    url: `/uploads/${input.ownerId}/creatives/${filename}`,
    width: outWidth,
    height: outHeight,
  };
}

/**
 * Bake a Meta creative; if render/AI scene fails, rebuild with packshot only,
 * then fall back to the raw approved product image so the UI never shows a dead preview.
 */
export async function bakeCreativeOrPackshot(input: {
  creativeUrl: string;
  packshotOnlyUrl: string;
  packshotUrl: string;
  origin: string;
  ownerId: string;
  expectedAspect: '1:1' | '4:5' | '9:16';
  persistToStorage?: boolean;
}): Promise<{ url: string; usedPackshotFallback: boolean }> {
  try {
    const baked = await bakeCreativeAsset({
      creativeUrl: input.creativeUrl,
      origin: input.origin,
      ownerId: input.ownerId,
      expectedAspect: input.expectedAspect,
      persistToStorage: input.persistToStorage,
    });
    return { url: baked.url, usedPackshotFallback: false };
  } catch (firstError) {
    console.warn(
      '[bake-creative] primary bake failed, retrying packshot-only:',
      firstError instanceof Error ? firstError.message : firstError
    );
  }

  try {
    const baked = await bakeCreativeAsset({
      creativeUrl: input.packshotOnlyUrl,
      origin: input.origin,
      ownerId: input.ownerId,
      expectedAspect: input.expectedAspect,
      persistToStorage: input.persistToStorage,
    });
    return { url: baked.url, usedPackshotFallback: true };
  } catch (secondError) {
    console.warn(
      '[bake-creative] packshot-only bake failed, using raw packshot:',
      secondError instanceof Error ? secondError.message : secondError
    );
  }

  // Last resort: pad the raw packshot to the expected aspect so Stories/video
  // previews never show a cropped square inside a 9:16 frame.
  try {
    const packshotSource = input.packshotUrl.startsWith('http')
      ? input.packshotUrl
      : `${input.origin.replace(/\/$/, '')}${input.packshotUrl}`;
    const packRes = await fetch(packshotSource, { cache: 'no-store' });
    if (!packRes.ok) throw new Error(`Packshot fetch HTTP ${packRes.status}`);
    const packBytes = Buffer.from(await packRes.arrayBuffer());
    const padded = await padImageToAspect(packBytes, input.expectedAspect);
    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}-pad.png`;
    if (input.persistToStorage) {
      const { createServiceClient } = await import('@/lib/supabase/server');
      const admin = await createServiceClient();
      const objectPath = `${input.ownerId}/${filename}`;
      const { error } = await admin.storage.from('creative-assets').upload(objectPath, padded.buffer, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) throw new Error(error.message);
      const { data } = admin.storage.from('creative-assets').getPublicUrl(objectPath);
      return { url: data.publicUrl, usedPackshotFallback: true };
    }
    const dir = path.join(process.cwd(), 'public', 'uploads', input.ownerId, 'creatives');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), padded.buffer);
    return {
      url: `/uploads/${input.ownerId}/creatives/${filename}`,
      usedPackshotFallback: true,
    };
  } catch (padError) {
    console.warn(
      '[bake-creative] aspect pad failed, using raw packshot:',
      padError instanceof Error ? padError.message : padError
    );
    return { url: input.packshotUrl, usedPackshotFallback: true };
  }
}

export async function persistCreativeFile(input: {
  publicPath: string;
  ownerId: string;
  contentType: string;
}): Promise<string> {
  const { createServiceClient } = await import('@/lib/supabase/server');
  const admin = await createServiceClient();
  const filename = path.basename(input.publicPath);
  const objectPath = `${input.ownerId}/${filename}`;
  const bytes = await readFile(
    path.join(process.cwd(), 'public', input.publicPath.replace(/^\//, ''))
  );
  const { error } = await admin.storage
    .from('creative-assets')
    .upload(objectPath, bytes, {
      contentType: input.contentType,
      cacheControl: '31536000',
      upsert: false,
    });
  if (error) throw new Error(`Creative storage failed: ${error.message}`);
  return admin.storage.from('creative-assets').getPublicUrl(objectPath).data.publicUrl;
}
