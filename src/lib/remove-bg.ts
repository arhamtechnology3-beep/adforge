import sharp from 'sharp';

const REMOVE_BG_ENDPOINT = 'https://api.remove.bg/v1.0/removebg';
const REMOVE_BG_TIMEOUT_MS = 60_000;

export function removeBgApiKey(): string | null {
  const key = process.env.REMOVE_BG_API_KEY?.trim();
  return key || null;
}

export function removeBgConfigured(): boolean {
  return Boolean(removeBgApiKey());
}

export async function removeBackgroundWithRemoveBg(
  input: Buffer,
  apiKey = removeBgApiKey()
): Promise<Buffer | null> {
  if (!apiKey) return null;

  const prepared = await sharpPrepareForApi(input);
  const formData = new FormData();
  formData.append(
    'image_file',
    new Blob([Uint8Array.from(prepared)], { type: 'image/png' }),
    'packshot.png'
  );
  formData.append('size', 'auto');
  formData.append('type', 'product');
  formData.append('format', 'png');
  formData.append('crop', 'true');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOVE_BG_TIMEOUT_MS);
  try {
    const response = await fetch(REMOVE_BG_ENDPOINT, {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      console.warn('[remove-bg] API error', response.status, detail.slice(0, 240));
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) return null;
    return bytes;
  } catch (error) {
    console.warn('[remove-bg]', error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function sharpPrepareForApi(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 6 })
    .toBuffer();
}
