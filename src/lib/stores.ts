import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getPlan } from '@/lib/plans';
import { DEMO_USER } from '@/lib/auth/session';
import type { PlanTier, Store } from '@/types/database';

export const STORE_COOKIE = 'adforge_store';
export const DEMO_STORE_ID = 'demo-store-id';

const STORE_COLUMNS =
  'id, user_id, name, website_url, cpa_target, roas_target, daily_budget_cap, agent_settings, margin_pct, aov_default, ltv_default, created_at';

export function demoStore(userId: string): Store {
  return {
    id: DEMO_STORE_ID,
    user_id: userId,
    name: 'FarmDidi',
    website_url: 'https://farmdidi.com',
    cpa_target: null,
    roas_target: null,
    daily_budget_cap: null,
    agent_settings: {},
    margin_pct: null,
    aov_default: null,
    ltv_default: null,
    created_at: new Date().toISOString(),
  };
}

export function maxStoresForPlan(tier: PlanTier | string | null | undefined): number {
  return getPlan((tier as PlanTier) || 'starter').maxStores;
}

export async function readActiveStoreId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(STORE_COOKIE)?.value || null;
  } catch {
    return null;
  }
}

export function storeCookie(storeId: string) {
  return {
    name: STORE_COOKIE,
    value: storeId,
    options: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 365,
    },
  };
}

async function listStoresForUser(userId: string): Promise<Store[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stores')
    .select(STORE_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Store[];
}

async function ensureDefaultStore(userId: string): Promise<Store> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('users')
    .select('name, email, cpa_target, roas_target, daily_budget_cap, agent_settings, margin_pct, aov_default, ltv_default')
    .eq('id', userId)
    .maybeSingle();

  const name =
    (profile?.name && String(profile.name).trim()) ||
    (profile?.email ? String(profile.email).split('@')[0] : '') ||
    'Store';

  const { data, error } = await supabase
    .from('stores')
    .insert({
      user_id: userId,
      name,
      cpa_target: profile?.cpa_target ?? null,
      roas_target: profile?.roas_target ?? null,
      daily_budget_cap: profile?.daily_budget_cap ?? null,
      agent_settings: profile?.agent_settings || {},
      margin_pct: profile?.margin_pct ?? null,
      aov_default: profile?.aov_default ?? null,
      ltv_default: profile?.ltv_default ?? null,
    })
    .select(STORE_COLUMNS)
    .single();

  if (error || !data) throw new Error(error?.message || 'Could not create a store');
  return data as Store;
}

/** Active store for this login. Cookie wins when it belongs to the user; otherwise the oldest store. */
export async function requireStore(userId: string, opts?: { isDemo?: boolean }): Promise<Store> {
  if (opts?.isDemo || userId === DEMO_USER.id) return demoStore(userId);

  let stores = await listStoresForUser(userId);
  if (!stores.length) stores = [await ensureDefaultStore(userId)];

  const activeId = await readActiveStoreId();
  return stores.find((store) => store.id === activeId) || stores[0];
}

/** Null when the stores table is not available yet (migration 017 not applied). */
export async function loadActiveStore(
  userId: string,
  opts?: { isDemo?: boolean }
): Promise<Store | null> {
  if (opts?.isDemo || userId === DEMO_USER.id) return demoStore(userId);
  try {
    return await requireStore(userId);
  } catch {
    return null;
  }
}

export async function listOwnedStores(userId: string): Promise<Store[]> {
  return listStoresForUser(userId);
}

/**
 * Shopify CAPI has no session. store_id wins.
 * user_id is accepted only while the account has a single store.
 */
export async function resolveWebhookStore(opts: {
  userId?: string | null;
  storeId?: string | null;
}): Promise<
  | { userId: string; storeId: string | null }
  | { error: string; status: number }
> {
  const userId = opts.userId?.trim() || '';
  const storeId = opts.storeId?.trim() || '';

  let admin;
  try {
    admin = await createServiceClient();
  } catch {
    if (!userId && !storeId) {
      return { error: 'user_id query param or X-AdForge-User-Id required', status: 400 };
    }
    return { userId, storeId: storeId || null };
  }

  if (storeId) {
    const { data, error } = await admin
      .from('stores')
      .select('id, user_id')
      .eq('id', storeId)
      .maybeSingle();
    if (error) {
      if (/stores|schema cache|does not exist/i.test(error.message)) {
        return userId
          ? { userId, storeId: null }
          : { error: 'user_id query param or X-AdForge-User-Id required', status: 400 };
      }
      return { error: error.message, status: 500 };
    }
    if (!data) return { error: 'Unknown store_id', status: 404 };
    if (userId && data.user_id !== userId) {
      return { error: 'store_id does not match user_id', status: 400 };
    }
    return { userId: data.user_id, storeId: data.id };
  }

  if (!userId) {
    return { error: 'user_id query param or X-AdForge-User-Id required', status: 400 };
  }

  const { data: stores, error } = await admin
    .from('stores')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    if (/stores|schema cache|does not exist/i.test(error.message)) {
      return { userId, storeId: null };
    }
    return { error: error.message, status: 500 };
  }

  if ((stores || []).length > 1) {
    return {
      error: 'This account has multiple stores. Use ?store_id= so events land on the right shop.',
      status: 400,
    };
  }

  return { userId, storeId: stores?.[0]?.id || null };
}
