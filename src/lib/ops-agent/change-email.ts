/**
 * Ops Agent change emails — HTML detail + PNG “screenshot” card (via sharp).
 */

import sharp from 'sharp';
import { sendEmail } from '@/lib/email';

export type AgentChangeEmailInput = {
  to: string;
  userName?: string | null;
  title: string;
  detail: string;
  action: string;
  campaignName?: string | null;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  severity?: string;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Generate a branded PNG card summarizing the Ops Agent change (email “screenshot”). */
export async function renderAgentChangeScreenshot(
  input: AgentChangeEmailInput
): Promise<Buffer> {
  const when = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const before = JSON.stringify(input.before || {}, null, 0).slice(0, 120);
  const after = JSON.stringify(input.after || {}, null, 0).slice(0, 120);
  const title = escapeXml(input.title.slice(0, 80));
  const campaign = escapeXml((input.campaignName || 'Campaign').slice(0, 60));
  const action = escapeXml(input.action);
  const severity = escapeXml((input.severity || 'info').toUpperCase());

  const detailLines =
    input.detail
      .slice(0, 240)
      .match(/.{1,72}(\s|$)/g)
      ?.slice(0, 3)
      .map((line, i) => {
        const y = 210 + i * 22;
        return `<text x="48" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#475569">${escapeXml(line.trim())}</text>`;
      })
      .join('\n') || '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="720" height="420" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B1F33"/>
      <stop offset="100%" stop-color="#123A5C"/>
    </linearGradient>
  </defs>
  <rect width="720" height="420" fill="url(#bg)"/>
  <rect x="24" y="24" width="672" height="372" rx="16" fill="#FFFFFF"/>
  <text x="48" y="70" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#1877F2">AdForge Ops Agent</text>
  <text x="48" y="100" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#64748B">${escapeXml(when)} IST · ${severity}</text>
  <text x="48" y="145" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#0F172A">${title}</text>
  <text x="48" y="178" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#334155">${campaign}</text>
  ${detailLines}
  <text x="48" y="300" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#94A3B8">Action: ${action}</text>
  <text x="48" y="330" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#64748B">Before: ${escapeXml(before)}</text>
  <text x="48" y="358" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#0F766E">After: ${escapeXml(after)}</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export function formatAgentChangeEmail(input: AgentChangeEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://adforge.arhamtechnology.com';
  const greeting = input.userName ? `Hi ${input.userName}` : 'Hi';
  const beforeLines = Object.entries(input.before || {})
    .map(([k, v]) => `  • ${k}: ${String(v)}`)
    .join('\n');
  const afterLines = Object.entries(input.after || {})
    .map(([k, v]) => `  • ${k}: ${String(v)}`)
    .join('\n');

  const text = [
    `${greeting},`,
    '',
    'AdForge Ops Agent made a change on your live Meta campaign:',
    '',
    `Title: ${input.title}`,
    `Campaign: ${input.campaignName || '—'}`,
    `Action: ${input.action}`,
    '',
    input.detail,
    '',
    'Before:',
    beforeLines || '  —',
    '',
    'After:',
    afterLines || '  —',
    '',
    `Open Ops Agent: ${appUrl}/ops`,
    `Performance: ${appUrl}/performance`,
    '',
    'A screenshot card of this change is attached.',
    '',
    '— AdForge Ops Agent',
  ].join('\n');

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
    <p>${greeting},</p>
    <p><strong>AdForge Ops Agent</strong> updated your live Meta campaign.</p>
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;background:#f8fafc">
      <p style="margin:0 0 8px;font-size:12px;color:#64748b;text-transform:uppercase">${(input.severity || 'info').toUpperCase()} · ${input.action}</p>
      <h2 style="margin:0 0 8px;font-size:18px">${input.title}</h2>
      <p style="margin:0 0 8px;color:#475569">${input.campaignName || ''}</p>
      <p style="margin:0;line-height:1.5">${input.detail}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:12px 0">
      <tr>
        <td style="width:50%;vertical-align:top;padding:8px;background:#fff7ed;border-radius:8px">
          <strong>Before</strong>
          <pre style="font-size:12px;white-space:pre-wrap">${JSON.stringify(input.before || {}, null, 2)}</pre>
        </td>
        <td style="width:12px"></td>
        <td style="width:50%;vertical-align:top;padding:8px;background:#ecfdf5;border-radius:8px">
          <strong>After</strong>
          <pre style="font-size:12px;white-space:pre-wrap">${JSON.stringify(input.after || {}, null, 2)}</pre>
        </td>
      </tr>
    </table>
    <p>A screenshot of this change is attached to this email.</p>
    <p>
      <a href="${appUrl}/ops" style="color:#1877F2">Open Ops Agent</a> ·
      <a href="${appUrl}/performance" style="color:#1877F2">Performance</a>
    </p>
    <p style="color:#94a3b8;font-size:12px">— AdForge Ops Agent</p>
  </div>`;

  return {
    subject: `Ops Agent · ${input.title}`.slice(0, 120),
    text,
    html,
  };
}

export async function notifyAgentChange(
  input: AgentChangeEmailInput
): Promise<{ success: boolean; error?: string }> {
  if (!input.to) return { success: false, error: 'No email' };
  try {
    const mail = formatAgentChangeEmail(input);
    let png: Buffer | null = null;
    try {
      png = await renderAgentChangeScreenshot(input);
    } catch (err) {
      console.warn('[AgentChangeEmail] screenshot failed', err);
    }
    return sendEmail({
      to: input.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: png
        ? [
            {
              filename: `ops-change-${Date.now()}.png`,
              content: png.toString('base64'),
              contentType: 'image/png',
            },
          ]
        : undefined,
    });
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
