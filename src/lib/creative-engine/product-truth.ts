import type { ProductBrief } from '@/lib/creative-quality';
import type { Product } from '@/lib/product-catalog';
import type { ProductTruthSheet } from './types';

export function truthFromProduct(product: Product | ProductBrief): ProductTruthSheet {
  const brief = 'brandName' in product ? product : null;
  const row = brief ? null : (product as Product);

  const brandName = brief?.brandName || row?.brand_name || '';
  const productName = brief?.productName || row?.product_name || '';
  const category = brief?.category || row?.category || 'Products';
  const benefits = brief?.benefits || row?.benefits || [];
  const ingredients = brief?.ingredients || row?.ingredients || [];
  const approved = brief?.approvedClaims || row?.approved_claims || [];
  const prohibited = brief?.prohibitedClaims || row?.prohibited_claims || [];
  const primaryPackshot = brief?.primaryPackshot || row?.primary_packshot || '';
  const packshots = brief?.packshots?.length
    ? brief.packshots
    : row?.packshots?.length
      ? row.packshots
      : primaryPackshot
        ? [primaryPackshot]
        : [];

  const verifiedFacts = [
    productName ? `Product name: ${productName}` : '',
    brandName ? `Brand: ${brandName}` : '',
    category ? `Category: ${category}` : '',
    brief?.price || row?.price ? `Price: ${brief?.price || row?.price}` : '',
    brief?.offer || row?.offer ? `Offer: ${brief?.offer || row?.offer}` : '',
    ...benefits.map((b) => `Benefit: ${b}`),
    ...ingredients.map((i) => `Ingredient: ${i}`),
  ].filter(Boolean);

  return {
    productId: brief?.id || row?.id || '',
    brandName,
    productName,
    category,
    description: brief?.description || row?.description || undefined,
    benefits,
    ingredients,
    price: brief?.price || row?.price || undefined,
    offer: brief?.offer || row?.offer || undefined,
    productUrl: brief?.productUrl || row?.product_url || undefined,
    verifiedFacts,
    allowedClaims: approved,
    forbiddenClaims: prohibited,
    primaryPackshot,
    packshots,
    visualRules: {
      preserveLogo: true,
      preserveLabel: true,
      preservePackaging: true,
      preserveProductColor: true,
      preserveProductShape: true,
      preservePrintedText: true,
    },
  };
}

export function productSpecificNegativePrompt(truth: ProductTruthSheet): string {
  const parts = [
    'Do not change label wording.',
    'Do not change bottle or jar dimensions.',
    `Do not alter ${truth.productName} packaging.`,
    `Preserve ${truth.brandName} logo exactly.`,
  ];
  for (const claim of truth.forbiddenClaims) {
    parts.push(`Do not claim: ${claim}`);
  }
  for (const ingredient of truth.ingredients.slice(0, 5)) {
    parts.push(`Do not show ingredient not in product: unrelated to ${ingredient}`);
  }
  return parts.join(' ');
}
