import assert from 'node:assert/strict';
import {
  buildDiwaliCreativeDirections,
  DIWALI_PUBLISH_PATH,
  DIWALI_TAGLINES,
  isDiwaliCampaignTheme,
} from '../../src/lib/creative-engine/diwali-campaign';
import { generateCreativeDirections } from '../../src/lib/creative-engine/creative-directions';
import { buildMetaAdLibraryPrompt, selectMetaAdPromptPreset } from '../../src/lib/creative-engine/meta-ad-prompt-library';
import { clearMetaAdPromptLibraryCache } from '../../src/lib/creative-engine/meta-ad-prompt-md-parser';
import type { ProductTruthSheet } from '../../src/lib/creative-engine/types';

const truth: ProductTruthSheet = {
  productId: 'prod-diwali',
  brandName: 'Demo Brand',
  productName: 'Mango Achaar',
  category: 'Pickles & Condiments',
  benefits: ['Homemade taste'],
  ingredients: ['Mango'],
  verifiedFacts: [],
  allowedClaims: [],
  forbiddenClaims: [],
  primaryPackshot: '/api/demo-product-packshot',
  packshots: ['/api/demo-product-packshot'],
  visualRules: {
    preserveLogo: true,
    preserveLabel: true,
    preservePackaging: true,
    preserveProductColor: true,
    preserveProductShape: true,
    preservePrintedText: true,
  },
};

assert.equal(DIWALI_TAGLINES.length, 4);
assert.ok(isDiwaliCampaignTheme('Diwali festive'));
assert.ok(isDiwaliCampaignTheme(undefined, 'diwali'));
assert.equal(isDiwaliCampaignTheme('Trustworthy'), false);

const directions = buildDiwaliCreativeDirections(truth);
assert.equal(directions.length, 4);
assert.equal(directions[0].headline, 'Thali incomplete without achaar');
assert.ok(directions[0].primaryText.includes('Diwali ki thali'));
assert.ok(directions[3].primaryText.includes('Ghar ka swaad'));
assert.equal(directions[3].recommendedFormats[0], '1:1');

clearMetaAdPromptLibraryCache();
for (const direction of directions) {
  const preset = selectMetaAdPromptPreset({
    category: truth.category,
    direction,
  });
  assert.equal(preset.id, direction.preferredPresetId, `${direction.name} locks preset`);
  const { prompt } = buildMetaAdLibraryPrompt({
    truth,
    direction,
    category: truth.category,
    aspect: direction.recommendedFormats[0],
  });
  assert.ok(prompt.includes('BACKGROUND AND ENVIRONMENT ONLY'));
  assert.ok(prompt.includes('BRAND INTEGRITY'));
  assert.ok(!/draw the product jar with logo/i.test(prompt));
}

const fromTone = generateCreativeDirections({
  truth,
  patterns: [],
  tone: 'Diwali festive',
  maxDirections: 4,
});
assert.equal(fromTone.length, 4);
assert.ok(fromTone.every((d) => d.preferredPresetId?.startsWith('diwali-')));

assert.equal(DIWALI_PUBLISH_PATH.variantCount, 4);
assert.ok(DIWALI_PUBLISH_PATH.steps.length >= 5);

console.log('diwali-campaign contracts passed');
