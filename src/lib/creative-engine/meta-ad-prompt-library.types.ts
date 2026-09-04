/** Preset IDs — synced with docs/facebook_meta_product_ad_prompts.md */
export type MetaAdPromptPresetId =
  | 'premium-luxury-studio'
  | 'natural-lifestyle'
  | 'bold-scroll-stopper'
  | 'sunlight-premium-home'
  | 'minimal-clean'
  | 'dark-cinematic'
  | 'soft-beauty'
  | 'fresh-clean'
  | 'modern-urban'
  | 'problem-solution'
  | 'premium-ugc';

export type MetaAdPromptPreset = {
  id: MetaAdPromptPresetId;
  name: string;
  bestFor: string;
  purpose: string;
  /** Full scene prompt (from MD ```text block) */
  prompt: string;
};
