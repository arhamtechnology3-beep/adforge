'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, AlertTriangle, Copy, Check, Loader2 } from 'lucide-react';

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

type CapiVerifyStatus = 'not_verified' | 'test_ok' | 'live_ok' | 'error' | 'loading';

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
 * CAPI webhook must be created once by each store owner in Shopify Admin.
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
  const [copied, setCopied] = useState(false);
  const [capiStatus, setCapiStatus] = useState<CapiVerifyStatus>('loading');
  const [capiMessage, setCapiMessage] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const pageOk = !!(pageId && pageId !== 'me');
  const pixelOk = !!pixelId;
  const sales = objective === 'OUTCOME_SALES';
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://adforge.arhamtechnology.com';
  const capiUrl = userId
    ? `${origin}/api/webhooks/shopify/capi?user_id=${userId}`
    : `${origin}/api/webhooks/shopify/capi?user_id=<YOUR_USER_ID>`;

  const capiOk = capiStatus === 'test_ok' || capiStatus === 'live_ok';
  const ready = metaConnected && pageOk && pixelOk;

  const refreshCapiStatus = useCallback(async () => {
    if (!userId) {
      setCapiStatus('not_verified');
      setCapiMessage('Sign in to verify your webhook.');
      return;
    }
    try {
      const res = await fetch('/api/webhooks/shopify/capi/verify');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCapiStatus('error');
        setCapiMessage(data.error || 'Could not load CAPI status');
        return;
      }
      setCapiStatus((data.status as CapiVerifyStatus) || 'not_verified');
      setCapiMessage(data.message || '');
    } catch {
      setCapiStatus('error');
      setCapiMessage('Could not load CAPI status');
    }
  }, [userId]);

  useEffect(() => {
    void refreshCapiStatus();
  }, [refreshCapiStatus]);

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(capiUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function verifyWebhook() {
    setVerifying(true);
    try {
      const res = await fetch('/api/webhooks/shopify/capi/verify', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setCapiStatus('error');
        setCapiMessage(data.error || data.message || 'Verification failed');
      } else {
        setCapiStatus((data.status as CapiVerifyStatus) || 'test_ok');
        setCapiMessage(data.message || 'Test Purchase sent.');
      }
      await refreshCapiStatus();
    } catch {
      setCapiStatus('error');
      setCapiMessage('Verification request failed');
    } finally {
      setVerifying(false);
    }
  }

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
          ok={capiOk}
          warn={!capiOk}
          label="Shopify CAPI (recommended — you set once in Shopify)"
          detail={
            capiStatus === 'loading'
              ? 'Checking webhook status…'
              : capiMessage ||
                'AdForge receives orders automatically after you add this webhook in Shopify Admin.'
          }
        />
      </ul>

      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-2">
        <p className="text-xs font-semibold text-amber-950">
          How every subscriber sets up Shopify → Meta CAPI
        </p>
        <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-amber-950/90">
          <li>
            Open Shopify Admin → <strong>Settings → Notifications → Webhooks</strong>
          </li>
          <li>
            Click <strong>+ Create webhook</strong>
          </li>
          <li>
            Event: <strong>Order payment</strong> (or Order creation)
          </li>
          <li>
            Format: <strong>JSON</strong>
          </li>
          <li>Paste your personal webhook URL below (includes your AdForge user id)</li>
          <li>Save. After a paid order, AdForge sends Purchase to Meta CAPI automatically.</li>
        </ol>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <code className="flex-1 text-[10px] bg-white border border-amber-200 rounded-md px-2 py-1.5 break-all text-[var(--foreground)]">
            {capiUrl}
          </code>
          <button
            type="button"
            onClick={copyWebhook}
            className="btn-secondary text-xs inline-flex items-center justify-center gap-1.5 shrink-0"
            disabled={!userId}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy URL'}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center pt-1">
          <button
            type="button"
            onClick={() => void verifyWebhook()}
            disabled={!userId || !pixelOk || verifying}
            className="btn-primary text-xs inline-flex items-center justify-center gap-1.5"
          >
            {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {verifying ? 'Verifying…' : capiOk ? 'Re-verify webhook' : 'Verify webhook'}
          </button>
          {capiOk && (
            <span className="text-[11px] text-green-800 font-medium">
              {capiStatus === 'live_ok' ? 'Live order verified' : 'Test path verified'}
            </span>
          )}
        </div>
        {!userId && (
          <p className="text-[10px] text-amber-900">
            Sign in to see your personal webhook URL (user_id is unique per subscriber).
          </p>
        )}
        {!pixelOk && (
          <p className="text-[10px] text-amber-900">
            Link a website Pixel before Verify can send a test Purchase to Meta.
          </p>
        )}
      </div>

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
