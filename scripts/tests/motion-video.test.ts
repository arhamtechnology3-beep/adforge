import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { renderMotionTemplateVideo } from '../../src/lib/motion-video';

async function run() {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'motion-test');
  const inputPath = path.join(uploadDir, 'packshot.png');
  await mkdir(uploadDir, { recursive: true });
  await writeFile(
    inputPath,
    await sharp({
      create: {
        width: 800,
        height: 1200,
        channels: 4,
        background: { r: 239, g: 130, b: 40, alpha: 1 },
      },
    })
      .png()
      .toBuffer()
  );

  const result = await renderMotionTemplateVideo({
    images: [{ kind: 'local', path: '/uploads/motion-test/packshot.png' }],
    aspect: '9:16',
    durationSeconds: 8,
    filenamePrefix: 'integration-test',
    text: {
      brand: 'Aarohi Pantry',
      headline: 'Everyday Masala Blend',
      body: 'A balanced blend for everyday cooking.',
      callToAction: 'Shop Now',
    },
  });
  assert.equal(result.ok, true, result.ok ? undefined : result.error);
  if (!result.ok) return;
  assert.equal(result.width, 1080);
  assert.equal(result.height, 1920);
  assert.equal(result.durationSeconds, 8);
  const video = await readFile(path.join(process.cwd(), 'public', result.videoPath));
  assert.ok(video.length > 10_000);
  assert.ok(video.subarray(4, 12).toString('ascii').includes('ftyp'));

  await Promise.all([
    rm(path.join(process.cwd(), 'public', result.videoPath), { force: true }),
    rm(path.join(process.cwd(), 'public', result.posterPath), { force: true }),
    rm(uploadDir, { recursive: true, force: true }),
  ]);
  console.log('motion video integration passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
