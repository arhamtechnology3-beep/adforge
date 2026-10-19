import assert from 'node:assert/strict';
import { productSceneUrl } from '../../src/lib/creatives';
import { buildDiwaliCreativeDirections } from '../../src/lib/creative-engine/diwali-campaign';
import {
  buildMetaAdLibraryPrompt,
  selectMetaAdPromptPreset,
  clearMetaAdPromptLibraryCache,
} from '../../src/lib/creative-engine/meta-ad-prompt-library';
import { generateSceneWithProviders } from '../../src/lib/creative-engine/providers';
import type { ProductTruthSheet } from '../../src/lib/creative-engine/types';

async function main() {
  const truth: ProductTruthSheet = {
    productId: 'prod-v',
    brandName: 'Divyaprabha Foods',
    productName: 'Mango Pickle',
    category: 'Pickles & Condiments',
    benefits: ['Homemade'],
    ingredients: [],
    verifiedFacts: [],
    allowedClaims: [],
    forbiddenClaims: [],
    primaryPackshot: '/api/demo-product-packshot',
    packshots: [],
    visualRules: {
      preserveLogo: true,
      preserveLabel: true,
      preservePackaging: true,
      preserveProductColor: true,
      preserveProductShape: true,
      preservePrintedText: true,
    },
  };

  clearMetaAdPromptLibraryCache();
  const directions = buildDiwaliCreativeDirections(truth);
  assert.equal(directions.length, 4);

  for (const direction of directions) {
    const preset = selectMetaAdPromptPreset({
      category: truth.category,
      direction,
    });
    assert.equal(preset.id, direction.preferredPresetId);
    assert.ok(preset.id.startsWith('diwali-'));

    const { prompt } = buildMetaAdLibraryPrompt({
      truth,
      direction,
      category: truth.category,
      aspect: direction.recommendedFormats[0],
    });
    assert.ok(prompt.includes('BACKGROUND AND ENVIRONMENT ONLY'));
    assert.ok(prompt.includes('BRAND INTEGRITY'));

    const localUrl = productSceneUrl(
      truth.category,
      direction.angle,
      42,
      direction.recommendedFormats[0],
      preset.id
    );
    assert.ok(localUrl.includes('/api/ads/background'));
    assert.ok(localUrl.includes(preset.id));
  }

  const scene = await generateSceneWithProviders({
    prompt: 'test diwali scene',
    negativePrompt: 'no product',
    aspect: '1:1',
    seed: 7,
    brand: truth.brandName,
    category: truth.category,
    angle: 'food-desire',
    mode: 'background',
    scenePresetId: 'diwali-thali-incomplete',
    scenePresetName: 'Diwali Thali Incomplete',
  });
  assert.ok(scene.url, 'scene url must not be empty');
  assert.ok(
    scene.provider === 'local' || scene.provider === 'arham',
    `unexpected provider ${scene.provider}`
  );
  if (scene.provider === 'local') {
    assert.ok(scene.url.includes('diwali-thali-incomplete'));
  }

  const bgPath = productSceneUrl('Pickles', 'food-desire', 3, '1:1', 'diwali-thali-incomplete');
  const { GET } = await import('../../src/app/api/ads/background/route');
  const res = await GET(new Request(`http://localhost${bgPath}`));
  assert.equal(res.status, 200);
  assert.ok((res.headers.get('content-type') || '').includes('image/png'));
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.ok(bytes.length > 2000, 'Diwali background PNG should be non-trivial');

  console.log('diwali-visual-fallback contracts passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
