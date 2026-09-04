import type { PlacementToggles } from '@/lib/meta-campaign';

export const CAMPAIGN_PREFILL_KEY = 'adforge_campaign_prefill';

export type CampaignPrefill = {
  templateId?: string;
  name?: string;
  objective?: string;
  budget?: number;
  budget_type?: 'daily' | 'lifetime';
  cta?: string;
  link_description?: string;
  age_min?: number;
  age_max?: number;
  gender?: 'ALL' | 'MEN' | 'WOMEN';
  locations?: string;
  interests?: string;
  placements?: PlacementToggles;
  fromAds?: boolean;
  approvedCreativeIds?: string[];
  creativeAssets?: Array<{
    id: string;
    format: string;
    imageUrl?: string | null;
    videoUrl?: string | null;
  }>;
};

export function saveCampaignPrefill(data: CampaignPrefill): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(CAMPAIGN_PREFILL_KEY, JSON.stringify(data));
}

export function loadCampaignPrefill(): CampaignPrefill | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CAMPAIGN_PREFILL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CampaignPrefill;
  } catch {
    return null;
  }
}

export function clearCampaignPrefill(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CAMPAIGN_PREFILL_KEY);
}
