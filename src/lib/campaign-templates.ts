import type { PlacementToggles } from '@/lib/meta-campaign';

export type CampaignTemplate = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  objective: string;
  budget: number;
  budget_type: 'daily' | 'lifetime';
  cta: string;
  age_min: number;
  age_max: number;
  gender: 'ALL' | 'MEN' | 'WOMEN';
  locations: string;
  interests: string;
  placements: PlacementToggles;
  link_description?: string;
  /** Suggested campaign name suffix */
  name_prefix: string;
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'festive-sale',
    name: 'Festive Sale',
    description: 'High-intent shoppers during festivals — urgency + offers',
    emoji: '🪔',
    objective: 'OUTCOME_SALES',
    budget: 1500,
    budget_type: 'daily',
    cta: 'SHOP_NOW',
    age_min: 21,
    age_max: 55,
    gender: 'ALL',
    locations: 'Mumbai, Delhi, Bengaluru, Hyderabad, Pune, Ahmedabad',
    interests: 'Online shopping, Gifting, Indian cuisine',
    placements: { reels: true, ig_feed: true, fb_feed: true, stories: true },
    link_description: 'Limited time offer',
    name_prefix: 'Festive Sale',
  },
  {
    id: 'new-launch',
    name: 'New Product Launch',
    description: 'Build awareness for a new SKU or collection',
    emoji: '🚀',
    objective: 'OUTCOME_AWARENESS',
    budget: 800,
    budget_type: 'daily',
    cta: 'LEARN_MORE',
    age_min: 18,
    age_max: 45,
    gender: 'ALL',
    locations: 'Mumbai, Delhi, Bengaluru, Chennai, Kolkata',
    interests: 'Fashion, Beauty, Online shopping',
    placements: { reels: true, ig_feed: true, fb_feed: false, stories: true },
    name_prefix: 'New Launch',
  },
  {
    id: 'traffic-boost',
    name: 'Store Traffic',
    description: 'Drive clicks to your Shopify store or landing page',
    emoji: '🔗',
    objective: 'OUTCOME_TRAFFIC',
    budget: 500,
    budget_type: 'daily',
    cta: 'SHOP_NOW',
    age_min: 18,
    age_max: 65,
    gender: 'ALL',
    locations: 'Mumbai, Delhi, Bengaluru, Hyderabad, Pune',
    interests: 'Online shopping',
    placements: { reels: false, ig_feed: true, fb_feed: true, stories: false },
    name_prefix: 'Traffic',
  },
  {
    id: 'retargeting',
    name: 'Retargeting Warm Audience',
    description: 'Re-engage visitors who viewed products but didn\'t buy',
    emoji: '🎯',
    objective: 'OUTCOME_SALES',
    budget: 750,
    budget_type: 'daily',
    cta: 'GET_OFFER',
    age_min: 22,
    age_max: 50,
    gender: 'ALL',
    locations: 'Mumbai, Delhi, Bengaluru',
    interests: 'Online shopping, Gifting',
    placements: { reels: true, ig_feed: true, fb_feed: true, stories: true },
    link_description: 'Complete your order',
    name_prefix: 'Retargeting',
  },
  {
    id: 'engagement',
    name: 'Brand Engagement',
    description: 'Grow followers, likes, and social proof',
    emoji: '💬',
    objective: 'OUTCOME_ENGAGEMENT',
    budget: 400,
    budget_type: 'daily',
    cta: 'LEARN_MORE',
    age_min: 18,
    age_max: 40,
    gender: 'ALL',
    locations: 'Mumbai, Delhi, Bengaluru, Hyderabad',
    interests: 'Fashion, Beauty, Health & wellness',
    placements: { reels: true, ig_feed: true, fb_feed: false, stories: true },
    name_prefix: 'Engagement',
  },
];

export function getCampaignTemplate(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}
