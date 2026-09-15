/**
 * Preflight gate before Hostinger deploy.
 * Run: npx tsx scripts/tests/preflight-live-gate.ts
 * Exit 1 on any failure — do not push until this passes.
 */
import { config } from 'dotenv';
import path from 'path';
import { spawnSync } from 'child_process';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import {
  retrieveToken,
  getCampaignInsights,
  parseInsightsPayload,
} from '../../src/lib/meta';
import { syncMetaPerformanceForUser } from '../../src/lib/sync-meta-performance';
import { REPORT_CATALOG } from '../../src/lib/reports/catalog';
import { buildReport, metricsFromSnapshots } from '../../src/lib/reports/build';
import { runOpsAnalysis } from '../../src/lib/ops-agent';
import { analyzePerformanceV2 } from '../../src/lib/meta-optimize/ops-v2';
import { dryRunOptimizeAccount, runOptimizeSuite } from '../../src/lib/meta-optimize';

const fails: string[] = [];
const pass = (name: string, detail = '') => console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
const fail = (name: string, detail: string) => {
  fails.push(`${name}: ${detail}`);
  console.log(`FAIL  ${name} — ${detail}`);
};

function runCmd(label: string, cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    env: { ...process.env, npm_config_devdir: undefined },
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (r.status !== 0) {
    fail(label, out.split('\n').filter((l) => /error|Error|FAIL|Failed/i.test(l)).slice(0, 12).join(' | ') || `exit ${r.status}`);
    return false;
  }
  pass(label);
  return true;
}

async function main() {
  console.log('\n=== PREFLIGHT GATE (do not push until green) ===\n');

  // 1) Static gates Hostinger runs
  runCmd('tsc', 'npx', ['tsc', '--noEmit', '-p', 'tsconfig.json']);
  runCmd('eslint-reports-api', 'npx', ['next', 'lint', '--file', 'src/app/api/reports/route.ts']);
  runCmd('eslint-ops-api', 'npx', ['next', 'lint', '--file', 'src/app/api/ops/recommendations/route.ts']);
  runCmd('eslint-ops-confirm', 'npx', [
    'next',
    'lint',
    '--file',
    'src/app/api/ops/recommendations/[id]/confirm/route.ts',
  ]);
  runCmd('eslint-ops-client', 'npx', ['next', 'lint', '--file', 'src/app/(dashboard)/ops/OpsClient.tsx']);
  runCmd('eslint-campaign-wizard', 'npx', [
    'next',
    'lint',
    '--file',
    'src/components/campaign-wizard/CampaignWizard.tsx',
  ]);
  runCmd('eslint-launch-api', 'npx', ['next', 'lint', '--file', 'src/app/api/campaigns/launch/route.ts']);
  runCmd('unit-meta-optimize', 'npx', ['tsx', 'scripts/tests/meta-optimize.test.ts']);
  runCmd('unit-sales-gate', 'npx', ['tsx', 'scripts/tests/campaign-sales-gate.test.ts']);
  runCmd('unit-audience-suggest', 'npx', ['tsx', 'scripts/tests/audience-suggest.test.ts']);

  // Prefer full next build when not skipped (slow but matches Hostinger)
  if (process.env.PREFLIGHT_SKIP_BUILD !== '1') {
    runCmd('next-build', 'npx', ['next', 'build']);
  } else {
    console.log('SKIP  next-build (PREFLIGHT_SKIP_BUILD=1)');
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    fail('env', 'Missing Supabase env');
    console.log(`\nFAILS ${fails.length}\n${fails.join('\n')}`);
    process.exit(1);
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: accounts } = await sb
    .from('ad_accounts')
    .select('*')
    .not('access_token_encrypted', 'is', null)
    .order('connected_at', { ascending: false })
    .limit(1);
  if (!accounts?.[0]) {
    fail('meta_account', 'No connected ad account');
  } else {
    pass('meta_account', accounts[0].meta_ad_account_id);
  }

  const userId = accounts![0].user_id as string;
  const { data: camps, error: campErr } = await sb
    .from('meta_campaigns')
    .select('id, name, status, budget, objective, meta_campaign_id, launch_config, ad_ids')
    .eq('user_id', userId);
  if (campErr) fail('campaigns_query', campErr.message);
  else pass('campaigns_query', `${camps?.length || 0} rows`);

  // Simulate Optimize load-account column (must be budget, not daily_budget)
  const bad = await sb
    .from('meta_campaigns')
    .select('id, daily_budget')
    .eq('user_id', userId)
    .limit(1);
  if (bad.error?.message?.includes('daily_budget')) {
    pass('optimize_column_guard', 'daily_budget correctly absent');
  } else if (bad.error) {
    fail('optimize_column_guard', bad.error.message);
  } else {
    fail('optimize_column_guard', 'daily_budget unexpectedly exists — load-account must use budget');
  }

  const good = await sb
    .from('meta_campaigns')
    .select('id, name, status, budget, objective, launch_config, ad_ids')
    .eq('user_id', userId);
  if (good.error || !good.data?.length) fail('optimize_select', good.error?.message || 'no campaigns');
  else pass('optimize_select', good.data.map((c) => c.name).join(', '));

  const liveCamp =
    (camps || []).find((c) => c.status === 'active' && c.meta_campaign_id) ||
    (camps || []).find((c) => c.meta_campaign_id);

  if (!liveCamp?.meta_campaign_id) {
    fail('live_campaign', 'No Meta-linked campaign');
  } else {
    pass('live_campaign', `${liveCamp.name} · ${liveCamp.status}`);
  }

  const token = retrieveToken(accounts![0].access_token_encrypted);
  const metaToday = parseInsightsPayload(
    await getCampaignInsights(token, liveCamp!.meta_campaign_id!, 'today')
  );
  pass(
    'meta_insights_today',
    metaToday
      ? `spend=₹${metaToday.spend} clicks=${metaToday.clicks} ctr=${metaToday.ctr}`
      : 'null (ok early day)'
  );

  const sync = await syncMetaPerformanceForUser(sb, {
    userId,
    campaignId: liveCamp!.id,
  });
  if (sync.campaigns.some((c) => c.error)) {
    fail('sync', sync.campaigns.map((c) => c.error).filter(Boolean).join('; '));
  } else {
    pass('sync', `snapshotsWritten=${sync.snapshotsWritten}`);
  }

  const { data: snaps } = await sb
    .from('performance_snapshots')
    .select('*')
    .eq('meta_campaign_id', liveCamp!.id)
    .order('date', { ascending: true });
  if (!snaps?.length) fail('snapshots', 'none after sync');
  else pass('snapshots', snaps.map((s) => `${s.date}:₹${s.spend}`).join(' | '));

  const campMeta = [
    {
      id: liveCamp!.id,
      name: liveCamp!.name,
      budget: liveCamp!.budget != null ? Number(liveCamp!.budget) : null,
      status: liveCamp!.status,
    },
  ];

  // Reports: all views, no demo leak, campaign-scoped
  const demo = /Festive Pickles|UGC Stories · Conversions|Chana Keri|Demo Pickles/i;
  let dryCount = 0;
  let leakCount = 0;
  for (const item of REPORT_CATALOG) {
    const report = buildReport({
      view: item.id,
      snapshots: snaps || [],
      campaigns: campMeta,
      recommendations: [],
    });
    if (report.dryRun) {
      dryCount += 1;
      fail(`report_dry_${item.id}`, 'dryRun=true with live spend');
    }
    if (demo.test(JSON.stringify(report))) {
      leakCount += 1;
      fail(`report_leak_${item.id}`, 'demo strings in live report');
    }
  }
  if (!dryCount && !leakCount) pass('reports_all_views', `${REPORT_CATALOG.length} live`);

  const pacing = buildReport({
    view: 'pacing',
    snapshots: snaps || [],
    campaigns: campMeta,
  });
  if (pacing.kpis.some((k) => /Ganpati|Campaign/i.test(k.label))) {
    const pct = Number(String(pacing.kpis[0].value).replace('%', ''));
    if (pct > 200) {
      fail('reports_pacing_name', `suspiciously high pacing ${pacing.kpis[0].value} (likely multi-day/total bug)`);
    } else {
      pass('reports_pacing_name', pacing.kpis.map((k) => `${k.label}=${k.value} (${k.hint})`).join(', '));
    }
  } else fail('reports_pacing_name', JSON.stringify(pacing.kpis));

  // Ops: metrics + decision guides + confirm payload shape
  const metrics = metricsFromSnapshots(snaps || [], campMeta);
  if (metrics[0]?.spendToday == null) fail('ops_spendToday', 'missing spendToday on metrics');
  else pass('ops_spendToday', `₹${metrics[0].spendToday}`);

  const ops = runOpsAnalysis({
    metrics,
    useDryRun: false,
    targets: { cpaTarget: 100, roasTarget: 2.5, dailyBudgetCap: null },
  });
  pass('ops_recs', `${ops.recommendations.length} recommendations`);

  for (const r of ops.recommendations) {
    const pa = r.proposed_action || {};
    const hasGuide =
      typeof pa.what === 'string' &&
      typeof pa.why === 'string' &&
      typeof pa.confirmDoes === 'string' &&
      typeof pa.recommend === 'string';
    if (!hasGuide) fail(`ops_guide_${r.type}`, 'missing what/why/confirmDoes/recommend');
    if (!r.proposed_action?.action && !['monitoring'].includes(r.type)) {
      // action may be in proposed_action
    }
    if (!pa.action) fail(`ops_action_${r.type}`, 'missing proposed_action.action');
  }
  if (!fails.some((f) => f.startsWith('ops_guide_') || f.startsWith('ops_action_'))) {
    pass('ops_guides', 'all recs have decision fields + action');
  }

  // Pacing must use today spend, not multi-day total vs daily budget
  const daySpend = metrics[0].spendToday ?? metrics[0].spend;
  const budget = metrics[0].budget || 500;
  const falseOver = metrics[0].spend / budget > 1.15 && daySpend / budget <= 1.15;
  const pacingRec = ops.recommendations.find((r) => r.type === 'pacing_over');
  if (falseOver && pacingRec) {
    fail('ops_pacing_false_positive', 'multi-day spend triggered over-pacing while today is within budget');
  } else {
    pass(
      'ops_pacing_logic',
      pacingRec
        ? `over-pace today ₹${daySpend}/₹${budget}`
        : `no over-pace (today ₹${daySpend}/₹${budget})`
    );
  }

  // Confirm payload contract for live-* ids (what client must POST)
  const sample = ops.recommendations[0];
  if (sample) {
    const payload = {
      decision: 'reject' as const,
      recommendation: {
        source: sample.source,
        type: sample.type,
        severity: sample.severity,
        title: sample.title,
        body: sample.body,
        proposed_action: sample.proposed_action,
        meta_campaign_id: sample.meta_campaign_id || liveCamp!.id,
      },
    };
    if (!payload.recommendation.title || !payload.recommendation.type) {
      fail('confirm_payload', 'incomplete');
    } else {
      pass('confirm_payload', `type=${payload.recommendation.type} action=${payload.recommendation.proposed_action.action}`);
    }

    // Persist reject path via service role (mirrors confirm route after auth)
    const { data: inserted, error: insErr } = await sb
      .from('agent_recommendations')
      .insert({
        user_id: userId,
        meta_campaign_id: liveCamp!.id,
        source: sample.source,
        type: `preflight_${sample.type}`,
        severity: sample.severity,
        title: `[preflight] ${sample.title}`,
        body: sample.body,
        proposed_action: sample.proposed_action,
        status: 'rejected',
        resolved_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();
    if (insErr) fail('confirm_persist', insErr.message);
    else {
      pass('confirm_persist', inserted?.id || 'ok');
      if (inserted?.id) {
        await sb.from('agent_recommendations').delete().eq('id', inserted.id);
        pass('confirm_persist_cleanup', 'deleted preflight row');
      }
    }

    // Confirm route must auth with user client then persist with service role
    // (guards against live RLS: "new row violates row-level security policy").
    const confirmSrc = require('fs').readFileSync(
      path.join(process.cwd(), 'src/app/api/ops/recommendations/[id]/confirm/route.ts'),
      'utf8'
    ) as string;
    if (
      confirmSrc.includes('createServiceClient') &&
      confirmSrc.includes('createClient') &&
      confirmSrc.includes('createServiceClient()')
    ) {
      pass('confirm_uses_service_role_after_auth', 'guards against missing INSERT RLS');
    } else {
      fail(
        'confirm_uses_service_role_after_auth',
        'confirm route must auth with user client then persist with service role'
      );
    }

    // Sales launch gate in source
    const launchSrc = require('fs').readFileSync(
      path.join(process.cwd(), 'src/app/api/campaigns/launch/route.ts'),
      'utf8'
    ) as string;
    if (launchSrc.includes("objective === 'OUTCOME_SALES'") && launchSrc.includes('pixel_required')) {
      pass('launch_blocks_sales_without_pixel', '422 pixel_required');
    } else {
      fail('launch_blocks_sales_without_pixel', 'launch route must refuse Sales without Pixel');
    }

    const metaSrc = require('fs').readFileSync(
      path.join(process.cwd(), 'src/lib/meta.ts'),
      'utf8'
    ) as string;
    if (
      metaSrc.includes("custom_event_type: 'PURCHASE'") &&
      metaSrc.includes('Sales campaigns require a Meta Pixel')
    ) {
      pass('adset_sales_requires_pixel_purchase', 'promoted_object PURCHASE');
    } else {
      fail('adset_sales_requires_pixel_purchase', 'createAdSet must require Pixel for Sales');
    }
  } else {
    fail('confirm_payload', 'no recommendations to validate');
  }

  // Optimize suite on live-shaped account
  const latest = snaps![snaps!.length - 1];
  const suite = runOptimizeSuite({
    brandName: 'Divyaprabha',
    websiteUrl: 'https://divyaprabhafoods.com',
    campaigns: [
      {
        id: liveCamp!.id,
        name: liveCamp!.name || 'Campaign',
        status: 'active',
        objective: liveCamp!.objective,
        budgetType: 'ABO',
        biddingStrategy: null,
        dailyBudget: Number(liveCamp!.budget || 500),
        spend: Number(latest.spend || 0),
        impressions: Number(latest.impressions || 0),
        clicks: Number(latest.clicks || 0),
        cpc: Number(latest.cpc || 0),
        cpm: Number(latest.cpm || 0),
        ctr: Number(latest.ctr || 0),
        cpa: null,
        roas: null,
        frequency: Number(latest.frequency || 0),
        purchases: Number(latest.purchases || 0),
        addToCart: Number(latest.add_to_cart || 0),
        initiateCheckout: Number(latest.initiate_checkout || 0),
        conversionRate: null,
        revenue: Number(latest.revenue || 0),
        reach: Number(latest.reach || 0),
        attributionWindow: '7d_click_1d_view',
        hasExclusions: false,
        hasLookalike: false,
      },
    ],
    creatives: [],
    tracking: {
      pixelConnected: true,
      pixelId: accounts![0].pixel_id,
      capiEnabled: false,
      emqScore: null,
      dedupRate: null,
      domainVerified: false,
      eventsSeen: ['ViewContent'],
      purchaseEvents7d: 0,
    },
    targets: {
      cpaTarget: 100,
      roasTarget: 2.5,
      dailyBudgetCap: null,
      aov: 499,
      marginPct: 40,
      ltv: null,
    },
  });
  const dry = dryRunOptimizeAccount();
  const drySuite = runOptimizeSuite(dry);
  if (suite.health.score === drySuite.health.score && suite.health.grade === 'B' && drySuite.health.grade === 'B') {
    // coincidence possible; check brand of dry fixtures differently
  }
  if (suite.health.score === 75 && suite.health.grade === 'B' && Number(latest.spend || 0) > 0) {
    fail('optimize_not_sample', 'health 75 B looks like dry-run fixture while live spend exists');
  } else {
    pass('optimize_live_suite', `health ${suite.health.score} ${suite.health.grade}`);
  }

  // analyzePerformanceV2 pacing unit check
  const fake = analyzePerformanceV2(
    [
      {
        ...metrics[0],
        spend: 5000,
        spendToday: 100,
        budget: 500,
        daysCovered: 10,
        status: 'active',
      },
    ],
    { cpaTarget: 100, roasTarget: 2, dailyBudgetCap: null }
  );
  if (fake.some((r) => r.type === 'pacing_over')) {
    fail('ops_v2_pacing_unit', 'should not over-pace when spendToday 100 / budget 500');
  } else {
    pass('ops_v2_pacing_unit', 'uses spendToday');
  }

  console.log(`\n=== RESULT: ${fails.length ? 'BLOCKED' : 'GREEN'} (${fails.length} fails) ===`);
  if (fails.length) {
    console.log(fails.map((f) => ` - ${f}`).join('\n'));
    process.exit(1);
  }
  console.log('Safe to push / redeploy Hostinger.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
