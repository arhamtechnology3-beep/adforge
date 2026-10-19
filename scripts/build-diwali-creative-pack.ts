/**
 * Builds the 4 Diwali creative prompt packs (background-only + brand integrity).
 * Does not call image providers — use /ads with Tone “Diwali festive” to generate scenes.
 *
 * Usage: npx tsx scripts/build-diwali-creative-pack.ts
 */
import {
  buildDiwaliCreativeDirections,
  DIWALI_PUBLISH_PATH,
  DIWALI_TAGLINES,
} from '../src/lib/creative-engine/diwali-campaign';
import {
  buildMetaAdLibraryNegativePrompt,
  buildMetaAdLibraryPrompt,
  clearMetaAdPromptLibraryCache,
} from '../src/lib/creative-engine/meta-ad-prompt-library';
import type { ProductTruthSheet } from '../src/lib/creative-engine/types';

const truth: ProductTruthSheet = {
  productId: process.env.DIWALI_PRODUCT_ID || 'local-product',
  brandName: process.env.DIWALI_BRAND || 'Your Brand',
  productName: process.env.DIWALI_PRODUCT || 'Achaar',
  category: 'Pickles & Condiments',
  benefits: ['Homemade festive taste'],
  ingredients: [],
  verifiedFacts: [],
  allowedClaims: [],
  forbiddenClaims: [],
  primaryPackshot: process.env.DIWALI_PACKSHOT || '/api/demo-product-packshot',
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

console.log('=== Diwali creative pack (4 ads) ===\n');
console.log('Publish:', DIWALI_PUBLISH_PATH.campaignNamePrefix);
console.log('Tone:', DIWALI_PUBLISH_PATH.tone);
console.log('Steps:\n', DIWALI_PUBLISH_PATH.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n'));
console.log('\n--- Taglines ---');
for (const t of DIWALI_TAGLINES) {
  console.log(`• [${t.id}] ${t.tagline}`);
}

for (const direction of directions) {
  const aspect = direction.recommendedFormats[0];
  const { prompt, preset, source } = buildMetaAdLibraryPrompt({
    truth,
    direction,
    category: truth.category,
    aspect,
  });
  const negative = buildMetaAdLibraryNegativePrompt(truth);
  console.log(`\n======== ${direction.name} (${aspect}) ========`);
  console.log('Preset:', preset.id, `(${source})`);
  console.log('Headline:', direction.headline);
  console.log('Primary:', direction.primaryText);
  console.log('CTA:', direction.cta);
  console.log('\n[SCENE PROMPT]\n', prompt.slice(0, 900), prompt.length > 900 ? '…' : '');
  console.log('\n[NEGATIVE]\n', negative.slice(0, 400), '…');
}

console.log(
  '\nDone. Generate live scenes in AdForge: Tone → Diwali festive → variants 4 → Regenerate pack.'
);
