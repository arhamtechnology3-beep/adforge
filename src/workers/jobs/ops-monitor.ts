import { createClient } from '@supabase/supabase-js';
import {
  retrieveToken,
  getCampaignInsights,
  parseInsightsPayload,
  getCampaignInsightBreakdowns,
  pauseCampaign,
  getCampaignAds,
  getAdEffectiveStatus,
  pauseAd,
} from '@/lib/meta';
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

export async function runOpsMonitorSlot(slot: AgentSlot = 'morning') {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: campaigns } = await supabase
    .from('meta_campaigns')
    .select('*')
    .in('status', ['active', 'paused']);

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
          const raw = await getCampaignInsights(token, campaign.meta_campaign_id, 'today');
          parsed = parseInsightsPayload(raw);
          breakdowns = await buildBreakdowns(token, campaign.meta_campaign_id);
          hasLiveMeta = true;

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
        await supabase.from('performance_snapshots').upsert(
          {
            meta_campaign_id: campaign.id,
            date: today,
            cpc: parsed.cpc,
            cpa: parsed.cost_per_purchase,
            ctr: parsed.ctr,
            spend: parsed.spend,
            impressions: parsed.impressions,
            reach: parsed.reach,
            clicks: parsed.clicks,
            cpm: parsed.cpm,
            frequency: parsed.frequency,
            purchases: parsed.purchases,
            add_to_cart: parsed.add_to_cart,
            initiate_checkout: parsed.initiate_checkout,
            cost_per_purchase: parsed.cost_per_purchase,
            roas: parsed.roas,
            conversion_rate: parsed.conversion_rate,
            video_views: parsed.video_views,
            engagement_rate: parsed.engagement_rate,
            revenue: parsed.revenue,
            raw_insights: parsed.raw,
            breakdowns,
          },
          { onConflict: 'meta_campaign_id,date' }
        );

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
