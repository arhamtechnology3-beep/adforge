'use client';

import { useEffect, useState } from 'react';
import { Loader2, Check } from 'lucide-react';

type AssetOption = { id: string; name: string };

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
  const [skipped, setSkipped] = useState<AssetOption[]>([]);
  const [pageId, setPageId] = useState('');
  const [pixelId, setPixelId] = useState('');

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
        setSkipped(data.skipped_pixels || []);
        setPageId(data.selected?.page_id || data.suggested?.page?.id || '');
        setPixelId(data.selected?.pixel_id || data.suggested?.pixel?.id || '');
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
  }, [enabled]);

  async function save() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    const page = pages.find((p) => p.id === pageId);
    const pixel = pixels.find((p) => p.id === pixelId);
    try {
      const res = await fetch('/api/meta/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: pageId || null,
          page_name: page?.name || null,
          pixel_id: pixelId || null,
          pixel_name: pixel?.name || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSavedMsg('Saved for your account');
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
    <div className="meta-card p-4 mb-4 border-blue-100 bg-blue-50/40 space-y-3">
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">Your Meta Page &amp; Pixel</p>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Each client picks their own assets. WhatsApp messaging datasets are hidden — use your
          Shopify / website Pixel for store traffic.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your Pages &amp; Pixels…
        </div>
      ) : (
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
            <label className="label">Website Pixel (optional for Traffic)</label>
            <select
              className="input"
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
            >
              <option value="">No pixel / choose later…</option>
              {pixels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {skipped.length > 0 && (
              <p className="text-[10px] text-[var(--muted)] mt-1">
                Hidden {skipped.length} WhatsApp/messaging dataset
                {skipped.length > 1 ? 's' : ''} (not for website ads).
              </p>
            )}
            {pixels.length === 0 && (
              <p className="text-[10px] text-amber-700 mt-1">
                No website Pixel found. Create one in Meta Events Manager and link it to this ad
                account, then refresh.
              </p>
            )}
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
