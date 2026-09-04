/**
 * Server-only Meta OAuth helpers (uses platform Meta App credentials from env/file).
 * Do not import this from client components.
 */
import { getMetaAppConfig } from '@/lib/meta-app-config';

const META_API_VERSION = 'v21.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

function requireMetaApp() {
  const cfg = getMetaAppConfig();
  if (!cfg) {
    throw new Error(
      'Platform Meta App is not configured. Add AdForge META App ID/Secret once (not per customer).'
    );
  }
  return cfg;
}

export function getMetaAuthUrl(state: string): string {
  const cfg = requireMetaApp();
  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    // Do not request pages_manage_ads until the Meta app has that permission
    // available (App Review / use-case). Invalid scopes block the whole login dialog.
    scope:
      'ads_management,ads_read,business_management,pages_show_list,pages_read_engagement',
    response_type: 'code',
    state,
  });
  return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const cfg = requireMetaApp();
  const params = new URLSearchParams({
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    redirect_uri: cfg.redirectUri,
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
  const cfg = requireMetaApp();
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    fb_exchange_token: shortToken,
  });

  const res = await fetch(`${META_BASE}/oauth/access_token?${params}`);
  if (!res.ok) throw new Error('Failed to get long-lived token');
  return res.json();
}
