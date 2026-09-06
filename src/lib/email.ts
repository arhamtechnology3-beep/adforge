/**
 * Email delivery for digests and policy alerts.
 * Uses Resend when RESEND_API_KEY is set; otherwise logs a stub.
 */

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64
    contentType?: string;
  }>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'AdForge <reports@adforge.app>';

  if (!apiKey) {
    console.log(
      `[Email STUB] To: ${opts.to}\nSubject: ${opts.subject}\nAttachments: ${opts.attachments?.length || 0}\n${opts.text.slice(0, 400)}...`
    );
    return { success: true, messageId: `stub_${Date.now()}` };
  }

  try {
    const payload: Record<string, unknown> = {
      from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      html: opts.html || `<pre style="font-family:sans-serif">${opts.text}</pre>`,
    };
    if (opts.attachments?.length) {
      payload.attachments = opts.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        content_type: a.contentType || 'application/octet-stream',
      }));
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }

    const data = await res.json();
    return { success: true, messageId: data.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function formatDailyDigestEmail(data: {
  name?: string | null;
  spend: number;
  roas: number | null;
  cpa: number | null;
  purchases: number;
  pendingConfirms: number;
  policyActions: number;
  problems: string[];
}): { subject: string; text: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010';
  const greeting = data.name ? `Hi ${data.name}` : 'Hi';
  const lines = [
    `${greeting},`,
    '',
    'Your AdForge daily Meta ads digest:',
    '',
    `• Spend: ₹${data.spend.toFixed(0)}`,
    `• ROAS: ${data.roas != null ? data.roas.toFixed(2) + 'x' : '—'}`,
    `• CPA: ${data.cpa != null ? '₹' + data.cpa.toFixed(0) : '—'}`,
    `• Purchases: ${data.purchases}`,
    `• Pending Confirms: ${data.pendingConfirms}`,
    `• Policy actions today: ${data.policyActions}`,
    '',
  ];

  if (data.problems.length) {
    lines.push('Watchlist:');
    for (const p of data.problems.slice(0, 5)) lines.push(`  – ${p}`);
    lines.push('');
  }

  lines.push(`Reports Hub: ${appUrl}/reports?view=daily`);
  lines.push(`Ops Agent: ${appUrl}/ops`);
  lines.push('');
  lines.push('— AdForge');

  return {
    subject: `AdForge daily digest · ₹${data.spend.toFixed(0)} spend`,
    text: lines.join('\n'),
  };
}

export function formatPolicyAlertEmail(data: {
  title: string;
  body: string;
  severity: string;
}): { subject: string; text: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010';
  return {
    subject: `[${data.severity.toUpperCase()}] Meta policy · ${data.title}`,
    text: [
      data.body,
      '',
      `Open Ops Agent: ${appUrl}/ops?tab=policy`,
      `Policy audit report: ${appUrl}/reports?view=policy_actions`,
      '',
      '— AdForge Policy Guard',
    ].join('\n'),
  };
}

export function formatWeeklyDigestEmail(data: {
  name?: string | null;
  spend: number;
  roas: number | null;
  topWins: string[];
  topIssues: string[];
}): { subject: string; text: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010';
  const lines = [
    data.name ? `Hi ${data.name},` : 'Hi,',
    '',
    'Weekly Meta ads summary from AdForge:',
    '',
    `• Weekly spend: ₹${data.spend.toFixed(0)}`,
    `• Blended ROAS: ${data.roas != null ? data.roas.toFixed(2) + 'x' : '—'}`,
    '',
    'Wins:',
    ...(data.topWins.length ? data.topWins.map((w) => `  ✓ ${w}`) : ['  —']),
    '',
    'Issues:',
    ...(data.topIssues.length ? data.topIssues.map((i) => `  ! ${i}`) : ['  —']),
    '',
    `Full weekly report: ${appUrl}/reports?view=weekly`,
    '',
    '— AdForge',
  ];
  return {
    subject: `AdForge weekly summary · ₹${data.spend.toFixed(0)}`,
    text: lines.join('\n'),
  };
}
