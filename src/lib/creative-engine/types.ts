import type { MetaAdFormat } from '@/lib/creatives';
import type { ProductBrief } from '@/lib/creative-quality';

export type CreativeAspect = '1:1' | '4:5' | '9:16';

export type ProviderHealth = {
  available: boolean;
  reason?: string;
  freeQuotaRemaining?: number;
};

export type GeneratedAsset = {
  url: string;
  provider: string;
  model?: string;
  isFinalCreative?: boolean;
  estimatedCost?: number;
  quotaUsed?: number;
};

export type ImageGenerationRequest = {
  prompt: string;
  negativePrompt: string;
  aspect: CreativeAspect;
  seed: number;
  brand?: string;
  category?: string;
  angle?: string;
  productImageUrl?: string | null;
  mode: 'background' | 'full';
  /** MD prompt preset id — used for local fallback styling */
  scenePresetId?: string;
  scenePresetName?: string;
};

export type VideoGenerationRequest = {
  images: Array<{ url: string; headline?: string; durationMs?: number }>;
  aspect: CreativeAspect;
  durationSeconds: number;
  scenePlan?: VideoScenePlan;
  publicOrigin: string;
  filenamePrefix: string;
};

export type VideoScenePlan = {
  duration: number;
  ugcType: UgcType;
  scenes: Array<{
    start: number;
    end: number;
    purpose: string;
    headline?: string;
    angle?: string;
  }>;
};

export type UgcType =
  | 'talking-head'
  | 'product-demo'
  | 'hands-only'
  | 'unboxing'
  | 'testimonial'
  | 'reaction'
  | 'recipe'
  | 'day-in-life'
  | 'problem-solution'
  | 'founder-story';

export interface ImageGenerationProvider {
  readonly id: string;
  generate(request: ImageGenerationRequest): Promise<GeneratedAsset | null>;
  healthCheck(): Promise<ProviderHealth>;
}

export interface VideoGenerationProvider {
  readonly id: string;
  generate(request: VideoGenerationRequest): Promise<GeneratedAsset | null>;
  healthCheck(): Promise<ProviderHealth>;
}

export type ProductTruthSheet = {
  productId: string;
  brandName: string;
  productName: string;
  category: string;
  description?: string;
  benefits: string[];
  ingredients: string[];
  price?: string;
  offer?: string;
  productUrl?: string;
  verifiedFacts: string[];
  allowedClaims: string[];
  forbiddenClaims: string[];
  primaryPackshot: string;
  packshots: string[];
  visualRules: {
    preserveLogo: boolean;
    preserveLabel: boolean;
    preservePackaging: boolean;
    preserveProductColor: boolean;
    preserveProductShape: boolean;
    preservePrintedText: boolean;
  };
};

export type CompetitorPattern = {
  sourceId: string;
  hook: string;
  marketingAngle: string;
  emotionalTrigger: string;
  offerMechanism: string;
  audience: string;
  visualStrategy: string;
  compositionPattern: string;
  productPositioning: string;
  ctaStrategy: string;
  videoHook: string;
  sceneSequence: string[];
};

export type CreativeDirection = {
  conceptId: string;
  name: string;
  angle: string;
  emotion: string;
  hook: string;
  visualStory: string;
  headline: string;
  primaryText: string;
  cta: string;
  ugcType?: UgcType;
  recommendedFormats: CreativeAspect[];
  sourcePatternId?: string;
  /** Library-informed scene environment (distinct per direction) */
  sceneEnvironment?: string;
  colorDirection?: string;
  layoutStyle?: string;
};

export type CreativeQaScores = {
  productIntegrity: number;
  visualQuality: number;
  brandConsistency: number;
  hookStrength: number;
  ctaClarity: number;
  mobileReadability: number;
  creativeUniqueness: number;
  policyRisk: number;
  overall: number;
};

export type GenerationJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rejected';

export type GenerationJob = {
  id: string;
  user_id: string;
  campaign_input_id: string;
  product_id: string;
  creative_concept_id?: string | null;
  provider?: string | null;
  model?: string | null;
  asset_type: 'image' | 'video' | 'pack';
  status: GenerationJobStatus;
  prompt?: string | null;
  negative_prompt?: string | null;
  source_assets?: Record<string, unknown>;
  result_assets?: Record<string, unknown>;
  started_at?: string | null;
  completed_at?: string | null;
  estimated_cost?: number;
  actual_cost?: number;
  quota_used?: number;
  error_message?: string | null;
  retry_count?: number;
  created_at: string;
};

export type CreativePackRequest = {
  campaignInputId: string;
  product: ProductBrief;
  truth: ProductTruthSheet;
  directions: CreativeDirection[];
  patterns: CompetitorPattern[];
  competitorNames: string[];
  language?: string;
  tone?: string;
  formats?: MetaAdFormat[];
  origin: string;
  ownerId: string;
  persistToStorage: boolean;
};

export type CreativePackResult = {
  ads: Array<{
    campaign_input_id: string;
    variant_number: number;
    copy_text: string;
    image_url: string;
    status: 'pending';
    ad_format: MetaAdFormat;
    media_payload: Record<string, unknown>;
    headline: string;
    angle: string;
  }>;
  jobs: string[];
};
