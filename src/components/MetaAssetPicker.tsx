'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Check, RefreshCw, AlertTriangle } from 'lucide-react';

type AssetOption = { id: string; name: string; kind?: string };

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
 * Per-client Page + Pixel picker (multi-tenant SaaS).
 * Each subscriber chooses from THEIR Meta assets after Connect.
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
  }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [pages, setPages] = useState<AssetOption[]>([]);
  const [pixels, setPixels] = useState<AssetOption[]>([]);
  const [otherPixels, setOtherPixels] = useState<AssetOption[]>([]);
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
        `Page “${page?.name}” and Pixel “${resolvedPixelName}” look like different brands. Pick the matching Page for this store (e.g. both Divyaprabha Foods), then Save.`
      );
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/meta/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
            Select your Meta Page &amp; Pixel
          </p>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Page = who appears on the ad. Pixel = tracking for the connected ad account. Use the
            same brand for both (do not mix Arham Advertising page with Divyaprabha pixel).
          </p>
          {(adAccountName || adAccountId) && (
            <p className="text-[11px] text-slate-700 mt-1.5 font-medium">
              Ads publish to ad account:{' '}
              <span className="text-[var(--meta-blue)]">
                {adAccountName || adAccountId}
              </span>
              {adAccountName && adAccountId ? (
                <span className="text-[var(--muted)] font-normal">
                  {' '}
                  ({String(adAccountId).replace(/^act_/, '')})
                </span>
              ) : null}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn-secondary text-xs inline-flex items-center gap-1 shrink-0"
          onClick={() => setLoadKey((k) => k + 1)}
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh list
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your Pages &amp; Pixels…
        </div>
      ) : (
        <div className="space-y-3">
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
                  No website Pixel on this ad account yet. Create one in Events Manager, share it
                  with this ad account, Refresh list — or paste the Pixel ID above.
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
            Mismatch: Page <strong>{pageName}</strong> vs Pixel <strong>{pixelName}</strong>. For
            Divyaprabha launches pick Page <strong>Divyaprabha Foods</strong> and the matching
            pixel, then Save. Preview uses the Page name — mixing brands confuses Ads Manager.
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
        disabled={loading || saving || !pageId || mismatch}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
        Save Page &amp; Pixel
      </button>
    </div>
  );
}
