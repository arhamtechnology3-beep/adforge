import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectCompetitorType } from '@/lib/utils';
import type { CompetitorEntry } from '@/types/database';
import { getSessionUser } from '@/lib/auth/session';
import {
  DEMO_CAMPAIGN_INPUT_ID,
  readDemoOnboarding,
  withDemoOnboardingCookie,
  type DemoOnboarding,
} from '@/lib/auth/demo-onboarding';
import { getDefaultDemoOnboarding } from '@/lib/auth/campaign-input';

function normalizeCompetitors(body: {
  competitors?: Array<{ url?: string; meta_page_id?: string | null }>;
  competitor_url?: string;
}): CompetitorEntry[] {
  const fromList = (body.competitors || [])
    .map((c) => ({
      url: (c.url || '').trim(),
      meta_page_id: c.meta_page_id?.toString().trim() || null,
    }))
    .filter((c) => c.url);

  if (fromList.length === 0 && body.competitor_url?.trim()) {
    fromList.push({ url: body.competitor_url.trim(), meta_page_id: null });
  }

  const seen = new Set<string>();
  const unique: Array<{ url: string; meta_page_id: string | null }> = [];
  for (const c of fromList) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    unique.push(c);
  }

  return unique.map((c) => ({
    url: c.url,
    type: detectCompetitorType(c.url),
    meta_page_id: c.meta_page_id && /^\d{5,}$/.test(c.meta_page_id) ? c.meta_page_id : null,
  }));
}

export async function POST(request: Request) {
  const user = await getSessionUser();

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

  if (user.isDemo) {
    const existing = await readDemoOnboarding();
    const row: DemoOnboarding = {
      id: existing?.id || DEMO_CAMPAIGN_INPUT_ID,
      user_id: user.id,
      ...payload,
      meta_connected: existing?.meta_connected || false,
      demo: true,
    };
    return withDemoOnboardingCookie(NextResponse.json(row), row);
  }

  const supabase = await createClient();

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
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.isDemo) {
    const saved = await readDemoOnboarding();
    return NextResponse.json(
      saved || {
        ...getDefaultDemoOnboarding(user.id),
        demo: true,
      }
    );
  }

  const supabase = await createClient();

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
