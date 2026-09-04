import assert from 'node:assert/strict';
import sharp from 'sharp';
import { isAlreadyCutoutSource, normalizePackshotBuffer } from '../../src/lib/creative-assets';

async function syntheticPackshot(): Promise<Buffer> {
  const width = 400;
  const height = 400;
  const pixels = Buffer.alloc(width * height * 3, 245);
  for (let y = 120; y < 280; y += 1) {
    for (let x = 120; x < 280; x += 1) {
      const offset = (y * width + x) * 3;
      pixels[offset] = 180;
      pixels[offset + 1] = 40;
      pixels[offset + 2] = 40;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

async function main() {
  const source = await syntheticPackshot();
  const cutout = await normalizePackshotBuffer(source);
  assert.ok(cutout.backgroundRemoved, 'expected background removal on synthetic packshot');
  assert.ok(cutout.width < 400 || cutout.height < 400, 'trim should crop away background margins');

  const meta = await sharp(cutout.buffer).metadata();
  assert.ok(meta.width && meta.height, 'cutout should have dimensions');
  assert.ok(meta.hasAlpha, 'cutout should retain alpha channel');

  assert.ok(isAlreadyCutoutSource('/uploads/demo/products/abc-cutout.png'));
  assert.ok(isAlreadyCutoutSource('https://cdn.example.com/user/normalized/abc-cutout.png'));
  assert.equal(isAlreadyCutoutSource('/uploads/demo/products/raw.jpg'), false);

  console.log('packshot cutout contracts passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
