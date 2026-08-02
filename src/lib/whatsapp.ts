/**
 * WhatsApp Business API helper — stub implementation.
 * Replace with your provider (Interakt, Wati, Gupshup, etc.)
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.WHATSAPP_API_KEY;

  if (!apiKey) {
    console.log(`[WhatsApp STUB] To: ${phone}\nMessage: ${message.slice(0, 200)}...`);
    return { success: true, messageId: `stub_${Date.now()}` };
  }

  try {
    const res = await fetch('https://api.interakt.ai/v1/public/message/', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        countryCode: '+91',
        phoneNumber: phone.replace(/^\+91/, ''),
        type: 'Text',
        data: { messageBody: message },
      }),
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

export function formatPerformanceReport(
  campaigns: Array<{
    name: string;
    spend: number;
    cpc: number;
    cpa: number;
    ctr: number;
    status: string;
  }>
): string {
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  let msg = `📊 *Meta Ads Performance Report*\n\n`;
  msg += `Total Spend: ₹${totalSpend.toFixed(0)}\n`;
  msg += `Active Campaigns: ${campaigns.filter((c) => c.status === 'active').length}\n\n`;

  for (const c of campaigns.slice(0, 5)) {
    msg += `• ${c.name}\n`;
    msg += `  Spend: ₹${c.spend.toFixed(0)} | CPC: ₹${c.cpc.toFixed(1)} | CTR: ${c.ctr.toFixed(2)}%\n`;
  }

  msg += `\nView full dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/performance`;
  return msg;
}
