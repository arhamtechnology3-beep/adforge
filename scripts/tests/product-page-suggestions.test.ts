import assert from 'node:assert/strict';
import {
  parseProductPageHtml,
  suggestProductFromPage,
} from '../../src/lib/product-page-suggestions';

const html = `
  <meta property="og:site_name" content="Example Foods">
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Traditional Mango Pickle",
      "description": "Prepared from selected raw mangoes using a traditional recipe. Made with authentic spices for a bold homestyle taste.",
      "brand": {"@type": "Brand", "name": "Example Foods"},
      "image": ["//example.com/cdn/shop/files/mango-front.png"],
      "offers": {"@type": "Offer", "price": "299", "priceCurrency": "INR"}
    }
  </script>
  <script>
    {"src":"\\/\\/example.com\\/cdn\\/shop\\/files\\/mango-side.jpg"}
  </script>
`;

const parsed = parseProductPageHtml(html, 'https://example.com/products/mango-pickle');
assert.equal(parsed.brand_name, 'Example Foods');
assert.equal(parsed.product_name, 'Traditional Mango Pickle');
assert.equal(parsed.category, 'Pickles');
assert.equal(parsed.price, '₹299');
assert.equal(parsed.benefits.length, 2);
assert.equal(parsed.image_urls.length, 2);

async function main() {
  await assert.rejects(
    () => suggestProductFromPage('http://127.0.0.1/private-product'),
    /Private or local/
  );
  console.log('product page suggestion contracts passed');
}

void main();
