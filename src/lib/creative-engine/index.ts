import type { CreativeDirection, CompetitorPattern, ProductTruthSheet } from './types';
import { extractCompetitorPatterns } from './competitor-patterns';
import { generateCreativeDirections } from './creative-directions';
import { truthFromProduct } from './product-truth';
import { buildCreativePack } from './creative-pack';
import { generateGroundedConcepts } from '@/lib/grounded-copy';
import type { ProductBrief } from '@/lib/creative-quality';
import type { MetaAdFormat } from '@/lib/creatives';
import type { MetaAdLibraryAd } from '@/lib/ai';

export type CreativeEngineInput = {
  campaignInputId: string;
  product: ProductBrief;
  selectedAds: Array<
    Pick<
      MetaAdLibraryAd,
      'id' | 'library_id' | 'headline' | 'primary_text' | 'cta' | 'ad_format' | 'performance_rating' | 'performance_label'
    > & { brand?: string | null }
  >;
  competitorNames: string[];
  language?: string;
  tone?: string;
  formats?: MetaAdFormat[];
  selectedDirectionIds?: string[];
  selectedDirections?: CreativeDirection[];
  origin: string;
  ownerId: string;
  persistToStorage: boolean;
  maxDirections?: number;
};

export type CreativeEnginePlan = {
  truth: ProductTruthSheet;
  patterns: CompetitorPattern[];
  directions: CreativeDirection[];
};

export function planCreativeEngine(input: CreativeEngineInput): CreativeEnginePlan {
  const truth = truthFromProduct(input.product);
  const patterns = extractCompetitorPatterns(input.selectedAds);
  const directions = generateCreativeDirections({
    truth,
    patterns,
    selectedAds: input.selectedAds,
    language: input.language,
    tone: input.tone,
    maxDirections: input.maxDirections,
  });
  return { truth, patterns, directions };
}

/** Async planning with Ad Library–informed grounded copy (headline + primary text) */
export async function planCreativeEngineAsync(
  input: CreativeEngineInput
): Promise<CreativeEnginePlan> {
  const truth = truthFromProduct(input.product);
  const patterns = extractCompetitorPatterns(input.selectedAds);
  const groundedConcepts = await generateGroundedConcepts(
    input.product,
    input.selectedAds,
    input.competitorNames,
    { language: input.language, tone: input.tone }
  );
  const directions = generateCreativeDirections({
    truth,
    patterns,
    selectedAds: input.selectedAds,
    groundedConcepts,
    language: input.language,
    tone: input.tone,
    maxDirections: input.maxDirections,
  });
  return { truth, patterns, directions };
}

export async function runCreativeEngine(input: CreativeEngineInput) {
  const plan = await planCreativeEngineAsync(input);
  let selectedDirections =
    input.selectedDirections?.filter(Boolean).slice(0, 6) || [];

  if (!selectedDirections.length && input.selectedDirectionIds?.length) {
    selectedDirections = plan.directions.filter((direction) =>
      input.selectedDirectionIds!.includes(direction.conceptId)
    );
  }

  if (!selectedDirections.length) {
    selectedDirections = plan.directions.slice(0, 3);
  }

  const pack = await buildCreativePack({
    campaignInputId: input.campaignInputId,
    product: input.product,
    truth: plan.truth,
    directions: selectedDirections,
    patterns: plan.patterns,
    competitorNames: input.competitorNames,
    language: input.language,
    tone: input.tone,
    formats: input.formats,
    origin: input.origin,
    ownerId: input.ownerId,
    persistToStorage: input.persistToStorage,
  });

  return {
    plan,
    selectedDirections,
    ...pack,
  };
}
