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

assert.equal(parsed.presets.length, 11, 'MD should contain 11 presets');
assert.ok(parsed.masterProductProtectionNegative.includes('PRODUCT PRESERVATION'));
assert.ok(parsed.presets[0].prompt.length > 100);
assert.equal(parsed.presets[0].id, 'premium-luxury-studio');

const loaded = loadMetaAdPromptLibraryFromMarkdown(mdPath);
assert.ok(loaded);
assert.equal(loaded!.presets.length, 11);

clearMetaAdPromptLibraryCache();
const library = reloadMetaAdPromptLibrary();
assert.equal(library.source, 'markdown');
assert.equal(library.presets.length, 11);
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
assert.ok(prompt.includes('uploaded product') || prompt.includes('hero product'));

console.log('meta-ad-prompt-library contracts passed (runtime MD loading)');
