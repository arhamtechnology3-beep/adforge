import assert from 'node:assert/strict';
import sharp from 'sharp';
import { evaluateScenePurity } from '../../src/lib/scene-purity';

async function uniformScene(): Promise<Buffer> {
  return sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 3,
      background: { r: 210, g: 185, b: 160 },
    },
  })
    .png()
    .toBuffer();
}

async function sceneWithCenterObject(): Promise<Buffer> {
  const width = 1080;
  const height = 1080;
  const pixels = Buffer.alloc(width * height * 3, 210);
  for (let y = 220; y < 860; y += 1) {
    for (let x = 300; x < 780; x += 1) {
      const offset = (y * width + x) * 3;
      pixels[offset] = 35;
      pixels[offset + 1] = 70;
      pixels[offset + 2] = 150;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

async function main() {
  const clean = await evaluateScenePurity(await uniformScene());
  assert.ok(clean.pure, `expected uniform scene to pass purity (score ${clean.score})`);

  const dirtyBuf = await sceneWithCenterObject();
  const dirty = await evaluateScenePurity(dirtyBuf);
  assert.equal(dirty.pure, false, 'expected center object scene to fail purity');
  assert.ok(dirty.score < clean.score, 'dirty scene should score lower than clean scene');

  console.log('scene purity contracts passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
