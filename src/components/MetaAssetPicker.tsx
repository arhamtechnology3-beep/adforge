'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Check, RefreshCw, AlertTriangle } from 'lucide-react';

type AssetOption = { id: string; name: string; kind?: string };
type AdAccountOption = {
  id: string;
  name: string;
  account_status?: number | null;
  timezone_name?: string | null;
  blocked?: boolean;
};

/** True when Page vs Pixel names look like different brands (e.g. Arham vs Divyaprabha). */
export function pagePixelLikelyMismatch(
  pageName?: string | null,
  pixelName?: string | null
): boolean {
  if (!pageName?.trim() || !pixelName?.trim()) return false;
  const stop = new Set([
    'the',
    'and',
    'for',
    'ads',
    'page',
    'pixel',
    'inc',
    'ltd',
    'pvt',
    'co',
    'meta',
    'facebook',
    'instagram',
  ]);
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter((w) => w.length > 2 && !stop.has(w))
    );
  const a = tokens(pageName);
  const b = tokens(pixelName);
  if (!a.size || !b.size) return false;
  for (const t of a) {
    if (b.has(t)) return false;
  }
  return true;
}

/**
 * Per-client Ad Account + Page + Pixel picker (multi-tenant SaaS).
 */
export default function MetaAssetPicker({
  enabled,
  onSaved,
}: {
  enabled: boolean;
  onSaved?: (sel: {
    page_id: string | null;
    page_name: string | null;
    pixel_id: string | null;
    pixel_name: string | null;
    meta_ad_account_id?: string | null;
    meta_ad_account_name?: string | null;
  }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [pages, setPages] = useState<AssetOption[]>([]);
  const [pixels, setPixels] = useState<AssetOption[]>([]);
  const [otherPixels, setOtherPixels] = useState<AssetOption[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccountOption[]>([]);
  const [pageId, setPageId] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [manualPixelId, setManualPixelId] = useState('');
  const [useManualPixel, setUseManualPixel] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [adAccountId, setAdAccountId] = useState<string | null>(null);
  const [adAccountName, setAdAccountName] = useState<string | null>(null);
  const [suggestedPageId, setSuggestedPageId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/meta/assets')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to load assets');
        if (cancelled) return;
        setPages(data.pages || []);
        setPixels(data.pixels || []);
        setOtherPixels(data.skipped_pixels || []);
        setAdAccounts(data.ad_accounts || []);
        setAdAccountId(data.meta_ad_account_id || null);
        setAdAccountName(data.meta_ad_account_name || null);
        setSuggestedPageId(data.suggested?.page?.id || null);
        const selPage = data.selected?.page_id || data.suggested?.page?.id || '';
        const selPixel = data.selected?.pixel_id || data.suggested?.pixel?.id || '';
        setPageId(selPage);
        const inWebsite = (data.pixels || []).some((p: AssetOption) => p.id === selPixel);
        const inOther = (data.skipped_pixels || []).some((p: AssetOption) => p.id === selPixel);
        if (selPixel && !inWebsite && !inOther) {
          setUseManualPixel(true);
          setManualPixelId(selPixel);
          setPixelId('');
        } else {
          setUseManualPixel(false);
          setPixelId(selPixel);
          setManualPixelId('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Load failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, loadKey]);

  const pageName = pages.find((p) => p.id === pageId)?.name || null;
  const resolvedPixelId = useManualPixel ? manualPixelId.trim() : pixelId.trim();
  const pixelName =
    pixels.find((p) => p.id === resolvedPixelId)?.name ||
    otherPixels.find((p) => p.id === resolvedPixelId)?.name ||
    (useManualPixel && resolvedPixelId ? 'Custom Pixel' : null);

  const mismatch = useMemo(
    () => pagePixelLikelyMismatch(pageName, pixelName),
    [pageName, pixelName]
  );

  async function switchAdAccount(nextId: string) {
    if (!nextId || nextId === adAccountId) return;
    setSwitchingAccount(true);
    setError(null);
    setSavedMsg(null);
    try {
      const page = pages.find((p) => p.id === pageId);
      const res = await fetch('/api/meta/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta_ad_account_id: nextId,
          page_id: pageId || null,
          page_name: page?.name || null,
          pixel_id: null,
          pixel_name: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not switch ad account');
      setSavedMsg(`Switched ad account to ${data.meta_ad_account_name || nextId}`);
      setLoadKey((k) => k + 1);
      onSaved?.({
        page_id: data.page_id,
        page_name: data.page_name,
        pixel_id: data.pixel_id,
        pixel_name: data.pixel_name,
        meta_ad_account_id: data.meta_ad_account_id,
        meta_ad_account_name: data.meta_ad_account_name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Switch failed');
    } finally {
      setSwitchingAccount(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    const page = pages.find((p) => p.id === pageId);
    const fromList =
      pixels.find((p) => p.id === resolvedPixelId) ||
      otherPixels.find((p) => p.id === resolvedPixelId);
    const resolvedPixelName = fromList?.name || (resolvedPixelId ? 'Custom Pixel' : null);

    if (resolvedPixelId && !/^\d{5,}$/.test(resolvedPixelId)) {
      setError('Pixel ID must be numbers only (from Events Manager).');
      setSaving(false);
      return;
    }

    if (pagePixelLikelyMismatch(page?.name, resolvedPixelName)) {
      setError(
        `Page “${page?.name}” and Pixel “${resolvedPixelName}” look like different brands. Pick matching Page + Pixel for the same store, then Save.`
      );
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/meta/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta_ad_account_id: adAccountId,
          page_id: pageId || null,
          page_name: page?.name || null,
          pixel_id: resolvedPixelId || null,
          pixel_name: resolvedPixelName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSavedMsg('Saved for this client account');
      onSaved?.({
        page_id: data.page_id,
        page_name: data.page_name,
        pixel_id: data.pixel_id,
        pixel_name: data.pixel_name,
        meta_ad_account_id: data.meta_ad_account_id,
        meta_ad_account_name: data.meta_ad_account_name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!enabled) return null;

  return (
    <div className="meta-card p-4 mb-4 border-2 border-[var(--meta-blue)] bg-blue-50/50 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Select Meta Ad Account, Page &amp; Pixel
          </p>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            New ad accounts (e.g. under Arham Technologi) appear after you open them once in Ads
            Manager, then Refresh list or Reconnect Facebook. Page and Pixel must match the same
            brand.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-xs inline-flex items-center gap-1 shrink-0"
          onClick={() => setLoadKey((k) => k + 1)}
          disabled={loading || switchingAccount}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading || switchingAccount ? 'animate-spin' : ''}`}
          />
          Refresh list
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your Meta accounts…
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label">Meta Ad Account</label>
            <select
              className="input"
              value={adAccountId || ''}
              onChange={(e) => switchAdAccount(e.target.value)}
              disabled={switchingAccount || adAccounts.length === 0}
            >
              {adAccounts.length === 0 ? (
                <option value="">No ad accounts found — Reconnect Facebook</option>
              ) : (
                adAccounts.map((a) => {
                  const idLabel = String(a.id || '').replace(/^act_/, '');
                  return (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {idLabel ? ` · ${idLabel}` : ''}
                      {a.timezone_name ? ` · ${a.timezone_name}` : ''}
                      {a.blocked ? ' · restricted' : ''}
                    </option>
                  );
                })
              )}
            </select>
            <p className="text-[10px] text-[var(--muted)] mt-1">
              Currently publishing to:{' '}
              <strong>{adAccountName || '—'}</strong>
              {adAccountId ? (
                <span className="font-mono">
                  {' '}
                  · ID {String(adAccountId).replace(/^act_/, '')}
                </span>
              ) : null}
              {adAccounts.length <= 1
                ? ' · If your new account is missing, open it in Ads Manager, then Refresh or Reconnect.'
                : null}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Facebook Page</label>
              <select
                className="input"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
              >
                <option value="">Select page…</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {suggestedPageId === p.id ? ' · suggested' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Meta Pixel</label>
              {!useManualPixel ? (
                <select
                  className="input"
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value)}
                >
                  <option value="">No pixel / choose later…</option>
                  {pixels.length > 0 && (
                    <optgroup label="Website / Shopify pixels">
                      {pixels.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherPixels.length > 0 && (
                    <optgroup label="Other (WhatsApp etc. — not for store traffic)">
                      {otherPixels.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              ) : (
                <input
                  className="input font-mono text-sm"
                  placeholder="Paste Pixel ID from Events Manager"
                  value={manualPixelId}
                  onChange={(e) => setManualPixelId(e.target.value.trim())}
                />
              )}
              <button
                type="button"
                className="text-[11px] text-[var(--meta-blue)] mt-1.5 underline"
                onClick={() => {
                  setUseManualPixel((v) => !v);
                  setError(null);
                }}
              >
                {useManualPixel
                  ? '← Choose from list instead'
                  : 'Or paste Pixel ID from Events Manager'}
              </button>
              {pixels.length === 0 && !useManualPixel && (
                <p className="text-[10px] text-amber-800 mt-1">
                  No website Pixel on this ad account yet. Create/share a Pixel in Events Manager for
                  this account, Refresh — or paste the Pixel ID above.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {mismatch && (
        <p className="text-xs text-amber-950 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-2 inline-flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Mismatch: Page <strong>{pageName}</strong> vs Pixel <strong>{pixelName}</strong>. Pick
            matching brand for both, then Save.
          </span>
        </p>
      )}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
          {error}
        </p>
      )}
      {savedMsg && (
        <p className="text-xs text-green-800 inline-flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> {savedMsg}
        </p>
      )}

      <button
        type="button"
        className="btn-primary text-sm"
        onClick={save}
        disabled={loading || saving || switchingAccount || !pageId || mismatch}
      >
        {saving || switchingAccount ? (
          <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
        ) : null}
        Save Page &amp; Pixel
      </button>
    </div>
  );
}
