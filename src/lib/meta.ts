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

export async function createAdSet(
  accessToken: string,
  adAccountId: string,
  campaignId: string,
  budget: number,
  name: string
) {
  const res = await fetch(`${META_BASE}/${adAccountId}/adsets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      campaign_id: campaignId,
      daily_budget: Math.round(budget * 100),
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: {
        geo_locations: { countries: ['IN'] },
        age_min: 18,
        age_max: 65,
      },
      status: 'PAUSED',
      access_token: accessToken,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ad set creation failed: ${err}`);
  }
  return res.json();
}

export async function createAd(
  accessToken: string,
  adAccountId: string,
  adSetId: string,
  copyText: string,
  imageUrl: string,
  pageId: string
) {
  const creativeRes = await fetch(`${META_BASE}/${adAccountId}/adcreatives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Creative ${Date.now()}`,
      object_story_spec: {
        page_id: pageId,
        link_data: {
          message: copyText,
          link: process.env.DEFAULT_AD_LINK || 'https://example.com',
          picture: imageUrl,
        },
      },
      access_token: accessToken,
    }),
  });
  if (!creativeRes.ok) throw new Error('Creative creation failed');
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
  if (!adRes.ok) throw new Error('Ad creation failed');
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

export async function getCampaignInsights(
  accessToken: string,
  campaignId: string,
  datePreset: string = 'last_7d'
) {
  const fields = 'spend,impressions,ctr,cpc,cost_per_action_type';
  const res = await fetch(
    `${META_BASE}/${campaignId}/insights?fields=${fields}&date_preset=${datePreset}&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error('Failed to fetch insights');
  const data = await res.json();
  return data.data?.[0] || null;
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
