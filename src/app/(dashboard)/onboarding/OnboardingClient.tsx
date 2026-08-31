'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Globe, Users, Link2, CheckCircle2, Loader2, Plus, Trash2, Sparkles, ArrowRight, Shield } from 'lucide-react';
import { detectCompetitorType } from '@/lib/utils';
import { WizardStepper } from '@/components/campaign-wizard/WizardStepper';

const STEPS = [
  { id: 'website', label: 'Your Website', shortLabel: 'Website' },
  { id: 'competitors', label: 'Competitors', shortLabel: 'Competitors' },
  { id: 'meta', label: 'Connect Meta', shortLabel: 'Meta' },
];

const MAX_COMPETITORS = 10;

export default function OnboardingClient() {
  const searchParams = useSearchParams();
  const queryStep = searchParams.get('step') ? parseInt(searchParams.get('step')!) - 1 : null;
  const connectedQuery = searchParams.get('connected') === 'true';
  const error = searchParams.get('error');

  const [step, setStep] = useState(queryStep ?? 0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [competitors, setCompetitors] = useState<Array<{ url: string; meta_page_id: string }>>([
    { url: '', meta_page_id: '' },
  ]);
  const [metaConnected, setMetaConnected] = useState(connectedQuery);
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [errorMsg, setErrorMsg] = useState(error ? 'Meta connection failed. Please try again.' : '');
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const res = await fetch('/api/onboarding');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data) return;

        if (data.demo) setIsDemo(true);
        if (data.website_url) setWebsiteUrl(data.website_url);

        const fromCompetitors = Array.isArray(data.competitors)
          ? data.competitors
              .map((c: { url?: string; meta_page_id?: string | null }) => ({
                url: c.url || '',
                meta_page_id: c.meta_page_id || '',
              }))
              .filter((c: { url: string }) => c.url)
          : [];
        const list =
          fromCompetitors.length > 0
            ? fromCompetitors
            : data.competitor_url
              ? [{ url: data.competitor_url, meta_page_id: '' }]
              : [{ url: '', meta_page_id: '' }];
        setCompetitors(list);

        const hasMeta = connectedQuery || !!data.meta_connected;
        setMetaConnected(hasMeta);

        const done = new Set<number>();
        if (data.website_url) done.add(0);
        if (fromCompetitors.length > 0 || data.competitor_url) done.add(1);
        if (hasMeta) done.add(2);
        setCompletedSteps(done);

        if (queryStep === null) {
          if (hasMeta) setStep(2);
          else if (data.website_url && (fromCompetitors.length > 0 || data.competitor_url)) setStep(2);
          else if (data.website_url) setStep(1);
          else setStep(0);
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [connectedQuery, queryStep]);

  function updateCompetitor(index: number, field: 'url' | 'meta_page_id', value: string) {
    setCompetitors((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  function addCompetitor() {
    if (competitors.length >= MAX_COMPETITORS) return;
    setCompetitors((prev) => [...prev, { url: '', meta_page_id: '' }]);
  }

  function removeCompetitor(index: number) {
    setCompetitors((prev) => {
      if (prev.length === 1) return [{ url: '', meta_page_id: '' }];
      return prev.filter((_, i) => i !== index);
    });
  }

  async function saveProgress(nextStep: number) {
    setLoading(true);
    setErrorMsg('');

    const payloadCompetitors = competitors
      .map((c) => ({
        url: c.url.trim(),
        meta_page_id: c.meta_page_id.trim() || null,
        type: detectCompetitorType(c.url.trim()),
      }))
      .filter((c) => c.url);

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website_url: websiteUrl, competitors: payloadCompetitors }),
    });

    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Failed to save progress');
      setLoading(false);
      return;
    }

    setCompletedSteps((prev) => new Set([...prev, step]));
    setStep(nextStep);
    setLoading(false);
  }

  function handleConnectMeta() {
    window.location.href = '/api/oauth/meta/connect';
  }

  if (hydrating) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--meta-blue)]" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Set up your brand</h1>
        <p className="text-[var(--muted)] mt-1 text-sm">
          3 quick steps — we&apos;ll scrape your store and find competitor ads automatically
        </p>
      </div>

      <WizardStepper steps={STEPS} currentStep={step} completedSteps={completedSteps} />

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-6">
          {errorMsg}
        </div>
      )}

      <div className="meta-card max-w-2xl p-6">
        {step === 0 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[var(--meta-blue)]" />
              <h2 className="font-semibold text-lg">Your website</h2>
            </div>
            <div>
              <label className="label">Shopify / store URL</label>
              <input
                type="url"
                className="input"
                placeholder="https://yourstore.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
              <p className="text-xs text-[var(--muted)] mt-1.5">
                We scrape your homepage for brand name, products, and images for ad creatives
              </p>
            </div>
            <button
              className="btn-primary flex items-center gap-2"
              disabled={!websiteUrl || loading}
              onClick={() => saveProgress(1)}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[var(--meta-blue)]" />
              <h2 className="font-semibold text-lg">Competitor ads to clone</h2>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Add competitor websites or Meta Ad Library URLs. Optional Page ID unlocks live ads (e.g. FarmDidi = 108788791719221).
            </p>

            <div className="space-y-3">
              {competitors.map((comp, index) => {
                const type = comp.url.trim() ? detectCompetitorType(comp.url) : null;
                return (
                  <div key={index} className="rounded-xl border border-[var(--border)] p-4 space-y-2 bg-[var(--meta-bg)]/50">
                    <div className="flex gap-2">
                      <input
                        type="url"
                        className="input"
                        placeholder="https://competitor.com or Ad Library URL"
                        value={comp.url}
                        onChange={(e) => updateCompetitor(index, 'url', e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-secondary px-3 shrink-0"
                        onClick={() => removeCompetitor(index)}
                        aria-label="Remove competitor"
                        disabled={competitors.length === 1 && !comp.url}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="Meta Page ID (optional)"
                      value={comp.meta_page_id}
                      onChange={(e) => updateCompetitor(index, 'meta_page_id', e.target.value)}
                    />
                    {type && (
                      <p className="text-xs text-[var(--muted)]">
                        Detected: <span className="font-medium capitalize">{type}</span>
                        {comp.meta_page_id.trim() ? ' · Page ID saved' : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {competitors.length < MAX_COMPETITORS && (
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm font-medium text-[var(--meta-blue)] hover:underline"
                onClick={addCompetitor}
              >
                <Plus className="w-4 h-4" /> Add another competitor
              </button>
            )}

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setStep(0)}>Back</button>
              <button className="btn-primary flex items-center gap-2" disabled={loading} onClick={() => saveProgress(2)}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save &amp; Continue <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[var(--meta-blue)]" />
              <h2 className="font-semibold text-lg">Connect Meta ad account</h2>
            </div>

            {metaConnected ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-14 h-14 text-[var(--meta-green)] mx-auto mb-4" />
                <h3 className="font-semibold text-xl">Meta connected!</h3>
                <p className="text-[var(--muted)] text-sm mt-2 mb-6">
                  You&apos;re ready to clone competitor ads and launch campaigns.
                </p>
                <a href="/ads" className="btn-primary inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Start cloning ads →
                </a>
              </div>
            ) : (
              <>
                <p className="text-sm text-[var(--muted)]">
                  Connect your Meta Business ad account to publish campaigns. Ads spend runs on your account — we never touch your billing.
                </p>
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-900">
                  <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Campaigns are created <strong>PAUSED</strong> — you confirm before anything goes live.</span>
                </div>
                <button className="btn-primary w-full py-3" onClick={handleConnectMeta}>
                  Connect Meta Ad Account
                </button>
                {isDemo && (
                  <a href="/ads" className="btn-secondary w-full text-center block">
                    Continue without Meta (demo preview)
                  </a>
                )}
                <button className="btn-secondary w-full" onClick={() => setStep(1)}>Back</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
