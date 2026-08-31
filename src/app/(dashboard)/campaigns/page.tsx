'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { GeneratedAd, MetaCampaign } from '@/types/database';
import { CampaignWizard } from '@/components/campaign-wizard/CampaignWizard';

function CampaignsPageInner() {
  const searchParams = useSearchParams();
  const template = searchParams.get('template') || undefined;
  const fromAds = searchParams.get('from') === 'ads';

  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [approvedAds, setApprovedAds] = useState<GeneratedAd[]>([]);
  const [metaConnected, setMetaConnected] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/campaigns/launch').then((r) => r.json()),
      fetch('/api/onboarding').then((r) => r.json()),
    ])
      .then(([campaignData, onboardingData]) => {
        setCampaigns(campaignData.campaigns || []);
        setMetaConnected(!!campaignData.meta_connected);
        if (onboardingData?.website_url) setWebsiteUrl(onboardingData.website_url);

        if (onboardingData?.id) {
          return fetch(`/api/ads/generate?campaign_input_id=${onboardingData.id}`)
            .then((r) => r.json())
            .then((adData) => {
              const approved = (adData.ads || []).filter(
                (a: GeneratedAd) => a.status === 'approved'
              );
              setApprovedAds(approved);
            });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--meta-blue)]" />
      </div>
    );
  }

  return (
    <CampaignWizard
      campaigns={campaigns}
      approvedAds={approvedAds}
      metaConnected={metaConnected}
      websiteUrl={websiteUrl}
      initialTemplateId={template}
      fromAds={fromAds}
    />
  );
}

export default function CampaignsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--meta-blue)]" />
        </div>
      }
    >
      <CampaignsPageInner />
    </Suspense>
  );
}
