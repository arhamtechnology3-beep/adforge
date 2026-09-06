'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { GeneratedAd, MetaCampaign } from '@/types/database';
import { CampaignWizard } from '@/components/campaign-wizard/CampaignWizard';
import MetaAssetPicker from '@/components/MetaAssetPicker';

function CampaignsPageInner() {
  const searchParams = useSearchParams();
  const template = searchParams.get('template') || undefined;
  const fromAds = searchParams.get('from') === 'ads';

  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [approvedAds, setApprovedAds] = useState<GeneratedAd[]>([]);
  const [metaConnected, setMetaConnected] = useState(false);
  const [pageName, setPageName] = useState<string | null>(null);
  const [pixelId, setPixelId] = useState<string | null>(null);
  const [pixelName, setPixelName] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/campaigns/launch').then((r) => r.json()),
      fetch('/api/onboarding').then((r) => r.json()),
    ])
      .then(([campaignData, onboardingData]) => {
        setCampaigns(campaignData.campaigns || []);
        setMetaConnected(!!campaignData.meta_connected);
        setPageName(campaignData.page_name || null);
        setPixelId(campaignData.pixel_id || null);
        setPixelName(campaignData.pixel_name || null);
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
  }, [searchParams, reloadToken]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--meta-blue)]" />
      </div>
    );
  }

  return (
    <>
      <MetaAssetPicker
        enabled={metaConnected}
        onSaved={(sel) => {
          setPageName(sel.page_name);
          setPixelId(sel.pixel_id);
          setPixelName(sel.pixel_name);
          setReloadToken((n) => n + 1);
        }}
      />
      <CampaignWizard
        campaigns={campaigns}
        approvedAds={approvedAds}
        metaConnected={metaConnected}
        websiteUrl={websiteUrl}
        initialTemplateId={template}
        fromAds={fromAds}
        pageName={pageName}
        pixelId={pixelId}
        pixelName={pixelName}
      />
    </>
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
