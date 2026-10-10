import assert from 'node:assert/strict';
import {
  buildProductUrlCarouselAd,
  parseCarouselProductUrls,
  CAROUSEL_URL_MIN,
} from '../../src/lib/carousel-from-urls';
import {
  buildCarouselScorecard,
  deriveCarouselHook,
  mineBenefitPhrases,
  shortProductName,
} from '../../src/lib/carousel-story';

const urls = parseCarouselProductUrls(`
https://shop.example/p/1
https://shop.example/p/2
shop.example/p/3
https://shop.example/p/1
://bad
`);
assert.equal(urls.length, 3);
assert.ok(urls[2]?.startsWith('https://'));

const mangoClaims =
  'Saurashtra Special Mango Pickle. Bring the authentic taste of Gujarat. Handmade using a traditional recipe passed down for generations. Pure peanut oil. No artificial flavors.';

const built = buildProductUrlCarouselAd({
  campaignInputId: 'camp-1',
  brandName: 'Demo Brand',
  category: 'Pickle',
  storeUrl: 'https://shop.example',
  approvedClaims: [mangoClaims],
  products: [
    {
      product_url: 'https://shop.example/p/1',
      product_name: 'Mango Pickle | Aam ka Achar',
      brand_name: 'Demo Brand',
      price: '₹299.00',
      image_url: '/api/ads/product-image?src=https%3A%2F%2Fcdn.example%2F1.jpg',
      claims_text: mangoClaims,
    },
    {
      product_url: 'https://shop.example/p/2',
      product_name: 'Garlic Pickle',
      brand_name: 'Demo Brand',
      price: '₹249',
      image_url: '/api/ads/product-image?src=https%3A%2F%2Fcdn.example%2F2.jpg',
      claims_text: 'Sun-dried garlic, traditional recipe, no preservatives.',
    },
    {
      product_url: 'https://shop.example/p/2-copy',
      product_name: 'Garlic Pickle',
      brand_name: 'Demo Brand',
      price: '₹249',
      image_url: '/api/ads/product-image?src=https%3A%2F%2Fcdn.example%2F2.jpg',
    },
    {
      product_url: 'https://shop.example/p/3',
      product_name: 'Missing image',
      brand_name: 'Demo Brand',
      price: '',
      image_url: null,
      error: 'No product image found on this page',
    },
  ],
});

assert.ok(built.ad);
const ad = built.ad!;
assert.equal(ad.ad_format, 'carousel');
assert.equal(ad.media_payload.carousel_source, 'product_urls');
// 2 unique products + Shop Now end card (duplicate photo dropped, missing image skipped)
assert.equal(ad.media_payload.cards.length, 3);
const [hookCard, benefitCard, endCard] = ad.media_payload.cards;
assert.equal(hookCard?.overlay_role, 'hook');
assert.equal(hookCard?.link, 'https://shop.example/p/1');
assert.ok(hookCard?.image_url.startsWith('/api/ads/creative-card?'));
assert.ok(hookCard?.source_image_url?.includes('product-image'));
assert.equal(ad.headline, 'Authentic Saurashtra Flavours');
assert.equal(benefitCard?.overlay_role, 'benefit');
assert.ok(benefitCard?.overlay_text, 'benefit card gets a chip from its own page');
assert.equal(endCard?.overlay_role, 'cta');
assert.equal(endCard?.link, 'https://shop.example');
assert.ok(ad.copy_text.startsWith('Authentic Saurashtra Flavours.'));
assert.ok(ad.copy_text.includes('Tap Shop Now'));
assert.ok(!ad.copy_text.includes('swipe to explore'));
assert.equal(built.skipped.length, 1);
assert.ok(built.warnings.some((w) => w.includes('same photo')));
assert.equal(built.reelsFrames.length, 3);
assert.ok(built.reelsFrames.every((frame) => frame.includes('format=story_9x16')));

const overridden = buildProductUrlCarouselAd({
  campaignInputId: 'camp-1',
  brandName: 'Demo Brand',
  hookOverride: 'Pickles like Ba made',
  overlays: ['Handcrafted'],
  products: [
    { product_url: 'https://s.example/a', product_name: 'A', brand_name: '', price: '', image_url: '/a.jpg' },
    { product_url: 'https://s.example/b', product_name: 'B', brand_name: '', price: '', image_url: '/b.jpg' },
  ],
});
assert.equal(overridden.ad?.headline, 'Pickles like Ba made');
assert.equal(overridden.ad?.media_payload.cards[1]?.overlay_text, 'Handcrafted');

const tooFew = buildProductUrlCarouselAd({
  campaignInputId: 'camp-1',
  products: [
    {
      product_url: 'https://shop.example/p/1',
      product_name: 'Only one',
      brand_name: 'Demo',
      price: '',
      image_url: '/img.jpg',
    },
  ],
});
assert.equal(tooFew.ad, null);
assert.ok(tooFew.warnings.some((w) => w.includes(String(CAROUSEL_URL_MIN))));

assert.deepEqual(mineBenefitPhrases(['hing', 'mustard seeds']), []);
assert.ok(mineBenefitPhrases([mangoClaims]).includes('Traditional Recipe'));
assert.equal(shortProductName('Homemade Mango Pickle | Aam ka Achar'), 'Homemade Mango Pickle');
assert.equal(
  deriveCarouselHook({ claimsText: ['nothing special'], brand: 'Acme' }),
  'Swipe the Acme range'
);

const weak = buildCarouselScorecard({
  hook: '',
  productCards: 4,
  cardsWithBenefit: 0,
  cardsRendered: 0,
  totalCards: 5,
  hasCtaEndCard: false,
  primaryText: 'Shop now',
  benefitsInCopy: [],
  hasReelsCompanion: false,
});
assert.equal(weak.valid, false);
assert.ok(weak.flags.some((flag) => flag.startsWith('CTA visibility')));

const strong = buildCarouselScorecard({
  hook: 'Authentic Saurashtra Flavours',
  productCards: 4,
  cardsWithBenefit: 4,
  cardsRendered: 6,
  totalCards: 6,
  hasCtaEndCard: true,
  primaryText: 'Authentic Saurashtra Flavours. Traditional Recipe · Handmade.',
  benefitsInCopy: ['Traditional Recipe'],
  hasReelsCompanion: true,
});
assert.equal(strong.valid, true);
assert.equal(strong.score, 100);

console.log('carousel-from-urls contracts passed');
