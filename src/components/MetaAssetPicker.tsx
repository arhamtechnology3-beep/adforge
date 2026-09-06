'use client';

import { useEffect, useState } from 'react';
import { Loader2, Check, RefreshCw } from 'lucide-react';

type AssetOption = { id: string; name: string; kind?: string };

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

  async function save() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    const page = pages.find((p) => p.id === pageId);
    const resolvedPixelId = useManualPixel
      ? manualPixelId.trim()
      : pixelId.trim();
    const fromList =
      pixels.find((p) => p.id === resolvedPixelId) ||
      otherPixels.find((p) => p.id === resolvedPixelId);
    const resolvedPixelName = fromList?.name || (resolvedPixelId ? 'Custom Pixel' : null);

    if (resolvedPixelId && !/^\d{5,}$/.test(resolvedPixelId)) {
      setError('Pixel ID must be numbers only (from Events Manager).');
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
            Required per client (SaaS). Pick the Facebook Page that should appear on ads, and your
            Shopify/website Pixel for Sales tracking.
          </p>
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
        disabled={loading || saving || !pageId}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
        Save Page &amp; Pixel
      </button>
    </div>
  );
}
