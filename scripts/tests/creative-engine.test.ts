import assert from 'node:assert/strict';
import { extractCompetitorPattern } from '../../src/lib/creative-engine/competitor-patterns';
import { generateCreativeDirections } from '../../src/lib/creative-engine/creative-directions';
import { truthFromProduct } from '../../src/lib/creative-engine/product-truth';
import { buildNegativePrompt } from '../../src/lib/creative-engine/prompt-builder';
import type { ProductBrief } from '../../src/lib/creative-quality';

const product: ProductBrief = {
  id: 'prod-1',
  brandName: 'Test Brand',
  productName: 'Test Product',
  category: 'Snacks',
  benefits: ['Crunchy texture', 'No preservatives'],
  ingredients: ['Rice', 'Spices'],
  price: '₹199',
  offer: '10% off',
  approvedClaims: ['Made in India'],
  prohibitedClaims: ['cures disease'],
  primaryPackshot: '/api/demo-product-packshot',
  packshots: ['/api/demo-product-packshot'],
};

const pattern = extractCompetitorPattern({
  id: 'ad-1',
  library_id: 'lib-1',
  headline: '8 jars for ₹599',
  primary_text: 'Variety combo pack for families',
  cta: 'SHOP_NOW',
  ad_format: 'carousel',
});

assert.equal(pattern.marketingAngle, 'Variety + bundle value');
assert.ok(pattern.sceneSequence.length >= 3);

const truth = truthFromProduct(product);
const directions = generateCreativeDirections({
  truth,
  patterns: [pattern],
  selectedAds: [
    {
      id: 'ad-1',
      library_id: 'lib-1',
      headline: '8 jars for ₹599',
      primary_text: 'Variety combo pack for families',
      cta: 'SHOP_NOW',
      ad_format: 'carousel',
    },
  ],
  maxDirections: 5,
});

assert.ok(directions.length >= 1);
assert.equal(directions[0].name, 'Variety / Bundle Value');
assert.ok(directions[0].sceneEnvironment?.includes('studio') || directions[0].sceneEnvironment?.includes('pedestal'));
assert.notEqual(directions[0].headline, directions[0].primaryText);
assert.ok(buildNegativePrompt(truth).includes('Do not alter'));

console.log('creative engine contracts passed');
