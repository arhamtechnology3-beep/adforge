'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Megaphone,
  Loader2,
  Rocket,
  Check,
  Link2,
  AlertCircle,
  Sparkles,
  IndianRupee,
} from 'lucide-react';
import type { MetaCampaign, GeneratedAd, AdFormat } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { META_AD_FORMATS } from '@/lib/creatives';

const OBJECTIVES = [
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic', hint: 'Send people to your store / landing page' },
  { value: 'OUTCOME_SALES', label: 'Conversions', hint: 'Purchases & checkout events (needs Pixel)' },
  { value: 'OUTCOME_AWARENESS', label: 'Brand Awareness', hint: 'Reach more people in India' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement', hint: 'Likes, comments, shares' },
];

function formatLabel(ad: GeneratedAd): string {
  const f = (ad.ad_format || 'single_image') as AdFormat;
  return META_AD_FORMATS[f]?.shortLabel || 'Image';
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [approvedAds, setApprovedAds] = useState<GeneratedAd[]>([]);
  const [selectedAds, setSelectedAds] = useState<string[]>([]);
  const [budget, setBudget] = useState('500');
  const [objective, setObjective] = useState('OUTCOME_TRAFFIC');
  const [campaignName, setCampaignName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [launching, setLaunching] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLaunchForm, setShowLaunchForm] = useState(false);
  const [metaConnected, setMetaConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/campaigns/launch').then((r) => r.json()),
      fetch('/api/onboarding').then((r) => r.json()),
    ])
      .then(([campaignData, onboardingData]) => {
        setCampaigns(campaignData.campaigns || []);
        setMetaConnected(!!campaignData.meta_connected);
        if (onboardingData?.website_url) {
          setWebsiteUrl(onboardingData.website_url);
        }
        if (onboardingData?.id) {
          return fetch(`/api/ads/generate?campaign_input_id=${onboardingData.id}`)
            .then((r) => r.json())
            .then((adData) => {
              const approved = (adData.ads || []).filter(
                (a: GeneratedAd) => a.status === 'approved'
              );
              setApprovedAds(approved);
              setSelectedAds(approved.map((a: GeneratedAd) => a.id));
              if (approved.length > 0) setShowLaunchForm(true);
            });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleAd(id: string) {
    setSelectedAds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleLaunch() {
    setError(null);
    setToast(null);
    if (selectedAds.length === 0) {
      setError('Select at least one approved creative');
      return;
    }
    setLaunching(true);
    const res = await fetch('/api/campaigns/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ad_ids: selectedAds,
        budget: parseFloat(budget),
        objective,
        website_url: websiteUrl || undefined,
        name: campaignName || undefined,
        audience: { countries: ['IN'], age_min: 18, age_max: 65 },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to create campaign');
      setLaunching(false);
      return;
    }
    if (data.campaign) {
      setCampaigns((prev) => [data.campaign, ...prev]);
      setShowLaunchForm(false);
      setToast(data.message || 'Draft campaign created');
    }
    setLaunching(false);
  }

  async function handleConfirm(campaignId: string) {
    setError(null);
    setToast(null);
    setConfirming(campaignId);
    const res = await fetch(`/api/campaigns/${campaignId}/confirm`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to confirm campaign');
      setConfirming(null);
      return;
    }
    if (data.campaign) {
      setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? data.campaign : c)));
      setToast(data.message || 'Campaign activated');
    }
    setConfirming(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedFormats = approvedAds
    .filter((a) => selectedAds.includes(a.id))
    .reduce<Record<string, number>>((acc, ad) => {
      const f = formatLabel(ad);
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {});

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted mt-1">
            Pick approved creatives → set budget → draft → confirm to launch
          </p>
        </div>
        {approvedAds.length > 0 && (
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowLaunchForm(!showLaunchForm)}
          >
            <Megaphone className="w-4 h-4" />
            {showLaunchForm ? 'Hide launch form' : 'New Campaign'}
          </button>
        )}
      </div>

      {/* Meta connection status */}
      <div
        className={`rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3 border ${
          metaConnected
            ? 'bg-green-50 border-green-100 text-green-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex-1 flex gap-3">
          {metaConnected ? (
            <Check className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <p className="font-medium">
              {metaConnected ? 'Meta Ad Account connected' : 'Meta not connected yet'}
            </p>
            <p className="mt-0.5 opacity-90">
              {metaConnected
                ? 'Drafts sync to Meta as PAUSED. Confirm & Launch turns them live.'
                : 'You can still create a local draft now. Connect Meta before going live on Facebook & Instagram.'}
            </p>
          </div>
        </div>
        {!metaConnected && (
          <a href="/api/oauth/meta/connect" className="btn-primary text-sm whitespace-nowrap inline-flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Connect Meta
          </a>
        )}
      </div>

      {toast && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-100 text-green-800 text-sm px-4 py-3">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-100 text-red-800 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {approvedAds.length === 0 && (
        <div className="card text-center py-12 mb-8">
          <Sparkles className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="font-medium mb-1">No approved creatives yet</p>
          <p className="text-muted text-sm mb-4">
            Go to Ad Generation, approve Image / Carousel / Stories / Video options, then come back here.
          </p>
          <Link href="/ads" className="btn-primary inline-flex">
            Review ads →
          </Link>
        </div>
      )}

      {showLaunchForm && approvedAds.length > 0 && (
        <div className="card mb-8">
          <h3 className="font-semibold mb-1">Launch new campaign</h3>
          <p className="text-sm text-muted mb-5">
            Step 1 of 2 — create a <strong>draft</strong>. Nothing goes live until you Confirm.
          </p>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="label">Campaign name</label>
                <input
                  className="input"
                  placeholder="e.g. Festive pickles · Traffic"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Daily budget (₹)</label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="number"
                    className="input pl-9"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    min="100"
                    step="50"
                  />
                </div>
                <p className="text-xs text-muted mt-1">Minimum ₹100/day · India targeting (18–65)</p>
              </div>

              <div>
                <label className="label">Objective</label>
                <div className="space-y-2">
                  {OBJECTIVES.map((o) => (
                    <label
                      key={o.value}
                      className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        objective === o.value
                          ? 'border-primary bg-primary/5'
                          : 'border-[var(--border)] hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="objective"
                        className="mt-1"
                        checked={objective === o.value}
                        onChange={() => setObjective(o.value)}
                      />
                      <span>
                        <span className="font-medium text-sm block">{o.label}</span>
                        <span className="text-xs text-muted">{o.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Destination URL</label>
                <input
                  className="input"
                  type="url"
                  placeholder="https://yourstore.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">
                Approved creatives ({selectedAds.length}/{approvedAds.length})
              </label>
              <p className="text-xs text-muted mb-3">
                Select which formats to run. Mix Image + Carousel + Stories for Meta best practice.
              </p>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {approvedAds.map((ad) => {
                  const selected = selectedAds.includes(ad.id);
                  return (
                    <button
                      key={ad.id}
                      type="button"
                      onClick={() => toggleAd(ad.id)}
                      className={`w-full text-left flex gap-3 p-2 rounded-lg border transition-colors ${
                        selected
                          ? 'border-green-400 bg-green-50/60'
                          : 'border-[var(--border)] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-100 shrink-0">
                        {ad.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ad.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                            {formatLabel(ad)}
                          </span>
                          {selected && <Check className="w-3.5 h-3.5 text-green-600" />}
                        </div>
                        <p className="text-sm font-medium truncate mt-0.5">
                          {ad.headline || `Variant #${ad.variant_number}`}
                        </p>
                        <p className="text-xs text-muted line-clamp-2">{ad.copy_text}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {Object.keys(selectedFormats).length > 0 && (
                <p className="text-xs text-muted mt-3">
                  Selected mix:{' '}
                  {Object.entries(selectedFormats)
                    .map(([f, c]) => `${c} ${f}`)
                    .join(' · ')}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-t border-[var(--border)] pt-5">
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Creates as <strong>draft</strong> (PAUSED on Meta). You must Confirm & Launch next.
            </p>
            <button
              className="btn-primary flex items-center justify-center gap-2 min-w-[200px]"
              onClick={handleLaunch}
              disabled={launching || selectedAds.length === 0}
            >
              {launching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Megaphone className="w-4 h-4" />
              )}
              Create draft campaign
            </button>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Your campaigns</h2>

      {campaigns.length === 0 ? (
        <div className="card text-center py-12">
          <Megaphone className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted">
            No campaigns yet. Approve ads and create your first draft above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const config = (campaign.launch_config || {}) as Record<string, unknown>;
            const formatMix = (config.format_mix || {}) as Record<string, number>;
            const adCount =
              campaign.ad_ids?.length ||
              (typeof config.ad_count === 'number' ? config.ad_count : null);

            return (
              <div
                key={campaign.id}
                className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold truncate">
                      {campaign.name || campaign.objective || 'Campaign'}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        campaign.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : campaign.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-muted'
                      }`}
                    >
                      {campaign.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted mt-1">
                    {formatCurrency(campaign.budget || 0)}/day
                    {campaign.objective ? ` · ${campaign.objective.replace('OUTCOME_', '')}` : ''}
                    {adCount ? ` · ${adCount} creative${adCount > 1 ? 's' : ''}` : ''}
                    {' · '}
                    {new Date(campaign.created_at).toLocaleDateString('en-IN')}
                  </p>
                  {Object.keys(formatMix).length > 0 && (
                    <p className="text-xs text-muted mt-1">
                      Formats:{' '}
                      {Object.entries(formatMix)
                        .map(
                          ([f, c]) =>
                            `${c} ${META_AD_FORMATS[f as AdFormat]?.shortLabel || f}`
                        )
                        .join(' · ')}
                    </p>
                  )}
                  {campaign.website_url && (
                    <p className="text-xs text-muted mt-1 truncate">→ {campaign.website_url}</p>
                  )}
                  {!campaign.meta_campaign_id && campaign.status === 'draft' && (
                    <p className="text-xs text-amber-700 mt-1">Local draft — not yet on Meta</p>
                  )}
                </div>

                <div className="flex gap-2 shrink-0">
                  {campaign.status === 'draft' && (
                    <button
                      className="btn-primary flex items-center gap-2"
                      onClick={() => handleConfirm(campaign.id)}
                      disabled={confirming === campaign.id}
                    >
                      {confirming === campaign.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Rocket className="w-4 h-4" />
                      )}
                      Confirm & Launch
                    </button>
                  )}
                  {campaign.status === 'active' && (
                    <a
                      href={`/performance?campaign=${campaign.id}`}
                      className="btn-secondary text-sm"
                    >
                      View Performance
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
