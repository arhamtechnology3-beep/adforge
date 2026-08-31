import { encrypt, decrypt } from './encryption';

const META_API_VERSION = 'v21.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export function getMetaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    scope: 'ads_management,ads_read,business_management,pages_read_engagement',
    response_type: 'code',
    state,
  });
  return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    code,
  });

  const res = await fetch(`${META_BASE}/oauth/access_token?${params}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta token exchange failed: ${err}`);
  }
  return res.json();
}

export async function getLongLivedToken(shortToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortToken,
  });

  const res = await fetch(`${META_BASE}/oauth/access_token?${params}`);
  if (!res.ok) throw new Error('Failed to get long-lived token');
  return res.json();
}

export async function getAdAccounts(accessToken: string) {
  const res = await fetch(
    `${META_BASE}/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error('Failed to fetch ad accounts');
  const data = await res.json();
  return data.data || [];
}

export async function createCampaign(
  accessToken: string,
  adAccountId: string,
  name: string,
  objective: string
) {
  const res = await fetch(`${META_BASE}/${adAccountId}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      objective,
      status: 'PAUSED',
      special_ad_categories: [],
      access_token: accessToken,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Campaign creation failed: ${err}`);
  }
  return res.json();
}

import {
  getObjectiveConfig,
  buildPlacementSpec,
  buildScheduleTimes,
  type CampaignAudienceInput,
} from '@/lib/meta-campaign';
import {
  resolveTargeting,
  buildTargetingSpec,
} from '@/lib/meta-targeting';

export type MetaAdSetTargeting = {
  countries?: string[];
  age_min?: number;
  age_max?: number;
  genders?: number[]; // 1 male, 2 female
  /** City names from UI — resolved to Meta geo keys when token available */
  locations?: string[];
  /** Interest names from UI — resolved to Meta interest IDs */
  interests?: string[];
  placements?: CampaignAudienceInput['placements'];
  start_date?: string | null;
  end_date?: string | null;
};

export type MetaAdSetOptions = {
  budgetType?: 'daily' | 'lifetime';
  objective?: string;
  accessToken?: string;
};

export async function createAdSet(
  accessToken: string,
  adAccountId: string,
  campaignId: string,
  budget: number,
  name: string,
  targeting?: MetaAdSetTargeting,
  options?: MetaAdSetOptions
) {
  const objConfig = getObjectiveConfig(options?.objective || 'OUTCOME_TRAFFIC');
  const placementSpec = buildPlacementSpec(targeting?.placements);
  const schedule = buildScheduleTimes({
    start_date: targeting?.start_date,
    end_date: targeting?.end_date,
  });

  const resolved = await resolveTargeting(
    targeting?.locations,
    targeting?.interests,
    options?.accessToken || accessToken
  );

  const targetingSpec = buildTargetingSpec({
    countries: targeting?.countries,
    age_min: targeting?.age_min,
    age_max: targeting?.age_max,
    genders: targeting?.genders,
    cities: resolved.cities,
    interests: resolved.interests,
    placements: placementSpec,
  });

  const body: Record<string, unknown> = {
    name,
    campaign_id: campaignId,
    billing_event: objConfig.billing_event,
    optimization_goal: objConfig.optimization_goal,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: targetingSpec,
    status: 'PAUSED',
    access_token: accessToken,
  };

  const budgetPaise = Math.round(budget * 100);
  if (options?.budgetType === 'lifetime') {
    body.lifetime_budget = budgetPaise;
  } else {
    body.daily_budget = budgetPaise;
  }

  if (schedule.start_time) body.start_time = schedule.start_time;
  if (schedule.end_time) body.end_time = schedule.end_time;

  // Sales objective: attach pixel for conversion optimization when configured
  if (objConfig.optimization_goal === 'OFFSITE_CONVERSIONS' && process.env.META_PIXEL_ID) {
    body.promoted_object = {
      pixel_id: process.env.META_PIXEL_ID,
      custom_event_type: 'PURCHASE',
    };
  }

  const res = await fetch(`${META_BASE}/${adAccountId}/adsets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ad set creation failed: ${err}`);
  }
  const result = await res.json();
  return {
    ...result,
    _targeting_resolved: resolved,
  };
}

export async function createAd(
  accessToken: string,
  adAccountId: string,
  adSetId: string,
  copyText: string,
  imageUrl: string,
  pageId: string,
  link?: string,
  headline?: string,
  ctaType?: string,
  linkDescription?: string
) {
  const destination = link || process.env.DEFAULT_AD_LINK || 'https://example.com';
  const linkData: Record<string, unknown> = {
    message: copyText.slice(0, 2200),
    link: destination,
    picture: imageUrl,
  };
  if (headline) linkData.name = headline.slice(0, 40);
  if (linkDescription) linkData.description = linkDescription.slice(0, 30);
  // Meta call_to_action types: SHOP_NOW, LEARN_MORE, ORDER_NOW, SIGN_UP, etc.
  const cta = (ctaType || 'SHOP_NOW').toUpperCase().replace(/\s+/g, '_');
  linkData.call_to_action = {
    type: cta,
    value: { link: destination },
  };

  const creativeRes = await fetch(`${META_BASE}/${adAccountId}/adcreatives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Creative ${Date.now()}`,
      object_story_spec: {
        page_id: pageId,
        link_data: linkData,
      },
      access_token: accessToken,
    }),
  });
  if (!creativeRes.ok) {
    const err = await creativeRes.text();
    throw new Error(`Creative creation failed: ${err}`);
  }
  const creative = await creativeRes.json();

  const adRes = await fetch(`${META_BASE}/${adAccountId}/ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Ad ${Date.now()}`,
      adset_id: adSetId,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
      access_token: accessToken,
    }),
  });
  if (!adRes.ok) {
    const err = await adRes.text();
    throw new Error(`Ad creation failed: ${err}`);
  }
  return adRes.json();
}

export async function activateCampaign(accessToken: string, campaignId: string) {
  const res = await fetch(`${META_BASE}/${campaignId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ACTIVE', access_token: accessToken }),
  });
  if (!res.ok) throw new Error('Failed to activate campaign');
  return res.json();
}

export async function pauseCampaign(accessToken: string, campaignId: string) {
  const res = await fetch(`${META_BASE}/${campaignId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'PAUSED', access_token: accessToken }),
  });
  if (!res.ok) throw new Error('Failed to pause campaign');
  return res.json();
}

export async function pauseAd(accessToken: string, adId: string) {
  const res = await fetch(`${META_BASE}/${adId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'PAUSED', access_token: accessToken }),
  });
  if (!res.ok) throw new Error('Failed to pause ad');
  return res.json();
}

export async function updateCampaignBudget(
  accessToken: string,
  adSetId: string,
  dailyBudgetInr: number
) {
  const res = await fetch(`${META_BASE}/${adSetId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      daily_budget: Math.round(dailyBudgetInr * 100),
      access_token: accessToken,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Budget update failed: ${err}`);
  }
  return res.json();
}

export type ParsedInsights = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  frequency: number;
  purchases: number;
  add_to_cart: number;
  initiate_checkout: number;
  cost_per_purchase: number | null;
  revenue: number;
  roas: number | null;
  conversion_rate: number | null;
  video_views: number;
  engagement_rate: number | null;
  raw: Record<string, unknown>;
};

function actionValue(
  actions: Array<{ action_type: string; value: string }> | undefined,
  type: string
): number {
  if (!actions) return 0;
  const hit = actions.find((a) => a.action_type === type || a.action_type.endsWith(type));
  return hit ? parseFloat(hit.value) : 0;
}

export function parseInsightsPayload(raw: Record<string, unknown> | null): ParsedInsights | null {
  if (!raw) return null;
  const actions = raw.actions as Array<{ action_type: string; value: string }> | undefined;
  const actionValues = raw.action_values as
    | Array<{ action_type: string; value: string }>
    | undefined;
  const costPerAction = raw.cost_per_action_type as
    | Array<{ action_type: string; value: string }>
    | undefined;

  const spend = parseFloat(String(raw.spend || '0'));
  const impressions = parseInt(String(raw.impressions || '0'), 10);
  const clicks = parseInt(String(raw.clicks || raw.inline_link_clicks || '0'), 10);
  const purchases = actionValue(actions, 'purchase');
  const add_to_cart = actionValue(actions, 'add_to_cart');
  const initiate_checkout = actionValue(actions, 'initiate_checkout');
  const revenue = actionValue(actionValues, 'purchase');
  const cpaPurchase = costPerAction?.find(
    (a) => a.action_type === 'purchase' || a.action_type.endsWith('purchase')
  )?.value;
  const video_views = actionValue(
    (raw.video_play_actions as Array<{ action_type: string; value: string }>) || actions,
    'video_view'
  );
  const engagements = parseFloat(String(raw.inline_post_engagement || '0'));
  const reach = parseInt(String(raw.reach || '0'), 10);

  return {
    spend,
    impressions,
    reach,
    clicks,
    cpc: parseFloat(String(raw.cpc || '0')),
    cpm: parseFloat(String(raw.cpm || '0')),
    ctr: parseFloat(String(raw.ctr || '0')),
    frequency: parseFloat(String(raw.frequency || '0')),
    purchases,
    add_to_cart,
    initiate_checkout,
    cost_per_purchase: cpaPurchase ? parseFloat(cpaPurchase) : purchases > 0 ? spend / purchases : null,
    revenue,
    roas: spend > 0 && revenue > 0 ? revenue / spend : null,
    conversion_rate: clicks > 0 ? (purchases / clicks) * 100 : null,
    video_views,
    engagement_rate: impressions > 0 ? (engagements / impressions) * 100 : null,
    raw,
  };
}

export async function getCampaignInsights(
  accessToken: string,
  campaignId: string,
  datePreset: string = 'last_7d'
) {
  const fields = [
    'spend',
    'impressions',
    'reach',
    'clicks',
    'inline_link_clicks',
    'ctr',
    'cpc',
    'cpm',
    'frequency',
    'actions',
    'action_values',
    'cost_per_action_type',
    'video_play_actions',
    'inline_post_engagement',
  ].join(',');

  const res = await fetch(
    `${META_BASE}/${campaignId}/insights?fields=${fields}&date_preset=${datePreset}&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error('Failed to fetch insights');
  const data = await res.json();
  return data.data?.[0] || null;
}

export async function getCampaignInsightBreakdowns(
  accessToken: string,
  campaignId: string,
  breakdown: 'publisher_platform' | 'age' | 'gender' | 'impression_device' | 'country',
  datePreset: string = 'last_7d'
) {
  const fields = 'spend,impressions,ctr,cpc,actions,action_values';
  const res = await fetch(
    `${META_BASE}/${campaignId}/insights?fields=${fields}&breakdowns=${breakdown}&date_preset=${datePreset}&access_token=${accessToken}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

export async function getAdEffectiveStatus(accessToken: string, adId: string) {
  const res = await fetch(
    `${META_BASE}/${adId}?fields=id,name,effective_status,configured_status,issues_info,ad_review_feedback&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error('Failed to fetch ad status');
  return res.json() as Promise<{
    id: string;
    name?: string;
    effective_status?: string;
    configured_status?: string;
    issues_info?: unknown;
    ad_review_feedback?: unknown;
  }>;
}

export async function getCampaignAds(accessToken: string, campaignId: string) {
  const res = await fetch(
    `${META_BASE}/${campaignId}/ads?fields=id,name,effective_status,creative{id,body,title,name}&access_token=${accessToken}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

export function storeToken(token: string): string {
  return encrypt(token);
}

export function retrieveToken(encrypted: string): string {
  return decrypt(encrypted);
}

export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) <= new Date();
}
