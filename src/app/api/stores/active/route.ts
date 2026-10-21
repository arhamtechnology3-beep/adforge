import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { demoStore, storeCookie } from '@/lib/stores';

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let storeId = '';
  try {
    const body = await request.json();
    storeId = String(body.storeId || '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!storeId) return NextResponse.json({ error: 'storeId is required' }, { status: 400 });

  if (user.isDemo) {
    const store = demoStore(user.id);
    if (storeId !== store.id) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    const res = NextResponse.json({ store });
    const cookie = storeCookie(store.id);
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const res = NextResponse.json({ store: data });
  const cookie = storeCookie(data.id);
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
