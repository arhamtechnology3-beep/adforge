import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { DEMO_USER, type SessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isTokenExpired, retrieveToken, storeToken } from '@/lib/meta';

export type MetaConnection = {
  user_id: string;
  meta_ad_account_id: string | null;
  meta_ad_account_name?: string | null;
  access_token_encrypted: string;
  token_expires_at: string | null;
  connected_at: string;
  page_id?: string | null;
  page_name?: string | null;
  source: 'demo' | 'supabase';
};

function demoMetaPath(userId = DEMO_USER.id): string {
  return path.join(process.cwd(), '.data', `demo-meta-${userId}.json`);
}

export async function readDemoMetaConnection(
  userId = DEMO_USER.id
): Promise<MetaConnection | null> {
  try {
    const raw = await readFile(demoMetaPath(userId), 'utf8');
    const parsed = JSON.parse(raw) as MetaConnection;
    if (!parsed?.access_token_encrypted) return null;
    return { ...parsed, source: 'demo' };
  } catch {
    return null;
  }
}

export async function saveDemoMetaConnection(
  connection: Omit<MetaConnection, 'source'>
): Promise<MetaConnection> {
  const dir = path.dirname(demoMetaPath(connection.user_id));
  await mkdir(dir, { recursive: true });
  const saved: MetaConnection = { ...connection, source: 'demo' };
  await writeFile(demoMetaPath(connection.user_id), JSON.stringify(saved, null, 2), 'utf8');
  return saved;
}

export async function clearDemoMetaConnection(userId = DEMO_USER.id): Promise<void> {
  try {
    await writeFile(demoMetaPath(userId), '{}', 'utf8');
  } catch {
    // ignore
  }
}

/** Resolve Meta ad-account connection for demo or real users. */
export async function resolveMetaConnection(
  user: SessionUser
): Promise<MetaConnection | null> {
  if (user.isDemo) {
    return readDemoMetaConnection(user.id);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('ad_accounts')
    .select(
      'user_id, meta_ad_account_id, access_token_encrypted, token_expires_at, connected_at, page_id, page_name'
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data?.access_token_encrypted) return null;
  return {
    user_id: data.user_id,
    meta_ad_account_id: data.meta_ad_account_id,
    access_token_encrypted: data.access_token_encrypted,
    token_expires_at: data.token_expires_at,
    connected_at: data.connected_at || new Date().toISOString(),
    page_id: (data as { page_id?: string | null }).page_id || null,
    page_name: (data as { page_name?: string | null }).page_name || null,
    source: 'supabase',
  };
}

export function metaConnectionIsLive(connection: MetaConnection | null): boolean {
  return Boolean(
    connection?.access_token_encrypted &&
      connection?.meta_ad_account_id &&
      !isTokenExpired(connection.token_expires_at)
  );
}

export function metaAccessToken(connection: MetaConnection): string {
  return retrieveToken(connection.access_token_encrypted);
}

export function encryptMetaToken(token: string): string {
  return storeToken(token);
}
