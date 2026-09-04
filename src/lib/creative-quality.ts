export type ProductBrief = {
  id: string;
  brandName: string;
  productName: string;
  category: string;
  description?: string;
  benefits: string[];
  ingredients: string[];
  price?: string;
  offer?: string;
  productUrl?: string;
  approvedClaims: string[];
  prohibitedClaims: string[];
  primaryPackshot: string;
  packshots: string[];
};

export type CreativeQualityResult = {
  score: number;
  valid: boolean;
  flags: string[];
};

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function evaluateCreativeQuality(input: {
  headline: string;
  primaryText: string;
  imageUrl?: string | null;
  product: ProductBrief;
  competitorNames?: string[];
}): CreativeQualityResult {
  const flags: string[] = [];
  const headline = input.headline.trim();
  const primary = input.primaryText.trim();
  const allCopy = normalized(`${headline} ${primary}`);
  const productName = normalized(input.product.productName);
  const brandName = normalized(input.product.brandName);

  if (!headline) flags.push('Missing headline');
  if (headline.length > 40) flags.push('Headline exceeds 40 characters');
  if (!primary) flags.push('Missing primary text');
  if (primary.length > 220) flags.push('Primary text exceeds 220 characters');
  if (!input.imageUrl) flags.push('Missing rendered media');
  if (productName && !allCopy.includes(productName)) flags.push('Product name is not mentioned');
  if (brandName && !allCopy.includes(brandName)) flags.push('Brand name is not mentioned');

  for (const competitor of input.competitorNames || []) {
    const name = normalized(competitor);
    if (name && name !== brandName && allCopy.includes(name)) {
      flags.push(`Competitor name leaked: ${competitor}`);
    }
  }

  for (const claim of input.product.prohibitedClaims) {
    const prohibited = normalized(claim);
    if (prohibited && allCopy.includes(prohibited)) {
      flags.push(`Prohibited claim used: ${claim}`);
    }
  }

  const critical = flags.some((flag) =>
    /Missing|Competitor|Prohibited|Product name|Brand name/.test(flag)
  );
  return {
    score: Math.max(0, 100 - flags.length * 14 - (critical ? 12 : 0)),
    valid: !critical && !flags.some((flag) => /exceeds/.test(flag)),
    flags,
  };
}
