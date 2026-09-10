import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runOptimizeForUser } from '@/lib/meta-optimize/load-account';
import {
  designAbTest,
  scoreLandingPage,
  extractBrandDna,
  planPhotoshoot,
  planAudiences,
  computePpcMath,
} from '@/lib/meta-optimize';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'suite';

  const { dryRun, account, suite } = await runOptimizeForUser(user.id);

  if (view === 'health') {
    return NextResponse.json({ dryRun, health: suite.health });
  }
  if (view === 'audit') {
    return new NextResponse(suite.auditHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.json({
    dryRun,
    brandName: account.brandName,
    health: suite.health,
    tracking: suite.tracking,
    diversity: suite.diversity,
    budget: suite.budget,
    ppc: suite.ppc,
    attribution: suite.attribution,
    audiences: suite.audiences,
    brandDna: suite.brandDna,
    photoshoot: suite.photoshoot,
    killScale: suite.killScale,
    opsRecCount: suite.opsRecs.length,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = String(body.action || '');

  if (action === 'ab_plan') {
    const plan = designAbTest({
      hypothesis: {
        variable: (body.variable as 'creative') || 'creative',
        control: String(body.control || 'Control creative'),
        variant: String(body.variant || 'Variant creative'),
        expectedLiftPct: Number(body.expectedLiftPct || 20),
      },
      baselineConversionRate: Number(body.baselineConversionRate || 0.02),
      dailyConversions: body.dailyConversions != null ? Number(body.dailyConversions) : undefined,
      dailyVisitors: body.dailyVisitors != null ? Number(body.dailyVisitors) : undefined,
    });

    const row = {
      user_id: user.id,
      name: String(body.name || 'Creative A/B'),
      plan,
      status: 'planned',
      primary_kpi: String(body.primaryKpi || 'CPA'),
    };

    const { data, error } = await supabase
      .from('optimize_ab_tests')
      .insert(row)
      .select('*')
      .maybeSingle();

    // Table may not exist yet — still return plan
    return NextResponse.json({ plan, saved: data || null, dbError: error?.message || null });
  }

  if (action === 'landing_score') {
    const report = scoreLandingPage({
      url: String(body.url || ''),
      adHeadline: (body.adHeadline as string) || null,
      adPrimaryText: (body.adPrimaryText as string) || null,
      pageTitle: (body.pageTitle as string) || null,
      h1: (body.h1 as string) || null,
      metaDescription: (body.metaDescription as string) || null,
      hasCta: body.hasCta !== false,
      mobileFriendly: body.mobileFriendly !== false,
      loadTimeMs: body.loadTimeMs != null ? Number(body.loadTimeMs) : null,
      hasTrustSignals: Boolean(body.hasTrustSignals),
      hasHttps: body.hasHttps !== false,
      hasPixelHint: Boolean(body.hasPixelHint),
      formFieldCount: body.formFieldCount != null ? Number(body.formFieldCount) : null,
    });
    return NextResponse.json({ report });
  }

  if (action === 'brand_dna') {
    const profile = extractBrandDna({
      brandName: (body.brandName as string) || null,
      websiteUrl: (body.websiteUrl as string) || null,
      description: (body.description as string) || null,
      pageTitle: (body.pageTitle as string) || null,
      h1: (body.h1 as string) || null,
      bodyText: (body.bodyText as string) || null,
      colors: Array.isArray(body.colors) ? (body.colors as string[]) : null,
      existingVoice: (body.existingVoice as string) || null,
      category: (body.category as string) || null,
    });
    return NextResponse.json({ profile });
  }

  if (action === 'photoshoot') {
    const plan = planPhotoshoot({
      productName: String(body.productName || 'Product'),
      brandName: String(body.brandName || 'Brand'),
      packshotUrl: (body.packshotUrl as string) || null,
      category: (body.category as string) || null,
    });
    return NextResponse.json({ plan });
  }

  if (action === 'audiences') {
    const report = planAudiences({
      brandName: (body.brandName as string) || null,
      country: (body.country as string) || 'IN',
      hasPurchasePixel: Boolean(body.hasPurchasePixel),
      hasCustomerList: Boolean(body.hasCustomerList),
      purchaseCount90d: body.purchaseCount90d != null ? Number(body.purchaseCount90d) : 0,
    });
    return NextResponse.json({ report });
  }

  if (action === 'ppc_math') {
    const report = computePpcMath({
      aov: Number(body.aov || 499),
      marginPct: Number(body.marginPct || 40),
      adSpend: Number(body.adSpend || 0),
      revenue: Number(body.revenue || 0),
      purchases: Number(body.purchases || 0),
      clicks: body.clicks != null ? Number(body.clicks) : undefined,
      impressions: body.impressions != null ? Number(body.impressions) : undefined,
      ltv: body.ltv != null ? Number(body.ltv) : null,
    });
    return NextResponse.json({ report });
  }

  if (action === 'save_targets') {
    const patch: Record<string, unknown> = {};
    if (body.cpaTarget != null) patch.cpa_target = Number(body.cpaTarget);
    if (body.roasTarget != null) patch.roas_target = Number(body.roasTarget);
    if (body.dailyBudgetCap != null) patch.daily_budget_cap = Number(body.dailyBudgetCap);

    const { data: existing } = await supabase
      .from('users')
      .select('agent_settings')
      .eq('id', user.id)
      .maybeSingle();
    const agent_settings = {
      ...((existing?.agent_settings as object) || {}),
      tracking: {
        ...(((existing?.agent_settings as Record<string, unknown>)?.tracking as object) || {}),
        aov: body.aov != null ? Number(body.aov) : undefined,
        margin_pct: body.marginPct != null ? Number(body.marginPct) : undefined,
        ltv: body.ltv != null ? Number(body.ltv) : undefined,
        capi_enabled: body.capiEnabled != null ? Boolean(body.capiEnabled) : undefined,
        emq_score: body.emqScore != null ? Number(body.emqScore) : undefined,
        dedup_rate: body.dedupRate != null ? Number(body.dedupRate) : undefined,
        domain_verified: body.domainVerified != null ? Boolean(body.domainVerified) : undefined,
      },
    };
    patch.agent_settings = agent_settings;

    const { error } = await supabase.from('users').update(patch).eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
