import assert from 'node:assert/strict';
import {
  buildProductUrlCarouselAd,
  parseCarouselProductUrls,
  CAROUSEL_URL_MIN,
} from '../../src/lib/carousel-from-urls';

const urls = parseCarouselProductUrls(`
https://shop.example/p/1
https://shop.example/p/2
shop.example/p/3
https://shop.example/p/1
://bad
`);
assert.equal(urls.length, 3);
assert.ok(urls[2]?.startsWith('https://'));

const built = buildProductUrlCarouselAd({
  campaignInputId: 'camp-1',
  brandName: 'Demo Brand',
  products: [
    {
      product_url: 'https://shop.example/p/1',
      product_name: 'Mango Pickle',
      brand_name: 'Demo Brand',
      price: '₹299',
      image_url: '/api/ads/product-image?src=https%3A%2F%2Fcdn.example%2F1.jpg',
    },
    {
      product_url: 'https://shop.example/p/2',
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
assert.equal(built.ad!.ad_format, 'carousel');
assert.equal(built.ad!.media_payload.carousel_source, 'product_urls');
assert.equal(built.ad!.media_payload.cards.length, 2);
assert.equal(built.ad!.media_payload.cards[0]?.link, 'https://shop.example/p/1');
assert.equal(built.skipped.length, 1);
assert.ok(built.warnings.length >= 1);

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

console.log('carousel-from-urls contracts passed');
