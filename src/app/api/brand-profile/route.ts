import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  brandProfileInput,
  readDemoBrandProfile,
  withDemoBrandProfile,
  type BrandProfile,
} from '@/lib/product-catalog';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.isDemo) return NextResponse.json(await readDemoBrandProfile());

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('brand_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

async function save(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = brandProfileInput(body);
  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No valid brand profile fields' }, { status: 400 });
  }
  if (input.brand_name === null) input.brand_name = '';

  const now = new Date().toISOString();

  if (user.isDemo) {
    const existing = await readDemoBrandProfile();
    const profile: BrandProfile = {
      id: existing?.id || randomUUID(),
      user_id: user.id,
      brand_name:
        typeof input.brand_name === 'string' ? input.brand_name : existing?.brand_name || '',
      website_url:
        'website_url' in input
          ? typeof input.website_url === 'string'
            ? input.website_url
            : null
          : existing?.website_url || null,
      description:
        'description' in input
          ? typeof input.description === 'string'
            ? input.description
            : null
          : existing?.description || null,
      target_audience:
        'target_audience' in input
          ? typeof input.target_audience === 'string'
            ? input.target_audience
            : null
          : existing?.target_audience || null,
      brand_voice:
        'brand_voice' in input
          ? typeof input.brand_voice === 'string'
            ? input.brand_voice
            : null
          : existing?.brand_voice || null,
      brand_values: Array.isArray(input.brand_values)
        ? input.brand_values
        : existing?.brand_values || [],
      logo_url:
        'logo_url' in input
          ? typeof input.logo_url === 'string'
            ? input.logo_url
            : null
          : existing?.logo_url || null,
      primary_color:
        'primary_color' in input
          ? typeof input.primary_color === 'string'
            ? input.primary_color
            : null
          : existing?.primary_color || null,
      secondary_color:
        'secondary_color' in input
          ? typeof input.secondary_color === 'string'
            ? input.secondary_color
            : null
          : existing?.secondary_color || null,
      approved_claims: Array.isArray(input.approved_claims)
        ? input.approved_claims
        : existing?.approved_claims || [],
      prohibited_claims: Array.isArray(input.prohibited_claims)
        ? input.prohibited_claims
        : existing?.prohibited_claims || [],
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    return withDemoBrandProfile(NextResponse.json(profile), profile);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('brand_profiles')
    .upsert(
      { ...input, user_id: user.id, updated_at: now },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export const POST = save;
export const PUT = save;
export const PATCH = save;
