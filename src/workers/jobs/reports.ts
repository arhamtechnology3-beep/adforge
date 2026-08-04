import { createClient } from '@supabase/supabase-js';
import {
  sendEmail,
  formatDailyDigestEmail,
  formatWeeklyDigestEmail,
} from '@/lib/email';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function sendScheduledReports(frequency: 'daily' | 'weekly') {
  const supabase = getServiceClient();

  const { data: users } = await supabase
    .from('users')
    .select('*')
    .eq('email_reports_opt_in', true)
    .not('email', 'is', null);

  if (!users?.length) {
    console.log('[Reports] No users with email_reports_opt_in');
    return;
  }

  for (const user of users) {
    if (frequency === 'weekly' && user.report_frequency === 'daily') {
      // still allow weekly job only for weekly preference users
    }
    if (frequency === 'weekly' && user.report_frequency && user.report_frequency !== 'weekly') {
      continue;
    }

    const { data: campaigns } = await supabase
      .from('meta_campaigns')
      .select('*, performance_snapshots(*)')
      .eq('user_id', user.id)
      .in('status', ['active', 'paused']);

    let spend = 0;
    let revenue = 0;
    let purchases = 0;
    let cpaSum = 0;
    let cpaN = 0;
    const problems: string[] = [];

    for (const c of campaigns || []) {
      const snaps = (c.performance_snapshots || []).sort(
        (a: { date: string }, b: { date: string }) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const window = frequency === 'weekly' ? snaps.slice(0, 7) : snaps.slice(0, 1);
      for (const s of window) {
        spend += Number(s.spend || 0);
        revenue += Number(s.revenue || 0);
        purchases += Number(s.purchases || 0);
        if (s.cpa != null) {
          cpaSum += Number(s.cpa);
          cpaN++;
        }
      }
      const latest = snaps[0];
      if (latest && latest.ctr != null && Number(latest.ctr) < 0.6) {
        problems.push(`Low CTR on ${c.name || c.objective || 'campaign'}`);
      }
      if (latest && latest.roas != null && Number(latest.roas) < 1) {
        problems.push(`ROAS < 1x on ${c.name || c.objective || 'campaign'}`);
      }
    }

    const { count: pendingConfirms } = await supabase
      .from('agent_recommendations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending');

    const since = new Date();
    since.setDate(since.getDate() - (frequency === 'weekly' ? 7 : 1));
    const { count: policyActions } = await supabase
      .from('agent_recommendations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('source', 'policy')
      .eq('status', 'applied')
      .gte('created_at', since.toISOString());

    const roas = spend > 0 && revenue > 0 ? revenue / spend : null;
    const cpa = cpaN ? cpaSum / cpaN : null;

    const mail =
      frequency === 'weekly'
        ? formatWeeklyDigestEmail({
            name: user.name,
            spend,
            roas,
            topWins: (campaigns || [])
              .slice(0, 3)
              .map((c) => c.name || c.objective || 'Campaign'),
            topIssues: problems,
          })
        : formatDailyDigestEmail({
            name: user.name,
            spend,
            roas,
            cpa,
            purchases,
            pendingConfirms: pendingConfirms || 0,
            policyActions: policyActions || 0,
            problems,
          });

    await sendEmail({ to: user.email!, ...mail });

    await supabase.from('report_logs').insert({
      user_id: user.id,
      channel: 'email',
      report_type: `${frequency}_performance`,
    });
  }
}
