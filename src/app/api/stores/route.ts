import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { maxStoresForPlan, readActiveStoreId, requireStore, storeCookie } from '@/lib/stores';
import type { PlanTier, Store } from '@/types/database';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.isDemo) {
    const store = await requireStore(user.id, { isDemo: true });
    return NextResponse.json({
      stores: [store],
      activeStore: store,
      maxStores: maxStoresForPlan('growth'),
      planTier: 'growth',
      canAdd: false,
    });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('users')
    .select('plan_tier')
    .eq('id', user.id)
    .maybeSingle();

  const planTier = (profile?.plan_tier || 'starter') as PlanTier;
  const maxStores = maxStoresForPlan(planTier);

  let stores: Store[] = [];
  let activeStore: Store | null = null;
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    stores = (data || []) as Store[];
    activeStore = stores.length ? await requireStore(user.id) : null;
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Stores unavailable',
        stores: [],
        activeStore: null,
        maxStores,
        planTier,
        canAdd: false,
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    stores,
    activeStore,
    maxStores,
    planTier,
    canAdd: stores.length < maxStores,
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.isDemo) {
    return NextResponse.json({ error: 'Demo session has one sample store' }, { status: 403 });
  }

  let body: { name?: string; website_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = String(body.name || '').trim();
  const website = String(body.website_url || '').trim();
  if (!name) return NextResponse.json({ error: 'Store name is required' }, { status: 400 });

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('users')
    .select('plan_tier')
    .eq('id', user.id)
    .maybeSingle();

  const planTier = (profile?.plan_tier || 'starter') as PlanTier;
  const maxStores = maxStoresForPlan(planTier);

  const { count, error: countError } = await supabase
    .from('stores')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if ((count || 0) >= maxStores) {
    return NextResponse.json(
      {
        error: `Your ${planTier} plan includes ${maxStores} store${maxStores === 1 ? '' : 's'}. Upgrade to add another.`,
        upgrade: true,
        maxStores,
        planTier,
      },
      { status: 402 }
    );
  }

  const { data, error } = await supabase
    .from('stores')
    .insert({
      user_id: user.id,
      name,
      website_url: website || null,
      agent_settings: {},
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Could not create store' }, { status: 500 });
  }

  const res = NextResponse.json({ store: data }, { status: 201 });
  const cookie = storeCookie(data.id);
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.isDemo) {
    return NextResponse.json({ error: 'Demo session cannot delete stores' }, { status: 403 });
  }

  let body: { storeId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const storeId = String(body.storeId || '').trim();
  if (!storeId) return NextResponse.json({ error: 'storeId is required' }, { status: 400 });

  const supabase = await createClient();
  const { data: stores, error: listError } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

  const owned = stores || [];
  if (!owned.some((store) => store.id === storeId)) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }
  if (owned.length <= 1) {
    return NextResponse.json(
      { error: 'Keep at least one store on this subscription.' },
      { status: 400 }
    );
  }

  const { error } = await supabase.from('stores').delete().eq('id', storeId).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const remaining = owned.filter((store) => store.id !== storeId);
  const activeId = await readActiveStoreId();
  const nextId =
    activeId && remaining.some((store) => store.id === activeId) ? activeId : remaining[0].id;

  const res = NextResponse.json({ ok: true, activeStoreId: nextId });
  const cookie = storeCookie(nextId);
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
