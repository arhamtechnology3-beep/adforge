import assert from 'node:assert/strict';
import { evaluateCreativeQuality, type ProductBrief } from '../../src/lib/creative-quality';
import { generateGroundedConcepts } from '../../src/lib/grounded-copy';

const product: ProductBrief = {
  id: 'product-1',
  brandName: 'Aarohi Pantry',
  productName: 'Everyday Masala Blend',
  category: 'Spices',
  description: 'A balanced blend for everyday cooking.',
  benefits: ['Easy to use'],
  ingredients: ['Coriander', 'Cumin'],
  price: '₹249',
  offer: undefined,
  approvedClaims: ['Made with familiar kitchen spices'],
  prohibitedClaims: ['Cures illness'],
  primaryPackshot: '/uploads/packshot.png',
  packshots: ['/uploads/packshot.png'],
};

async function run() {
  const concepts = await generateGroundedConcepts(
    product,
    [
      {
        id: 'source-1',
        library_id: 'source-1',
        headline: 'Competitor miracle cure',
        primary_text: 'FarmDidi cures illness',
        ad_format: 'single_image',
      },
    ],
    ['FarmDidi']
  );
  assert.equal(concepts.length, 1);
  assert.match(concepts[0].headline + concepts[0].primaryText, /Aarohi Pantry/i);
  assert.match(concepts[0].headline + concepts[0].primaryText, /Everyday Masala Blend/i);
  assert.doesNotMatch(concepts[0].headline + concepts[0].primaryText, /FarmDidi/i);
  assert.doesNotMatch(concepts[0].headline + concepts[0].primaryText, /cures illness/i);
  assert.ok(concepts[0].headline.length <= 40);
  assert.ok(concepts[0].primaryText.length <= 220);

  const valid = evaluateCreativeQuality({
    headline: concepts[0].headline,
    primaryText: concepts[0].primaryText,
    imageUrl: '/uploads/final.png',
    product,
    competitorNames: ['FarmDidi'],
  });
  assert.equal(valid.valid, true);
  assert.ok(valid.score >= 80);

  const leaked = evaluateCreativeQuality({
    headline: 'FarmDidi offer',
    primaryText: 'Try Aarohi Pantry Everyday Masala Blend. Cures illness.',
    imageUrl: '/uploads/final.png',
    product,
    competitorNames: ['FarmDidi'],
  });
  assert.equal(leaked.valid, false);
  assert.ok(leaked.flags.some((flag) => flag.includes('Competitor name leaked')));
  assert.ok(leaked.flags.some((flag) => flag.includes('Prohibited claim')));
}

run()
  .then(() => console.log('step2 grounding contracts passed'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
