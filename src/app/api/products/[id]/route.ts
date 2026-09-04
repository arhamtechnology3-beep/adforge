import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { productInput, readDemoProducts, withDemoProducts } from '@/lib/product-catalog';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.isDemo) {
    const product = (await readDemoProducts()).find((item) => item.id === params.id);
    return product
      ? NextResponse.json(product)
      : NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const update = productInput(body, true);
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }
  if ('product_name' in update && !update.product_name) {
    return NextResponse.json({ error: 'product_name cannot be empty' }, { status: 400 });
  }
  if ('brand_name' in update && update.brand_name === null) update.brand_name = '';

  const updatedAt = new Date().toISOString();

  if (user.isDemo) {
    const products = await readDemoProducts();
    const index = products.findIndex((item) => item.id === params.id);
    if (index < 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    products[index] = { ...products[index], ...update, updated_at: updatedAt };
    return withDemoProducts(NextResponse.json(products[index]), products);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .update({ ...update, updated_at: updatedAt })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.isDemo) {
    const products = await readDemoProducts();
    const remaining = products.filter((item) => item.id !== params.id);
    if (remaining.length === products.length) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return withDemoProducts(NextResponse.json({ success: true }), remaining);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
