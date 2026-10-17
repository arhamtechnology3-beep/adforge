import { createClient } from '@supabase/supabase-js';
import {
  retrieveToken,
  getCampaignInsightsRows,
  parseInsightsPayload,
  getCampaignInsightBreakdowns,
  pauseCampaign,
  getCampaignAds,
  getAdEffectiveStatus,
  pauseAd,
} from '@/lib/meta';
import { insightsTimeRange } from '@/lib/sync-meta-performance';
import { runOpsAnalysis } from '@/lib/ops-agent';
import { notifyAgentChange } from '@/lib/ops-agent/change-email';
import { sendEmail, formatPolicyAlertEmail } from '@/lib/email';
import type { InsightBreakdowns, MetaCampaign } from '@/types/database';
import type { AgentSlot } from '@/types/database';
import type { CampaignMetrics } from '@/lib/ops-agent';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function buildBreakdowns(
  token: string,
  metaCampaignId: string
): Promise<InsightBreakdowns> {
  const mapRows = (
    rows: Array<Record<string, unknown>>,
    key: string
  ): Array<{ name: string; spend: number; impressions?: number; ctr?: number }> =>
    rows.map((r) => ({
      name: String(r[key] || 'Unknown'),
      spend: parseFloat(String(r.spend || '0')),
      impressions: parseInt(String(r.impressions || '0'), 10),
      ctr: parseFloat(String(r.ctr || '0')),
    }));

  try {
    const [placement, age, gender, device, geo] = await Promise.all([
      getCampaignInsightBreakdowns(token, metaCampaignId, 'publisher_platform'),
      getCampaignInsightBreakdowns(token, metaCampaignId, 'age'),
      getCampaignInsightBreakdowns(token, metaCampaignId, 'gender'),
      getCampaignInsightBreakdowns(token, metaCampaignId, 'impression_device'),
      getCampaignInsightBreakdowns(token, metaCampaignId, 'country'),
    ]);
    return {
      placement: mapRows(placement, 'publisher_platform'),
      age: mapRows(age, 'age').map((r) => ({ name: r.name, spend: r.spend })),
      gender: mapRows(gender, 'gender').map((r) => ({ name: r.name, spend: r.spend })),
      device: mapRows(device, 'impression_device'),
      geo: mapRows(geo, 'country').map((r) => ({ name: r.name, spend: r.spend })),
    };
  } catch {
    return {};
  }
}

function mapMetaCampaignStatus(
  effective?: string,
  configured?: string
): 'active' | 'paused' | null {
  const eff = (effective || configured || '').toUpperCase();
  if (eff === 'ACTIVE') return 'active';
  if (
    eff === 'PAUSED' ||
    eff === 'CAMPAIGN_PAUSED' ||
    eff === 'ADSET_PAUSED' ||
    eff === 'ARCHIVED' ||
    eff === 'DELETED'
  ) {
    return 'paused';
  }
  return null;
}

async function fetchMetaCampaignStatus(token: string, metaCampaignId: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${metaCampaignId}?fields=id,name,status,effective_status&access_token=${token}`
  );
  if (!res.ok) return null;
  return (await res.json()) as {
    id: string;
    name?: string;
    status?: string;
    effective_status?: string;
  };
}

export async function runOpsMonitorSlot(slot: AgentSlot = 'morning') {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split('T')[0];

  // Include drafts that already have a Meta campaign id — status is re-synced from Meta below.
  const { data: campaigns } = await supabase
    .from('meta_campaigns')
    .select('*')
    .or('status.in.(active,paused),meta_campaign_id.not.is.null');

  const byUser = new Map<string, MetaCampaign[]>();
  for (const c of (campaigns || []) as MetaCampaign[]) {
    const list = byUser.get(c.user_id) || [];
    list.push(c);
    byUser.set(c.user_id, list);
  }

  // If no campaigns, still record a global dry-run agent run for demos
  if (!byUser.size) {
    const analysis = runOpsAnalysis({ useDryRun: true });
    await supabase.from('agent_runs').insert({
      user_id: null,
      slot,
      status: 'completed',
      summary: {
        dry_run: true,
        recommendations: analysis.recommendations.length,
        note: 'No active campaigns — dry-run analysis only',
      },
    });
    return { users: 0, dryRun: true };
  }

  for (const [userId, userCampaigns] of Array.from(byUser.entries())) {
    const { data: profile } = await supabase.from('users').select('*').eq('id', userId).single();
    const { data: adAccount } = await supabase
      .from('ad_accounts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const metrics: CampaignMetrics[] = [];
    const priorDaysCpa: Record<string, number[]> = {};
    const metaStatuses: Array<{ adId: string; effective_status?: string }> = [];
    let hasLiveMeta = false;

    for (const campaign of userCampaigns || []) {
      let parsed = null;
      let breakdowns: InsightBreakdowns = {};

      if (adAccount?.access_token_encrypted && campaign.meta_campaign_id) {
        try {
          const token = retrieveToken(adAccount.access_token_encrypted);

          // Keep AdForge status aligned with Meta (e.g. draft completed outside Confirm).
          const metaCamp = await fetchMetaCampaignStatus(token, campaign.meta_campaign_id);
          const mapped = mapMetaCampaignStatus(
            metaCamp?.effective_status,
            metaCamp?.status
          );
          if (mapped && mapped !== campaign.status) {
            const launchConfig = {
              ...((campaign.launch_config || {}) as Record<string, unknown>),
              meta_live: mapped === 'active',
              meta_status_synced_at: new Date().toISOString(),
              meta_effective_status: metaCamp?.effective_status || metaCamp?.status,
            };
            await supabase
              .from('meta_campaigns')
              .update({ status: mapped, launch_config: launchConfig })
              .eq('id', campaign.id);
            campaign.status = mapped;
            campaign.launch_config = launchConfig;
          }

          // Re-sync last 7 days so late Website Purchases land; Ops uses 7d rollup.
          const range7 = insightsTimeRange(7);
          const rawRows = await getCampaignInsightsRows(token, campaign.meta_campaign_id, {
            timeRange: range7,
            timeIncrement: 1,
          });
          breakdowns = await buildBreakdowns(token, campaign.meta_campaign_id);
          hasLiveMeta = true;

          let rollSpend = 0;
          let rollImps = 0;
          let rollClicks = 0;
          let rollPurchases = 0;
          let rollRevenue = 0;
          let rollAtc = 0;
          let rollIc = 0;
          let rollReach = 0;
          let rollVideo = 0;
          let lastParsed: ReturnType<typeof parseInsightsPayload> = null;

          for (const raw of rawRows) {
            const day = parseInsightsPayload(raw);
            if (!day) continue;
            const snapDate = String(day.raw.date_start || '');
            if (!snapDate) continue;
            await supabase.from('performance_snapshots').upsert(
              {
                meta_campaign_id: campaign.id,
                date: snapDate,
                cpc: day.cpc,
                cpa: day.cost_per_purchase,
                ctr: day.ctr,
                spend: day.spend,
                impressions: day.impressions,
                reach: day.reach,
                clicks: day.clicks,
                cpm: day.cpm,
                frequency: day.frequency,
                purchases: day.purchases,
                add_to_cart: day.add_to_cart,
                initiate_checkout: day.initiate_checkout,
                cost_per_purchase: day.cost_per_purchase,
                roas: day.roas,
                conversion_rate: day.conversion_rate,
                video_views: day.video_views,
                engagement_rate: day.engagement_rate,
                revenue: day.revenue,
                raw_insights: day.raw,
                breakdowns: snapDate === today ? breakdowns : {},
              },
              { onConflict: 'meta_campaign_id,date' }
            );
            rollSpend += day.spend;
            rollImps += day.impressions;
            rollClicks += day.clicks;
            rollPurchases += day.purchases;
            rollRevenue += day.revenue;
            rollAtc += day.add_to_cart;
            rollIc += day.initiate_checkout;
            rollReach += day.reach;
            rollVideo += day.video_views;
            if (!lastParsed || snapDate >= String(lastParsed.raw.date_start || '')) {
              lastParsed = day;
            }
          }

          parsed = lastParsed
            ? {
                ...lastParsed,
                spend: rollSpend,
                impressions: rollImps,
                clicks: rollClicks,
                purchases: rollPurchases,
                revenue: rollRevenue,
                add_to_cart: rollAtc,
                initiate_checkout: rollIc,
                reach: rollReach,
                video_views: rollVideo,
                cost_per_purchase: rollPurchases > 0 ? rollSpend / rollPurchases : null,
                roas: rollSpend > 0 && rollRevenue > 0 ? rollRevenue / rollSpend : null,
                ctr: rollImps > 0 ? (rollClicks / rollImps) * 100 : 0,
                conversion_rate: rollClicks > 0 ? (rollPurchases / rollClicks) * 100 : null,
              }
            : null;

          const ads = await getCampaignAds(token, campaign.meta_campaign_id);
          for (const ad of ads.slice(0, 20)) {
            try {
              const st = await getAdEffectiveStatus(token, ad.id);
              metaStatuses.push({ adId: ad.id, effective_status: st.effective_status });
            } catch {
              /* skip */
            }
          }
        } catch (err) {
          console.error(`[OpsMonitor] insights ${campaign.id}`, err);
        }
      }

      if (parsed) {
        metrics.push({
          campaignId: campaign.id,
          campaignName: campaign.name || campaign.objective || 'Campaign',
          status: campaign.status,
          budget: campaign.budget,
          spend: parsed.spend,
          impressions: parsed.impressions,
          clicks: parsed.clicks,
          cpc: parsed.cpc,
          cpm: parsed.cpm,
          ctr: parsed.ctr,
          cpa: parsed.cost_per_purchase,
          roas: parsed.roas,
          frequency: parsed.frequency,
          purchases: parsed.purchases,
          add_to_cart: parsed.add_to_cart,
          initiate_checkout: parsed.initiate_checkout,
          conversion_rate: parsed.conversion_rate,
          video_views: parsed.video_views,
          engagement_rate: parsed.engagement_rate,
          revenue: parsed.revenue,
          reach: parsed.reach,
        });
      }

      const { data: snaps } = await supabase
        .from('performance_snapshots')
        .select('cpa')
        .eq('meta_campaign_id', campaign.id)
        .order('date', { ascending: false })
        .limit(3);
      if (snaps?.length) {
        priorDaysCpa[campaign.id] = snaps
          .map((s) => (s.cpa != null ? Number(s.cpa) : null))
          .filter((v): v is number => v != null);
      }
    }

    // Load approved creatives for policy text scan
    const adIds = (userCampaigns || []).flatMap((c) => c.ad_ids || []);
    let creatives: Parameters<typeof runOpsAnalysis>[0]['creatives'] = [];
    if (adIds.length) {
      const { data: ads } = await supabase
        .from('generated_ads')
        .select('id, headline, copy_text, ad_format, angle')
        .in('id', adIds);
      creatives = (ads || []).map((a) => ({
        id: a.id,
        name: a.headline || a.angle || a.id,
        format: a.ad_format || 'single_image',
        spend: 0,
        ctr: 0,
        cpc: 0,
        cpa: null,
        frequency: 0,
        copy_text: a.copy_text || undefined,
        headline: a.headline || undefined,
      }));
    }

    const analysis = runOpsAnalysis({
      metrics: metrics.length ? metrics : undefined,
      creatives,
      targets: {
        cpaTarget: profile?.cpa_target ?? 100,
        roasTarget: profile?.roas_target ?? 2,
        dailyBudgetCap: profile?.daily_budget_cap ?? null,
      },
      priorDaysCpa,
      metaStatuses,
      useDryRun: !metrics.length,
    });

    let applied = 0;
    let pending = 0;

    for (const rec of analysis.recommendations) {
      if (rec.auto_apply) {
        try {
          if (
            rec.proposed_action.action === 'pause_campaign' &&
            adAccount?.access_token_encrypted
          ) {
            const camp = (userCampaigns || []).find((c) => c.id === rec.meta_campaign_id);
            if (camp?.meta_campaign_id) {
              const token = retrieveToken(adAccount.access_token_encrypted);
              await pauseCampaign(token, camp.meta_campaign_id);
            }
            if (rec.meta_campaign_id) {
              await supabase
                .from('meta_campaigns')
                .update({ status: 'paused' })
                .eq('id', rec.meta_campaign_id);
            }
          }
          if (
            rec.proposed_action.action === 'pause_ad' &&
            adAccount?.access_token_encrypted &&
            typeof rec.proposed_action.adId === 'string' &&
            !String(rec.proposed_action.adId).startsWith('cr-')
          ) {
            const token = retrieveToken(adAccount.access_token_encrypted);
            await pauseAd(token, String(rec.proposed_action.adId));
          }
        } catch (err) {
          console.error('[OpsMonitor] auto-apply failed', err);
        }

        await supabase.from('agent_recommendations').insert({
          user_id: userId,
          meta_campaign_id: rec.meta_campaign_id || null,
          source: rec.source,
          type: rec.type,
          severity: rec.severity,
          title: rec.title,
          body: rec.body,
          proposed_action: rec.proposed_action,
          status: 'applied',
          resolved_at: new Date().toISOString(),
        });

        await supabase.from('meta_policy_scans').insert({
          user_id: userId,
          meta_campaign_id: rec.meta_campaign_id || null,
          matched: true,
          action_taken: 'auto_pause',
          details: { title: rec.title, type: rec.type },
        });

        const campName =
          (userCampaigns || []).find((c) => c.id === rec.meta_campaign_id)?.name ||
          rec.title;

        let emailSent = false;
        const shouldEmail =
          !!profile?.email &&
          profile.email_reports_opt_in !== false &&
          (rec.severity === 'critical' ||
            rec.severity === 'high' ||
            rec.proposed_action.action === 'pause_campaign' ||
            rec.proposed_action.action === 'pause_ad');

        if (shouldEmail && profile?.email) {
          const mailed = await notifyAgentChange({
            to: profile.email,
            userName: profile.name,
            title: rec.title,
            detail: rec.body,
            action: String(rec.proposed_action.action || rec.type),
            campaignName: campName,
            before: { status: 'active' },
            after: {
              status:
                rec.proposed_action.action === 'pause_campaign' ? 'paused' : 'updated',
              ...rec.proposed_action,
            },
            severity: rec.severity,
          });
          emailSent = !!mailed.success;
          if (!mailed.success && rec.source === 'policy') {
            const mail = formatPolicyAlertEmail({
              title: rec.title,
              body: rec.body,
              severity: rec.severity,
            });
            await sendEmail({ to: profile.email, ...mail });
            emailSent = true;
          }
        }

        await supabase.from('agent_change_logs').insert({
          user_id: userId,
          meta_campaign_id: rec.meta_campaign_id || null,
          action: String(rec.proposed_action.action || rec.type),
          title: rec.title,
          detail: rec.body,
          before_state: { status: 'active' },
          after_state: {
            status: rec.proposed_action.action === 'pause_campaign' ? 'paused' : 'updated',
            action: rec.proposed_action,
          },
          email_sent: emailSent,
          email_to: profile?.email || null,
        });
        applied++;
      } else {
        await supabase.from('agent_recommendations').insert({
          user_id: userId,
          meta_campaign_id: rec.meta_campaign_id || null,
          source: rec.source,
          type: rec.type,
          severity: rec.severity,
          title: rec.title,
          body: rec.body,
          proposed_action: rec.proposed_action,
          status: 'pending',
        });
        pending++;
      }
    }

    await supabase.from('agent_runs').insert({
      user_id: userId,
      slot,
      status: 'completed',
      summary: {
        live_meta: hasLiveMeta,
        dry_run: analysis.dryRun,
        campaigns: metrics.length,
        applied,
        pending,
      },
    });
  }

  return { users: byUser.size, dryRun: false };
}

/** Back-compat wrapper used by old performance queue */
export async function syncAllCampaignPerformance() {
  return runOpsMonitorSlot('morning');
}
