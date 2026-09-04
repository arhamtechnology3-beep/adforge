import { createWriteStream } from 'node:fs';
import { lstat, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import type { MotionVideoImage } from './types';

const MAX_REMOTE_IMAGE_BYTES = 20 * 1024 * 1024;

function localImagePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Local image path cannot be empty');
  if (path.isAbsolute(trimmed) && !trimmed.startsWith('/uploads/')) return path.normalize(trimmed);

  const relative = trimmed.replace(/^\/+/, '');
  const publicRoot = path.resolve(process.cwd(), 'public');
  const resolved = path.resolve(publicRoot, relative);
  if (resolved !== publicRoot && !resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error('Local image path must stay inside public/');
  }
  return resolved;
}

async function downloadRemoteImage(urlValue: string, destination: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    throw new Error('Remote image URL is invalid');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Remote image URL must use http or https');
  }

  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Accept: 'image/*',
      'User-Agent': 'MetaAdsMotionVideo/1.0',
    },
    cache: 'no-store',
  });
  if (!response.ok || !response.body) {
    throw new Error(`Remote image request failed with HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType && !contentType.startsWith('image/')) {
    throw new Error(`Remote input is not an image (${contentType})`);
  }
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new Error('Remote image exceeds the 20MB limit');
  }

  let downloaded = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      downloaded += chunk.length;
      if (downloaded > MAX_REMOTE_IMAGE_BYTES) {
        callback(new Error('Remote image exceeds the 20MB limit'));
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      limit,
      createWriteStream(destination, { flags: 'wx' })
    );
  } catch (error) {
    await rm(destination, { force: true });
    throw error;
  }
}

/** Materialize local/remote normalized inputs into ffmpeg-readable paths. */
export async function prepareImageInputs(
  images: MotionVideoImage[],
  workingDirectory: string
): Promise<string[]> {
  await mkdir(workingDirectory, { recursive: true });
  const prepared: string[] = [];

  for (const [index, image] of images.entries()) {
    if (image.kind === 'local') {
      const imagePath = localImagePath(image.path);
      const stats = await lstat(imagePath);
      if (!stats.isFile()) throw new Error(`Local image ${index + 1} is not a file`);
      prepared.push(imagePath);
      continue;
    }

    const destination = path.join(workingDirectory, `remote-${index}.image`);
    await downloadRemoteImage(image.url, destination);
    prepared.push(destination);
  }
  return prepared;
}
