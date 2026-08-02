'use client';

import { useState, useEffect } from 'react';
import { Megaphone, Loader2, Rocket } from 'lucide-react';
import type { MetaCampaign, GeneratedAd } from '@/types/database';
import { formatCurrency } from '@/lib/utils';

const OBJECTIVES = [
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic' },
  { value: 'OUTCOME_SALES', label: 'Conversions' },
  { value: 'OUTCOME_AWARENESS', label: 'Brand Awareness' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement' },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [approvedAds, setApprovedAds] = useState<GeneratedAd[]>([]);
  const [selectedAds, setSelectedAds] = useState<string[]>([]);
  const [budget, setBudget] = useState('500');
  const [objective, setObjective] = useState('OUTCOME_TRAFFIC');
  const [launching, setLaunching] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLaunchForm, setShowLaunchForm] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/campaigns/launch').then((r) => r.json()),
      fetch('/api/onboarding').then((r) => r.json()),
    ]).then(([campaignData, onboardingData]) => {
      setCampaigns(campaignData.campaigns || []);
      if (onboardingData?.id) {
        fetch(`/api/ads/generate?campaign_input_id=${onboardingData.id}`)
          .then((r) => r.json())
          .then((adData) => {
            const approved = (adData.ads || []).filter((a: GeneratedAd) => a.status === 'approved');
            setApprovedAds(approved);
            setSelectedAds(approved.map((a: GeneratedAd) => a.id));
          });
      }
      setLoading(false);
    });
  }, []);

  async function handleLaunch() {
    setLaunching(true);
    const res = await fetch('/api/campaigns/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ad_ids: selectedAds,
        budget: parseFloat(budget),
        objective,
      }),
    });

    const data = await res.json();
    if (data.campaign) {
      setCampaigns((prev) => [data.campaign, ...prev]);
      setShowLaunchForm(false);
    }
    setLaunching(false);
  }

  async function handleConfirm(campaignId: string) {
    setConfirming(campaignId);
    const res = await fetch(`/api/campaigns/${campaignId}/confirm`, { method: 'POST' });
    const data = await res.json();
    if (data.campaign) {
      setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? data.campaign : c)));
    }
    setConfirming(null);
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted mt-1">Launch and manage your Meta ad campaigns</p>
        </div>
        {approvedAds.length > 0 && (
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowLaunchForm(!showLaunchForm)}>
            <Megaphone className="w-4 h-4" /> New Campaign
          </button>
        )}
      </div>

      {showLaunchForm && (
        <div className="card mb-8 max-w-lg">
          <h3 className="font-semibold mb-4">Launch New Campaign</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Daily Budget (₹)</label>
              <input type="number" className="input" value={budget} onChange={(e) => setBudget(e.target.value)} min="100" />
            </div>
            <div>
              <label className="label">Objective</label>
              <select className="input" value={objective} onChange={(e) => setObjective(e.target.value)}>
                {OBJECTIVES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Approved Ads ({selectedAds.length})</label>
              <p className="text-sm text-muted">{selectedAds.length} ad{selectedAds.length !== 1 ? 's' : ''} selected</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Campaign will be created as <strong>draft</strong>. You must explicitly confirm before it goes live.
            </div>
            <button className="btn-primary w-full" onClick={handleLaunch} disabled={launching || selectedAds.length === 0}>
              {launching ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create Draft Campaign'}
            </button>
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="card text-center py-12">
          <Megaphone className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted">No campaigns yet. Approve ads and launch your first campaign.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="card flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{campaign.objective || 'Campaign'}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    campaign.status === 'active' ? 'bg-green-100 text-green-700' :
                    campaign.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-muted'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
                <p className="text-sm text-muted mt-1">
                  Budget: {formatCurrency(campaign.budget || 0)}/day · Created {new Date(campaign.created_at).toLocaleDateString('en-IN')}
                </p>
              </div>
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
                <a href={`/performance?campaign=${campaign.id}`} className="btn-secondary text-sm">
                  View Performance
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
