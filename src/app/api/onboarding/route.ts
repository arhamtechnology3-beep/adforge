import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectCompetitorType } from '@/lib/utils';
import type { CompetitorEntry } from '@/types/database';

function normalizeCompetitors(body: {
  competitors?: Array<{ url?: string }>;
  competitor_url?: string;
}): CompetitorEntry[] {
  const fromList = (body.competitors || [])
    .map((c) => (c.url || '').trim())
    .filter(Boolean);

  if (fromList.length === 0 && body.competitor_url?.trim()) {
    fromList.push(body.competitor_url.trim());
  }

  const unique = [...new Set(fromList)];

  return unique.map((url) => ({
    url,
    type: detectCompetitorType(url),
  }));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { website_url } = body;

  if (!website_url?.trim()) {
    return NextResponse.json({ error: 'Website URL is required' }, { status: 400 });
  }

  const competitors = normalizeCompetitors(body);
  const primary = competitors[0] || null;

  const payload = {
    website_url: website_url.trim(),
    competitors,
    competitor_url: primary?.url || null,
    competitor_type: primary?.type || null,
  };

  // Resume existing onboarding row instead of creating duplicates
  const { data: existing } = await supabase
    .from('campaigns_input')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let data;
  let error;

  if (existing?.id) {
    ({ data, error } = await supabase
      .from('campaigns_input')
      .update(payload)
      .eq('id', existing.id)
      .eq('user_id', user.id)
      .select()
      .single());
  } else {
    ({ data, error } = await supabase
      .from('campaigns_input')
      .insert({ user_id: user.id, ...payload })
      .select()
      .single());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: campaign } = await supabase
    .from('campaigns_input')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: adAccount } = await supabase
    .from('ad_accounts')
    .select('id, meta_ad_account_id, connected_at')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({
    ...campaign,
    meta_connected: !!(adAccount?.meta_ad_account_id || adAccount?.id),
  });
}
