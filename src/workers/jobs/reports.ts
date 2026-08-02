import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage, formatPerformanceReport } from '@/lib/whatsapp';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function sendScheduledReports(frequency: string) {
  const supabase = getServiceClient();

  const { data: users } = await supabase
    .from('users')
    .select('*')
    .eq('whatsapp_opt_in', true)
    .not('phone', 'is', null);

  if (!users?.length) return;

  for (const user of users) {
    if (user.report_frequency !== frequency && frequency !== 'daily') continue;

    const { data: campaigns } = await supabase
      .from('meta_campaigns')
      .select('*, performance_snapshots(*)')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (!campaigns?.length) continue;

    const reportData = campaigns.map((c) => {
      const latest = c.performance_snapshots?.sort(
        (a: { date: string }, b: { date: string }) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      return {
        name: c.objective || 'Campaign',
        spend: latest?.spend || 0,
        cpc: latest?.cpc || 0,
        cpa: latest?.cpa || 0,
        ctr: latest?.ctr || 0,
        status: c.status,
      };
    });

    const message = formatPerformanceReport(reportData);
    const channel = user.whatsapp_opt_in ? 'whatsapp' : 'email';

    if (channel === 'whatsapp' && user.phone) {
      await sendWhatsAppMessage(user.phone, message);
    }

    await supabase.from('report_logs').insert({
      user_id: user.id,
      channel,
      report_type: `${frequency}_performance`,
    });
  }
}
