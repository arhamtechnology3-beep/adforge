/** Product photoshoot style briefs (5 Meta-ready looks). */

export type PhotoshootStyleId =
  | 'studio'
  | 'floating'
  | 'ingredient'
  | 'in_use'
  | 'lifestyle';

export type PhotoshootStyle = {
  id: PhotoshootStyleId;
  name: string;
  prompt: string;
  placements: string[];
  aspectRatios: string[];
};

export type PhotoshootPlan = {
  productName: string;
  brandName: string;
  packshotUrl?: string | null;
  styles: PhotoshootStyle[];
  notes: string[];
};

const STYLE_TEMPLATES: Array<Omit<PhotoshootStyle, 'prompt'> & { promptTpl: string }> = [
  {
    id: 'studio',
    name: 'Studio',
    placements: ['Feed 1:1', 'Right column'],
    aspectRatios: ['1:1', '4:5'],
    promptTpl:
      'Clean studio packshot of {product} by {brand} on seamless backdrop, softbox lighting, sharp label readable, ecommerce hero',
  },
  {
    id: 'floating',
    name: 'Floating',
    placements: ['Feed', 'Stories'],
    aspectRatios: ['1:1', '9:16'],
    promptTpl:
      'Floating {product} by {brand} with subtle shadow, gradient wash background, premium ad look, packshot unchanged',
  },
  {
    id: 'ingredient',
    name: 'Ingredient',
    placements: ['Carousel', 'Feed'],
    aspectRatios: ['1:1'],
    promptTpl:
      '{product} by {brand} surrounded by real ingredients, overhead flat lay, natural light, truthful food styling',
  },
  {
    id: 'in_use',
    name: 'In Use',
    placements: ['Reels', 'Stories', 'Feed'],
    aspectRatios: ['9:16', '4:5'],
    promptTpl:
      'Hands using {product} by {brand} in real home context, UGC feel, shallow depth, India household setting',
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle',
    placements: ['Feed', 'Audience Network'],
    aspectRatios: ['1:1', '4:5'],
    promptTpl:
      'Lifestyle scene featuring {product} by {brand} on dining table with family vibe, warm daylight, aspirational but real',
  },
];

export function planPhotoshoot(input: {
  productName: string;
  brandName: string;
  packshotUrl?: string | null;
  category?: string | null;
}): PhotoshootPlan {
  const product = input.productName || 'Product';
  const brand = input.brandName || 'Brand';
  const styles: PhotoshootStyle[] = STYLE_TEMPLATES.map((s) => ({
    id: s.id,
    name: s.name,
    placements: s.placements,
    aspectRatios: s.aspectRatios,
    prompt: s.promptTpl.replace(/\{product\}/g, product).replace(/\{brand\}/g, brand),
  }));

  return {
    productName: product,
    brandName: brand,
    packshotUrl: input.packshotUrl || null,
    styles,
    notes: [
      'Composite generated scenes behind an edge-aware packshot cutout — never redraw the label.',
      'Export 1:1 for Feed and 9:16 cover-fill for Stories/Reels.',
      input.category
        ? `Bias props toward ${input.category} category authenticity.`
        : 'Keep props category-authentic for Meta policy & trust.',
    ],
  };
}
