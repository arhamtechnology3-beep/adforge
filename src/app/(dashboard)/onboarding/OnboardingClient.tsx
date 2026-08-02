'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Globe, Users, Link2, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import { detectCompetitorType } from '@/lib/utils';

const STEPS = [
  { title: 'Your Website', icon: Globe },
  { title: 'Competitors', icon: Users },
  { title: 'Connect Meta', icon: Link2 },
];

const MAX_COMPETITORS = 10;

export default function OnboardingClient() {
  const searchParams = useSearchParams();
  const queryStep = searchParams.get('step') ? parseInt(searchParams.get('step')!) - 1 : null;
  const connectedQuery = searchParams.get('connected') === 'true';
  const error = searchParams.get('error');

  const [step, setStep] = useState(queryStep ?? 0);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(['']);
  const [metaConnected, setMetaConnected] = useState(connectedQuery);
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [errorMsg, setErrorMsg] = useState(error ? 'Meta connection failed. Please try again.' : '');

  // Restore saved onboarding session from DB
  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const res = await fetch('/api/onboarding');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data) return;

        if (data.website_url) {
          setWebsiteUrl(data.website_url);
        }

        const urlsFromCompetitors = Array.isArray(data.competitors)
          ? data.competitors.map((c: { url?: string }) => c.url).filter(Boolean)
          : [];
        const urls =
          urlsFromCompetitors.length > 0
            ? urlsFromCompetitors
            : data.competitor_url
              ? [data.competitor_url]
              : [''];
        setCompetitorUrls(urls.length > 0 ? urls : ['']);

        const hasMeta = connectedQuery || !!data.meta_connected;
        setMetaConnected(hasMeta);

        // Resume at the right step unless URL already forces one
        if (queryStep === null) {
          if (hasMeta) setStep(2);
          else if (data.website_url && (urlsFromCompetitors.length > 0 || data.competitor_url)) setStep(2);
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

  function updateCompetitor(index: number, value: string) {
    setCompetitorUrls((prev) => prev.map((url, i) => (i === index ? value : url)));
  }

  function addCompetitor() {
    if (competitorUrls.length >= MAX_COMPETITORS) return;
    setCompetitorUrls((prev) => [...prev, '']);
  }

  function removeCompetitor(index: number) {
    setCompetitorUrls((prev) => {
      if (prev.length === 1) return [''];
      return prev.filter((_, i) => i !== index);
    });
  }

  async function saveProgress(nextStep: number) {
    setLoading(true);
    setErrorMsg('');

    const competitors = competitorUrls
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => ({ url, type: detectCompetitorType(url) }));

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website_url: websiteUrl, competitors }),
    });

    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Failed to save progress');
      setLoading(false);
      return;
    }

    setStep(nextStep);
    setLoading(false);
  }

  function handleConnectMeta() {
    window.location.href = '/api/oauth/meta/connect';
  }

  if (hydrating) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Onboarding</h1>
      <p className="text-muted mb-8">Set up your brand in 3 quick steps — progress is saved automatically</p>

      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              i <= step ? 'bg-primary text-white' : 'bg-gray-200 text-muted'
            }`}>
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-sm hidden sm:block ${i <= step ? 'font-medium' : 'text-muted'}`}>
              {s.title}
            </span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-primary' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-6">{errorMsg}</div>
      )}

      <div className="card max-w-xl">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="label">Your Shopify / Website URL</label>
              <input
                type="url"
                className="input"
                placeholder="https://yourstore.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
              <p className="text-xs text-muted mt-1">We&apos;ll scrape your homepage to understand your brand</p>
            </div>
            <button
              className="btn-primary"
              disabled={!websiteUrl || loading}
              onClick={() => saveProgress(1)}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label">Competitor URLs or Ad Links</label>
              <p className="text-xs text-muted mb-3">
                Add website, Facebook, or Instagram ad links. Type is detected automatically.
              </p>

              <div className="space-y-3">
                {competitorUrls.map((url, index) => {
                  const type = url.trim() ? detectCompetitorType(url) : null;
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex gap-2">
                        <input
                          type="url"
                          className="input"
                          placeholder="https://competitor.com or Facebook/Instagram ad link"
                          value={url}
                          onChange={(e) => updateCompetitor(index, e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn-secondary px-3 shrink-0"
                          onClick={() => removeCompetitor(index)}
                          aria-label="Remove competitor"
                          disabled={competitorUrls.length === 1 && !url}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {type && (
                        <p className="text-xs text-muted pl-1">
                          Detected: <span className="font-medium capitalize">{type}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {competitorUrls.length < MAX_COMPETITORS && (
                <button
                  type="button"
                  className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  onClick={addCompetitor}
                >
                  <Plus className="w-4 h-4" />
                  Add another competitor
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setStep(0)}>Back</button>
              <button className="btn-primary" disabled={loading} onClick={() => saveProgress(2)}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Continue'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {metaConnected ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold text-lg">Meta Account Connected!</h3>
                <p className="text-muted text-sm mt-1">You&apos;re ready to generate ads.</p>
                <a href="/ads" className="btn-primary inline-block mt-4">
                  Generate Ads →
                </a>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted">
                  Connect your Meta Business ad account to launch campaigns. Requires a registered Meta App with Marketing API access.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <strong>Prerequisite:</strong> Set META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI in your environment before connecting.
                </div>
                <button className="btn-primary w-full" onClick={handleConnectMeta}>
                  Connect Meta Ad Account
                </button>
                <button className="btn-secondary w-full" onClick={() => setStep(1)}>
                  Back
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
