import type { MetaAdLibraryAd } from '@/lib/ai';
import type { ProductBrief } from '@/lib/creative-quality';

export type GroundedConcept = {
  sourceLibraryId: string;
  headline: string;
  primaryText: string;
  subline: string;
  cta: string;
  template: 'hero-product' | 'offer-card' | 'benefit-proof' | 'recipe-lifestyle' | 'variety-grid';
};

function clean(value: unknown, max: number): string {
  return String(value || '')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

function fallbackConcept(
  product: ProductBrief,
  ad: Pick<MetaAdLibraryAd, 'library_id' | 'id' | 'headline' | 'primary_text'>
): GroundedConcept {
  const benefit =
    product.benefits[0] ||
    product.approvedClaims[0] ||
    product.description ||
    `Made for people who value quality ${product.category}`;
  const offer = product.offer || product.price || '';
  const source = `${ad.headline || ''} ${ad.primary_text || ''}`.toLowerCase();
  const template: GroundedConcept['template'] =
    offer || /offer|off|save|deal|₹/.test(source)
      ? 'offer-card'
      : /recipe|serve|meal|kitchen/.test(source)
        ? 'recipe-lifestyle'
        : product.packshots.length > 1
          ? 'variety-grid'
          : 'hero-product';

  return {
    sourceLibraryId: ad.library_id || ad.id,
    headline: clean(`${product.productName}${offer ? ` — ${offer}` : ''}`, 40),
    primaryText: clean(
      `${product.brandName}'s ${product.productName}. ${benefit}.${offer ? ` ${offer}.` : ''} Shop with confidence.`,
      220
    ),
    subline: clean(benefit, 70),
    cta: 'Shop Now',
    template,
  };
}

export async function generateGroundedConcepts(
  product: ProductBrief,
  ads: Array<Pick<MetaAdLibraryAd, 'library_id' | 'id' | 'headline' | 'primary_text' | 'ad_format'>>,
  competitorNames: string[] = [],
  preferences: { language?: string; tone?: string } = {}
): Promise<GroundedConcept[]> {
  const fallbacks = ads.map((ad) => fallbackConcept(product, ad));
  const key = process.env.OPENAI_API_KEY;
  if (!key || ads.length === 0) return fallbacks;

  const facts = {
    brand: product.brandName,
    product: product.productName,
    category: product.category,
    description: product.description || '',
    benefits: product.benefits,
    ingredients: product.ingredients,
    price: product.price || '',
    offer: product.offer || '',
    approved_claims: product.approvedClaims,
    prohibited_claims: product.prohibitedClaims,
  };
  const sources = ads.map((ad, index) => ({
    index,
    library_id: ad.library_id || ad.id,
    format: ad.ad_format,
    hook: clean(ad.headline, 120),
    body_pattern: clean(ad.primary_text, 260),
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.5,
        messages: [
          {
            role: 'system',
            content:
              'You write factual Meta ad copy. Use competitor ads only for structural inspiration. Never copy competitor identity, product facts, offers, slogans, or claims. Use only supplied product facts.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task:
                'Return JSON {"concepts":[...]}, one concept per source in the same order. headline <=40 chars, primaryText <=220 chars, subline <=70 chars, CTA Shop Now/Learn More/Order Now. Mention exact brand and product. template must be hero-product, offer-card, benefit-proof, recipe-lifestyle, or variety-grid.',
              product_facts: facts,
              language: preferences.language || 'English',
              tone: preferences.tone || 'Trustworthy',
              competitor_names_to_exclude: competitorNames,
              sources,
            }),
          },
        ],
      }),
    });
    if (!response.ok) return fallbacks;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content || '{}') as {
      concepts?: Array<Record<string, unknown>>;
    };
    if (!Array.isArray(parsed.concepts) || parsed.concepts.length !== ads.length) {
      return fallbacks;
    }
    return parsed.concepts.map((raw, index) => {
      const template = String(raw.template || '') as GroundedConcept['template'];
      const candidate: GroundedConcept = {
        sourceLibraryId: ads[index].library_id || ads[index].id,
        headline: clean(raw.headline, 40) || fallbacks[index].headline,
        primaryText: clean(raw.primaryText, 220) || fallbacks[index].primaryText,
        subline: clean(raw.subline, 70) || fallbacks[index].subline,
        cta: ['Shop Now', 'Learn More', 'Order Now'].includes(String(raw.cta))
          ? String(raw.cta)
          : fallbacks[index].cta,
        template: [
          'hero-product',
          'offer-card',
          'benefit-proof',
          'recipe-lifestyle',
          'variety-grid',
        ].includes(template)
          ? template
          : fallbacks[index].template,
      };
      const copy = `${candidate.headline} ${candidate.primaryText}`.toLowerCase();
      const leaksCompetitor = competitorNames.some(
        (name) =>
          name.trim().length > 2 &&
          name.toLowerCase() !== product.brandName.toLowerCase() &&
          copy.includes(name.toLowerCase())
      );
      const hasProhibitedClaim = product.prohibitedClaims.some(
        (claim) => claim.trim().length > 2 && copy.includes(claim.toLowerCase())
      );
      const grounded =
        copy.includes(product.brandName.toLowerCase()) &&
        copy.includes(product.productName.toLowerCase());
      // One failed model attempt is automatically repaired with the deterministic grounded copy.
      return leaksCompetitor || hasProhibitedClaim || !grounded
        ? fallbacks[index]
        : candidate;
    });
  } catch (error) {
    console.warn('[grounded-copy]', error instanceof Error ? error.message : error);
    return fallbacks;
  } finally {
    clearTimeout(timer);
  }
}
