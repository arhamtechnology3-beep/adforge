import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { maxStoresForPlan, requireStore, storeCookie } from '@/lib/stores';
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
