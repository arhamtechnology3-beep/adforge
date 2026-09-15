'use client';

import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react';

type Props = {
  metaConnected: boolean;
  pageId?: string | null;
  pageName?: string | null;
  pixelId?: string | null;
  pixelName?: string | null;
  websiteUrl?: string;
  userId?: string | null;
  objective?: string;
};

function Row({
  ok,
  warn,
  label,
  detail,
}: {
  ok: boolean;
  warn?: boolean;
  label: string;
  detail: string;
}) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : Circle;
  const color = ok ? 'text-green-700' : warn ? 'text-amber-700' : 'text-red-700';
  return (
    <li className={`flex gap-2 text-sm ${color}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-[var(--muted)] font-normal mt-0.5">{detail}</span>
      </span>
    </li>
  );
}

/**
 * Per-subscriber readiness: Page + website Pixel + ATC/Purchase events + Shopify CAPI.
 */
export function TrackingReadinessChecklist({
  metaConnected,
  pageId,
  pageName,
  pixelId,
  pixelName,
  websiteUrl,
  userId,
  objective = 'OUTCOME_SALES',
}: Props) {
  const pageOk = !!(pageId && pageId !== 'me');
  const pixelOk = !!pixelId;
  const sales = objective === 'OUTCOME_SALES';
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-adforge-domain.com';
  const capiUrl = userId
    ? `${origin}/api/webhooks/shopify/capi?user_id=${userId}`
    : `${origin}/api/webhooks/shopify/capi?user_id=<YOUR_USER_ID>`;

  const ready = metaConnected && pageOk && pixelOk;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">Store tracking readiness</h3>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Every subscriber needs Meta ads → store → AddToCart → Purchase. Sales launches require
          Pixel.
        </p>
      </div>
      <ul className="space-y-2.5">
        <Row
          ok={metaConnected}
          label="Meta ad account connected"
          detail={metaConnected ? 'OAuth token ready' : 'Connect Facebook from Campaigns'}
        />
        <Row
          ok={pageOk}
          label="Facebook Page linked"
          detail={pageOk ? pageName || `Page ${pageId}` : 'Pick a Page in Meta assets'}
        />
        <Row
          ok={pixelOk}
          warn={!pixelOk && !sales}
          label="Website Meta Pixel"
          detail={
            pixelOk
              ? `${pixelName || pixelId} — Events Manager must fire PageView, ATC, Purchase`
              : 'Required for Sales/Purchase optimization'
          }
        />
        <Row
          ok={!!websiteUrl && /^https:\/\//i.test(websiteUrl)}
          label="Store URL"
          detail={websiteUrl || 'Set your Shopify/store https URL'}
        />
        <Row
          ok={false}
          warn
          label="Shopify CAPI (recommended)"
          detail={`Orders webhook → ${capiUrl}`}
        />
      </ul>
      {!ready && sales && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          Sales launch is blocked until Page + Pixel are linked.
        </p>
      )}
      {ready && (
        <p className="text-xs text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          Ready for Sales/Purchase campaigns. Confirm ATC + Purchase in Events Manager after first
          orders.
        </p>
      )}
    </div>
  );
}
