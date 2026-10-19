import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  parseMetaAdPromptMarkdown,
  loadMetaAdPromptLibraryFromMarkdown,
  clearMetaAdPromptLibraryCache,
} from '../../src/lib/creative-engine/meta-ad-prompt-md-parser';
import {
  getMetaAdPromptLibrary,
  reloadMetaAdPromptLibrary,
  getMasterProductProtectionNegative,
  buildMetaAdLibraryPrompt,
  selectMetaAdPromptPreset,
} from '../../src/lib/creative-engine/meta-ad-prompt-library';

const mdPath = path.join(process.cwd(), 'docs/facebook_meta_product_ad_prompts.md');

clearMetaAdPromptLibraryCache();
const parsed = parseMetaAdPromptMarkdown(readFileSync(mdPath, 'utf8'));

assert.equal(parsed.presets.length, 15, 'MD should contain 15 presets (11 base + 4 Diwali)');
assert.ok(parsed.masterProductProtectionNegative.includes('PRODUCT PRESERVATION'));
assert.ok(parsed.presets[0].prompt.length > 100);
assert.equal(parsed.presets[0].id, 'premium-luxury-studio');
assert.ok(
  parsed.presets.some((p) => p.id === 'diwali-thali-incomplete'),
  'Diwali thali preset present'
);

const loaded = loadMetaAdPromptLibraryFromMarkdown(mdPath);
assert.ok(loaded);
assert.equal(loaded!.presets.length, 15);

clearMetaAdPromptLibraryCache();
const library = reloadMetaAdPromptLibrary();
assert.equal(library.source, 'markdown');
assert.equal(library.presets.length, 15);
assert.ok(getMasterProductProtectionNegative().includes('PRODUCT PRESERVATION'));

const foodPreset0 = selectMetaAdPromptPreset({
  category: 'Pickles & Condiments',
  direction: {
    conceptId: 'a',
    name: 'Test',
    angle: 'premium-hero',
    emotion: 'Trust',
    hook: '',
    visualStory: '',
    headline: '',
    primaryText: '',
    cta: 'Shop Now',
    recommendedFormats: ['1:1'],
  },
  sceneVariant: 0,
});
const foodPreset1 = selectMetaAdPromptPreset({
  category: 'Pickles & Condiments',
  direction: {
    conceptId: 'b',
    name: 'Test',
    angle: 'premium-hero',
    emotion: 'Trust',
    hook: '',
    visualStory: '',
    headline: '',
    primaryText: '',
    cta: 'Shop Now',
    recommendedFormats: ['1:1'],
  },
  sceneVariant: 1,
});
assert.notEqual(foodPreset0.id, foodPreset1.id, 'variants should pick different presets');

const { prompt, preset, source } = buildMetaAdLibraryPrompt({
  truth: {
    productId: 'p1',
    brandName: 'Test Brand',
    productName: 'Mango Pickle',
    category: 'Food',
    benefits: [],
    ingredients: [],
    verifiedFacts: [],
    allowedClaims: [],
    forbiddenClaims: [],
    primaryPackshot: '/test.png',
    packshots: [],
    visualRules: {
      preserveLogo: true,
      preserveLabel: true,
      preservePackaging: true,
      preserveProductColor: true,
      preserveProductShape: true,
      preservePrintedText: true,
    },
  },
  direction: {
    conceptId: 'd1',
    name: 'Fresh Hero',
    angle: 'food-desire',
    emotion: 'Craving',
    hook: 'Authentic taste',
    visualStory: 'Kitchen scene',
    headline: 'Mango Pickle',
    primaryText: 'Best pickle',
    cta: 'Shop Now',
    recommendedFormats: ['1:1'],
  },
  category: 'Food',
  sceneVariant: 2,
});
assert.equal(source, 'markdown');
assert.ok(prompt.includes('BACKGROUND AND ENVIRONMENT ONLY'));
assert.ok(prompt.includes(preset.name));
assert.ok(
  prompt.includes('BRAND INTEGRITY') || prompt.includes('packshot'),
  'brand integrity / packshot composite instructions present'
);

const { prompt: diwaliPrompt, preset: diwaliPreset } = buildMetaAdLibraryPrompt({
  truth: {
    productId: 'p1',
    brandName: 'Test Brand',
    productName: 'Mango Pickle',
    category: 'Food',
    benefits: [],
    ingredients: [],
    verifiedFacts: [],
    allowedClaims: [],
    forbiddenClaims: [],
    primaryPackshot: '/test.png',
    packshots: [],
    visualRules: {
      preserveLogo: true,
      preserveLabel: true,
      preservePackaging: true,
      preserveProductColor: true,
      preserveProductShape: true,
      preservePrintedText: true,
    },
  },
  direction: {
    conceptId: 'diwali-1',
    name: 'Diwali · Thali Incomplete',
    angle: 'food-desire',
    emotion: 'Craving',
    hook: 'Diwali ki thali… achaar ke bina adhuri!',
    visualStory: 'Festival thali empty pickle gap',
    headline: 'Thali incomplete without achaar',
    primaryText: 'Diwali ki thali… achaar ke bina adhuri! Tap Shop Now.',
    cta: 'Shop Now',
    recommendedFormats: ['1:1'],
    preferredPresetId: 'diwali-thali-incomplete',
  },
  category: 'Food',
});
assert.equal(diwaliPreset.id, 'diwali-thali-incomplete');
assert.ok(diwaliPrompt.includes('BRAND INTEGRITY'));
assert.ok(diwaliPrompt.includes('Diwali'));

console.log('meta-ad-prompt-library contracts passed (runtime MD loading)');
