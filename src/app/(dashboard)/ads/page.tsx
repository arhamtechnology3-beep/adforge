'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Check, X, Pencil, Loader2 } from 'lucide-react';
import type { GeneratedAd } from '@/types/database';

export default function AdsPage() {
  const [campaignInputId, setCampaignInputId] = useState<string | null>(null);
  const [ads, setAds] = useState<GeneratedAd[]>([]);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/onboarding')
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) {
          setCampaignInputId(data.id);
          return fetch(`/api/ads/generate?campaign_input_id=${data.id}`);
        }
      })
      .then((r) => r?.json())
      .then((data) => {
        if (data?.ads) setAds(data.ads);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    if (!campaignInputId) return;
    setGenerating(true);

    const res = await fetch('/api/ads/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_input_id: campaignInputId }),
    });

    const data = await res.json();
    if (data.ads) setAds(data.ads);
    setGenerating(false);
  }

  async function updateAd(id: string, status?: string, copy_text?: string) {
    const res = await fetch(`/api/ads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, copy_text }),
    });

    const updated = await res.json();
    setAds((prev) => prev.map((a) => (a.id === id ? updated : a)));
    setEditingId(null);
  }

  const approvedCount = ads.filter((a) => a.status === 'approved').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!campaignInputId) {
    return (
      <div className="text-center py-20">
        <Sparkles className="w-12 h-12 text-muted mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Complete onboarding first</h2>
        <p className="text-muted mb-4">Set up your website and connect Meta before generating ads.</p>
        <a href="/onboarding" className="btn-primary">Go to Onboarding</a>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Ad Generation</h1>
          <p className="text-muted mt-1">
            {ads.length > 0
              ? `${approvedCount} of ${ads.length} approved`
              : 'Generate AI-powered ad variants'}
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {ads.length > 0 ? 'Regenerate' : 'Generate 10 Variants'}
        </button>
      </div>

      {ads.length === 0 && !generating && (
        <div className="card text-center py-12">
          <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
          <p className="text-muted">Click &quot;Generate 10 Variants&quot; to create AI ad copy and visuals</p>
        </div>
      )}

      {generating && (
        <div className="card text-center py-12">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
          <p className="font-medium">Generating ad variants...</p>
          <p className="text-sm text-muted mt-1">Creating copy and images — this may take a minute</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ads.map((ad) => (
          <div key={ad.id} className={`card p-0 overflow-hidden ${ad.status === 'approved' ? 'ring-2 ring-green-500' : ad.status === 'rejected' ? 'opacity-60' : ''}`}>
            {ad.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.image_url} alt={`Variant ${ad.variant_number}`} className="w-full aspect-square object-cover" />
            )}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted">Variant #{ad.variant_number}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  ad.status === 'approved' ? 'bg-green-100 text-green-700' :
                  ad.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-muted'
                }`}>
                  {ad.status}
                </span>
              </div>

              {editingId === ad.id ? (
                <div className="space-y-2">
                  <textarea
                    className="input text-sm min-h-[80px]"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs py-1.5" onClick={() => updateAd(ad.id, undefined, editText)}>Save</button>
                    <button className="btn-secondary text-xs py-1.5" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed mb-3">{ad.copy_text}</p>
              )}

              {ad.status === 'pending' && editingId !== ad.id && (
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100" onClick={() => updateAd(ad.id, 'approved')}>
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100" onClick={() => updateAd(ad.id, 'rejected')}>
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button className="p-2 rounded-lg bg-gray-50 text-muted hover:bg-gray-100" onClick={() => { setEditingId(ad.id); setEditText(ad.copy_text); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {approvedCount > 0 && (
        <div className="mt-8 text-center">
          <a href="/campaigns" className="btn-primary">
            Launch Campaign with {approvedCount} Approved Ad{approvedCount > 1 ? 's' : ''} →
          </a>
        </div>
      )}
    </div>
  );
}
