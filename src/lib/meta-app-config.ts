import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { encrypt, decrypt } from '@/lib/encryption';

export type PlatformMetaAppPublic = {
  configured: boolean;
  appId: string | null;
  redirectUri: string;
  source: 'env' | 'file' | 'none';
};

type StoredPlatformMetaApp = {
  app_id: string;
  app_secret_encrypted: string;
  redirect_uri: string;
  updated_at: string;
};

function filePath(): string {
  return path.join(process.cwd(), '.data', 'platform-meta-app.json');
}

function defaultRedirectUri(): string {
  return (
    process.env.META_REDIRECT_URI?.trim() ||
    `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/oauth/meta/callback`
  );
}

function readStored(): StoredPlatformMetaApp | null {
  try {
    if (!existsSync(filePath())) return null;
    const parsed = JSON.parse(readFileSync(filePath(), 'utf8')) as StoredPlatformMetaApp;
    if (!parsed?.app_id || !parsed?.app_secret_encrypted) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Platform Meta App credentials (AdForge's app — NOT per-customer).
 * Customers never enter these; they only Facebook-login via OAuth.
 */
export function getMetaAppConfig(): {
  appId: string;
  appSecret: string;
  redirectUri: string;
  source: 'env' | 'file';
} | null {
  const envId = process.env.META_APP_ID?.trim();
  const envSecret = process.env.META_APP_SECRET?.trim();
  const envRedirect = process.env.META_REDIRECT_URI?.trim() || defaultRedirectUri();
  if (envId && envSecret) {
    return {
      appId: envId,
      appSecret: envSecret,
      redirectUri: envRedirect,
      source: 'env',
    };
  }

  const stored = readStored();
  if (!stored) return null;
  try {
    return {
      appId: stored.app_id,
      appSecret: decrypt(stored.app_secret_encrypted),
      redirectUri: stored.redirect_uri || defaultRedirectUri(),
      source: 'file',
    };
  } catch {
    return null;
  }
}

export function getMetaAppPublicStatus(): PlatformMetaAppPublic {
  const cfg = getMetaAppConfig();
  return {
    configured: Boolean(cfg),
    appId: cfg ? `${cfg.appId.slice(0, 4)}…${cfg.appId.slice(-4)}` : null,
    redirectUri: cfg?.redirectUri || defaultRedirectUri(),
    source: cfg?.source || 'none',
  };
}

export function savePlatformMetaApp(input: {
  appId: string;
  appSecret: string;
  redirectUri?: string;
}): PlatformMetaAppPublic {
  const appId = input.appId.trim();
  const appSecret = input.appSecret.trim();
  if (!/^\d{5,}$/.test(appId)) {
    throw new Error('META App ID should be a numeric Facebook App ID');
  }
  if (appSecret.length < 8) {
    throw new Error('META App Secret looks too short');
  }
  const redirectUri = (input.redirectUri || defaultRedirectUri()).trim();
  const dir = path.dirname(filePath());
  mkdirSync(dir, { recursive: true });
  const payload: StoredPlatformMetaApp = {
    app_id: appId,
    app_secret_encrypted: encrypt(appSecret),
    redirect_uri: redirectUri,
    updated_at: new Date().toISOString(),
  };
  writeFileSync(filePath(), JSON.stringify(payload, null, 2), 'utf8');
  // Prefer file for this process immediately even if empty env vars exist
  process.env.META_APP_ID = appId;
  process.env.META_APP_SECRET = appSecret;
  process.env.META_REDIRECT_URI = redirectUri;
  return getMetaAppPublicStatus();
}
