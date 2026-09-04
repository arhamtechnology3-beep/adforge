import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  productInput,
  readDemoProducts,
  withDemoProducts,
  type Product,
} from '@/lib/product-catalog';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const activeOnly = new URL(request.url).searchParams.get('active') === 'true';

  if (user.isDemo) {
    const products = await readDemoProducts();
    return NextResponse.json(activeOnly ? products.filter((product) => product.is_active) : products);
  }

  const supabase = await createClient();
  let query = supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (activeOnly) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = productInput(body);
  if (typeof input.product_name !== 'string' || !input.product_name) {
    return NextResponse.json({ error: 'product_name is required' }, { status: 400 });
  }

  if (user.isDemo) {
    const now = new Date().toISOString();
    const product: Product = {
      ...(input as Omit<Product, 'id' | 'user_id' | 'created_at' | 'updated_at'>),
      id: randomUUID(),
      user_id: user.id,
      brand_profile_id:
        typeof input.brand_profile_id === 'string' ? input.brand_profile_id : null,
      brand_name: typeof input.brand_name === 'string' ? input.brand_name : '',
      product_name: input.product_name,
      category: typeof input.category === 'string' ? input.category : null,
      description: typeof input.description === 'string' ? input.description : null,
      benefits: Array.isArray(input.benefits) ? input.benefits : [],
      ingredients: Array.isArray(input.ingredients) ? input.ingredients : [],
      price: typeof input.price === 'string' ? input.price : null,
      offer: typeof input.offer === 'string' ? input.offer : null,
      product_url: typeof input.product_url === 'string' ? input.product_url : null,
      approved_claims: Array.isArray(input.approved_claims) ? input.approved_claims : [],
      prohibited_claims: Array.isArray(input.prohibited_claims)
        ? input.prohibited_claims
        : [],
      packshots: Array.isArray(input.packshots) ? input.packshots : [],
      primary_packshot:
        typeof input.primary_packshot === 'string' ? input.primary_packshot : null,
      is_active: typeof input.is_active === 'boolean' ? input.is_active : true,
      is_approved: typeof input.is_approved === 'boolean' ? input.is_approved : false,
      created_at: now,
      updated_at: now,
    };
    const products = await readDemoProducts();
    return withDemoProducts(NextResponse.json(product, { status: 201 }), [product, ...products]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
