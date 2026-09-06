'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Target,
  Users,
  IndianRupee,
  Image as ImageIcon,
  Eye,
  Rocket,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Link2,
  Check,
  AlertCircle,
  Megaphone,
  MapPin,
  Calendar,
  LayoutGrid,
} from 'lucide-react';
import type { GeneratedAd, MetaCampaign } from '@/types/database';
import { META_AD_FORMATS } from '@/lib/creatives';
import {
  CAMPAIGN_OBJECTIVES,
  META_CTA_OPTIONS,
  type PlacementToggles,
} from '@/lib/meta-campaign';
import { CAMPAIGN_TEMPLATES, getCampaignTemplate } from '@/lib/campaign-templates';
import {
  loadCampaignPrefill,
  clearCampaignPrefill,
  type CampaignPrefill,
} from '@/lib/campaign-prefill';
import type { CampaignValidationResult } from '@/lib/campaign-validation';
import { formatCurrency } from '@/lib/utils';
import { WizardStepper } from './WizardStepper';
import { ValidationChecklist } from './ValidationChecklist';
import { FacebookAdPreview } from '@/components/ad-preview/FacebookAdPreview';

const WIZARD_STEPS = [
  { id: 'goal', label: 'Campaign Goal', shortLabel: 'Goal' },
  { id: 'audience', label: 'Audience', shortLabel: 'Audience' },
  { id: 'budget', label: 'Budget & Schedule', shortLabel: 'Budget' },
  { id: 'creatives', label: 'Creatives', shortLabel: 'Ads' },
  { id: 'review', label: 'Review', shortLabel: 'Review' },
  { id: 'launch', label: 'Launch', shortLabel: 'Launch' },
];

const DEFAULT_PLACEMENTS: PlacementToggles = {
  reels: true,
  ig_feed: true,
  fb_feed: true,
  stories: true,
};

const META_CONNECT_ERRORS: Record<string, string> = {
  meta_demo_blocked: 'Meta connect needs a session. Refresh and try Connect with Facebook again.',
  meta_not_configured:
    'Facebook connect is not enabled on this AdForge install yet. The platform Meta App must be configured on the server (not by each customer).',
  meta_platform_setup:
    'Facebook connect is not enabled on this AdForge install yet. The platform Meta App must be configured on the server (not by each customer).',
  meta_login_required: 'Sign in first, then connect with Facebook.',
  meta_denied: 'Facebook login was cancelled. Click Connect with Facebook to try again.',
  meta_invalid: 'Meta connect failed (invalid callback). Try Connect with Facebook again.',
  meta_failed:
    'Meta connect failed while talking to Facebook. Try Connect with Facebook again.',
};

export function CampaignWizard({
  campaigns: initialCampaigns,
  approvedAds: initialAds,
  metaConnected,
  websiteUrl: initialWebsiteUrl,
  initialTemplateId,
  fromAds,
}: {
  campaigns: MetaCampaign[];
  approvedAds: GeneratedAd[];
  metaConnected: boolean;
  websiteUrl: string;
  initialTemplateId?: string;
  fromAds?: boolean;
}) {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [campaigns, setCampaigns] = useState(initialCampaigns);

  // Form state
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('OUTCOME_TRAFFIC');
  const [budgetType, setBudgetType] = useState<'daily' | 'lifetime'>('daily');
  const [budget, setBudget] = useState('500');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65');
  const [gender, setGender] = useState<'ALL' | 'MEN' | 'WOMEN'>('ALL');
  const [locations, setLocations] = useState(
    'Mumbai, Delhi, Bengaluru, Hyderabad, Pune'
  );
  const [interests, setInterests] = useState('Online shopping, Gifting');
  const [placements, setPlacements] = useState<PlacementToggles>(DEFAULT_PLACEMENTS);
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl);
  const [cta, setCta] = useState('SHOP_NOW');
  const [linkDescription, setLinkDescription] = useState('');
  const [selectedAds, setSelectedAds] = useState<string[]>(
    initialAds.map((a) => a.id)
  );

  const [validation, setValidation] = useState<CampaignValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialTemplateId || null
  );
  const [lastLaunchedId, setLastLaunchedId] = useState<string | null>(null);
  const [lastLaunchMetaSynced, setLastLaunchMetaSynced] = useState(false);
  const [lastLaunchMetaError, setLastLaunchMetaError] = useState<string | null>(null);
  const [prefillBanner, setPrefillBanner] = useState<string | null>(
    fromAds ? 'Strategy imported from competitor ads — review and launch' : null
  );

  const approvedAds = initialAds;

  useEffect(() => {
    const code = searchParams.get('error');
    if (code && META_CONNECT_ERRORS[code]) {
      setError(META_CONNECT_ERRORS[code]);
    }
    if (searchParams.get('connected') === 'true') {
      setToast('Meta connected — we pulled your Facebook ad account automatically.');
    }
  }, [searchParams]);

  function applyTemplate(templateId: string) {
    const t = getCampaignTemplate(templateId);
    if (!t) return;
    setSelectedTemplateId(templateId);
    setName(`${t.name_prefix} · ${new Date().toLocaleDateString('en-IN')}`);
    setObjective(t.objective);
    setBudget(String(t.budget));
    setBudgetType(t.budget_type);
    setCta(t.cta);
    setAgeMin(String(t.age_min));
    setAgeMax(String(t.age_max));
    setGender(t.gender);
    setLocations(t.locations);
    setInterests(t.interests);
    setPlacements({ ...t.placements });
    if (t.link_description) setLinkDescription(t.link_description);
  }

  function applyPrefill(prefill: CampaignPrefill) {
    if (prefill.name) setName(prefill.name);
    if (prefill.objective) setObjective(prefill.objective);
    if (prefill.budget) setBudget(String(prefill.budget));
    if (prefill.budget_type) setBudgetType(prefill.budget_type);
    if (prefill.cta) setCta(prefill.cta);
    if (prefill.link_description) setLinkDescription(prefill.link_description);
    if (prefill.age_min) setAgeMin(String(prefill.age_min));
    if (prefill.age_max) setAgeMax(String(prefill.age_max));
    if (prefill.gender) setGender(prefill.gender);
    if (prefill.locations) setLocations(prefill.locations);
    if (prefill.interests) setInterests(prefill.interests);
    if (prefill.placements) setPlacements(prefill.placements);
    if (prefill.templateId) setSelectedTemplateId(prefill.templateId);
  }

  useEffect(() => {
    const prefill = loadCampaignPrefill();
    if (prefill) {
      applyPrefill(prefill);
      if (prefill.fromAds) {
        setPrefillBanner('Strategy imported from competitor ads — review and launch');
      }
      clearCampaignPrefill();
    } else if (initialTemplateId) {
      applyTemplate(initialTemplateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const previewAd = approvedAds.find((a) => selectedAds.includes(a.id)) || approvedAds[0];

  const buildPayload = useCallback(
    () => ({
      name: name || `Campaign · ${new Date().toLocaleDateString('en-IN')}`,
      objective,
      budget: Number(budget),
      budget_type: budgetType,
      website_url: websiteUrl,
      ad_ids: selectedAds,
      cta,
      audience: {
        countries: ['IN'],
        age_min: Number(ageMin),
        age_max: Number(ageMax),
        gender,
        locations: locations.split(',').map((s) => s.trim()).filter(Boolean),
        interests: interests.split(',').map((s) => s.trim()).filter(Boolean),
        placements,
        start_date: startDate,
        end_date: endDate || null,
        cta,
        link_description: linkDescription || null,
      },
    }),
    [
      name,
      objective,
      budget,
      budgetType,
      websiteUrl,
      selectedAds,
      cta,
      ageMin,
      ageMax,
      gender,
      locations,
      interests,
      placements,
      startDate,
      endDate,
      linkDescription,
    ]
  );

  const runValidation = useCallback(async () => {
    setValidating(true);
    try {
      const res = await fetch('/api/campaigns/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      setValidation(data);
      return data as CampaignValidationResult;
    } finally {
      setValidating(false);
    }
  }, [buildPayload]);

  useEffect(() => {
    if (step >= 4) runValidation();
  }, [step, runValidation]);

  function markStepDone(s: number) {
    setCompletedSteps((prev) => new Set([...prev, s]));
  }

  function nextStep() {
    markStepDone(step);
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function toggleAd(id: string) {
    setSelectedAds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function togglePlacement(key: keyof PlacementToggles) {
    setPlacements((p) => ({ ...p, [key]: !p[key] }));
  }

  async function handleLaunch(isDraft: boolean) {
    setError(null);
    const v = await runValidation();
    if (!isDraft && v && !v.can_launch) {
      setError(v.errors[0] || 'Fix validation errors before launching');
      return;
    }

    setLaunching(true);
    try {
      const res = await fetch('/api/campaigns/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildPayload(), is_draft: isDraft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Launch failed');
        return;
      }
      if (data.campaign) {
        setCampaigns((prev) => [data.campaign, ...prev]);
        setLastLaunchedId(data.campaign.id);
        setLastLaunchMetaSynced(Boolean(data.meta_synced));
        setLastLaunchMetaError(
          typeof data.meta_sync_error === 'string' ? data.meta_sync_error : null
        );
        setToast(data.message || 'Campaign created');
        markStepDone(5);
        setStep(5);
      }
    } finally {
      setLaunching(false);
    }
  }

  async function handleConfirm(campaignId: string) {
    setConfirming(campaignId);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Activation failed');
        return;
      }
      if (data.campaign) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === campaignId ? data.campaign : c))
        );
        setToast(data.message || 'Campaign is live!');
      }
    } finally {
      setConfirming(null);
    }
  }

  if (approvedAds.length === 0) {
    return (
      <div className="meta-card text-center py-16 px-6">
        <ImageIcon className="w-12 h-12 text-[var(--muted)] mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">No approved creatives yet</h2>
        <p className="text-[var(--muted)] text-sm mb-6 max-w-md mx-auto">
          Clone competitor ads and approve creatives in Ad Generation, then return here to launch.
        </p>
        <Link href="/ads" className="btn-primary inline-flex items-center gap-2">
          Go to Ad Generation →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Launch Campaign</h1>
        <p className="text-[var(--muted)] mt-1 text-sm">
          Simple Meta campaign setup — all fields map directly to Facebook Ads Manager
        </p>
      </div>

      {/* Meta status bar */}
      <div
        className={`meta-card p-4 mb-2 flex flex-col sm:flex-row sm:items-center gap-3 ${
          metaConnected ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'
        }`}
      >
        {metaConnected ? (
          <Check className="w-5 h-5 text-[var(--meta-green)] shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
        )}
        <p className="text-sm flex-1">
          {metaConnected
            ? 'Meta connected — campaigns sync as PAUSED until you confirm launch.'
            : 'Meta not connected — you can save drafts locally. Connect with Facebook to publish live (we pull your ad account automatically).'}
        </p>
        {!metaConnected && (
          <a
            href="/api/oauth/meta/connect"
            className="btn-primary text-sm inline-flex items-center gap-2 shrink-0"
          >
            <Link2 className="w-4 h-4" /> Connect with Facebook
          </a>
        )}
      </div>

      {toast && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">
          {error}
        </div>
      )}
      {prefillBanner && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-sm px-4 py-3">
          {prefillBanner}
        </div>
      )}

      <WizardStepper steps={WIZARD_STEPS} currentStep={step} completedSteps={completedSteps} />

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Main form */}
        <div className="lg:col-span-3 space-y-4">
          {/* Step 0: Goal */}
          {step === 0 && (
            <div className="meta-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-5 h-5 text-[var(--meta-blue)]" />
                <h2 className="font-semibold text-lg">What&apos;s your campaign goal?</h2>
              </div>
              <div>
                <label className="label">Quick start template</label>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {CAMPAIGN_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t.id)}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${
                        selectedTemplateId === t.id
                          ? 'border-[var(--meta-blue)] bg-blue-50'
                          : 'border-[var(--border)] hover:border-blue-200'
                      }`}
                    >
                      <span className="text-lg">{t.emoji}</span>
                      <p className="font-semibold text-sm mt-1">{t.name}</p>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5 line-clamp-2">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Campaign name</label>
                <input
                  className="input"
                  placeholder="e.g. Festive Sale · Traffic"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {CAMPAIGN_OBJECTIVES.map((obj) => (
                  <button
                    key={obj.value}
                    type="button"
                    onClick={() => setObjective(obj.value)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      objective === obj.value
                        ? 'border-[var(--meta-blue)] bg-blue-50'
                        : 'border-[var(--border)] hover:border-blue-200'
                    }`}
                  >
                    <p className="font-semibold text-sm">{obj.label}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">{obj.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Audience */}
          {step === 1 && (
            <div className="meta-card p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--meta-blue)]" />
                <h2 className="font-semibold text-lg">Who should see your ads?</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Age min</label>
                  <input type="number" className="input" min={13} max={65} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
                </div>
                <div>
                  <label className="label">Age max</label>
                  <input type="number" className="input" min={13} max={65} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Gender</label>
                <div className="flex gap-2">
                  {(['ALL', 'MEN', 'WOMEN'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        gender === g
                          ? 'border-[var(--meta-blue)] bg-blue-50 text-[var(--meta-blue)]'
                          : 'border-[var(--border)]'
                      }`}
                    >
                      {g === 'ALL' ? 'All' : g === 'MEN' ? 'Men' : 'Women'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Cities (comma-separated)
                </label>
                <input className="input" value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="Mumbai, Delhi, Bengaluru" />
                <p className="text-xs text-[var(--muted)] mt-1">Resolved to Meta city IDs automatically</p>
              </div>
              <div>
                <label className="label">Interests (comma-separated)</label>
                <input className="input" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="Online shopping, Fashion" />
              </div>
            </div>
          )}

          {/* Step 2: Budget */}
          {step === 2 && (
            <div className="meta-card p-6 space-y-5">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-[var(--meta-blue)]" />
                <h2 className="font-semibold text-lg">Budget &amp; schedule</h2>
              </div>
              <div className="flex gap-2">
                {(['daily', 'lifetime'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBudgetType(t)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      budgetType === t
                        ? 'border-[var(--meta-blue)] bg-blue-50 text-[var(--meta-blue)]'
                        : 'border-[var(--border)]'
                    }`}
                  >
                    {t === 'daily' ? 'Daily budget' : 'Lifetime budget'}
                  </button>
                ))}
              </div>
              <div>
                <label className="label">Amount (₹)</label>
                <input type="number" className="input" min={100} step={50} value={budget} onChange={(e) => setBudget(e.target.value)} />
                <p className="text-xs text-[var(--muted)] mt-1">Minimum ₹100</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Start date
                  </label>
                  <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">End date (optional)</label>
                  <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5" /> Placements
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['fb_feed', 'Facebook Feed'],
                      ['ig_feed', 'Instagram Feed'],
                      ['stories', 'Stories'],
                      ['reels', 'Reels'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => togglePlacement(key)}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium border text-left transition-colors ${
                        placements[key]
                          ? 'border-[var(--meta-blue)] bg-blue-50 text-[var(--meta-blue)]'
                          : 'border-[var(--border)] text-[var(--muted)]'
                      }`}
                    >
                      {placements[key] && <Check className="w-3.5 h-3.5 inline mr-1" />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Destination URL</label>
                <input type="url" className="input" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://yourstore.com" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">CTA button</label>
                  <select className="input" value={cta} onChange={(e) => setCta(e.target.value)}>
                    {META_CTA_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Link description (optional)</label>
                  <input className="input" maxLength={30} value={linkDescription} onChange={(e) => setLinkDescription(e.target.value)} placeholder="Free shipping" />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Creatives */}
          {step === 3 && (
            <div className="meta-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[var(--meta-blue)]" />
                <h2 className="font-semibold text-lg">
                  Select creatives ({selectedAds.length}/{approvedAds.length})
                </h2>
              </div>
              <div className="space-y-2 max-h-[480px] overflow-y-auto">
                {approvedAds.map((ad) => {
                  const selected = selectedAds.includes(ad.id);
                  const format = META_AD_FORMATS[ad.ad_format as keyof typeof META_AD_FORMATS];
                  return (
                    <button
                      key={ad.id}
                      type="button"
                      onClick={() => toggleAd(ad.id)}
                      className={`w-full flex gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? 'border-[var(--meta-green)] bg-green-50/50'
                          : 'border-[var(--border)] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {ad.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            {format?.shortLabel || 'Image'}
                          </span>
                          {selected && <Check className="w-3.5 h-3.5 text-[var(--meta-green)]" />}
                        </div>
                        <p className="text-sm font-medium truncate mt-0.5">
                          {ad.headline || `Variant #${ad.variant_number}`}
                        </p>
                        <p className="text-xs text-[var(--muted)] line-clamp-2">{ad.copy_text}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="meta-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5 text-[var(--meta-blue)]" />
                  <h2 className="font-semibold text-lg">Review your campaign</h2>
                </div>
                <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-[var(--muted)]">Objective</dt><dd className="font-medium">{CAMPAIGN_OBJECTIVES.find((o) => o.value === objective)?.label}</dd></div>
                  <div><dt className="text-[var(--muted)]">Budget</dt><dd className="font-medium">{formatCurrency(Number(budget))}{budgetType === 'daily' ? '/day' : ' total'}</dd></div>
                  <div><dt className="text-[var(--muted)]">Audience</dt><dd className="font-medium">India · {ageMin}–{ageMax} · {gender === 'ALL' ? 'All genders' : gender}</dd></div>
                  <div><dt className="text-[var(--muted)]">Creatives</dt><dd className="font-medium">{selectedAds.length} selected</dd></div>
                  <div className="sm:col-span-2"><dt className="text-[var(--muted)]">Destination</dt><dd className="font-medium truncate">{websiteUrl}</dd></div>
                </dl>
              </div>
              <ValidationChecklist items={validation?.items || []} loading={validating} />
            </div>
          )}

          {/* Step 5: Launch */}
          {step === 5 && (
            <div className="meta-card p-6 space-y-5 text-center">
              <Rocket className="w-12 h-12 text-[var(--meta-blue)] mx-auto" />
              <h2 className="font-semibold text-xl">
                {lastLaunchMetaSynced ? 'Ready to launch' : 'Draft saved'}
              </h2>
              <p className="text-sm text-[var(--muted)] max-w-sm mx-auto">
                {lastLaunchMetaSynced ? (
                  <>
                    Your campaign is created as <strong>PAUSED</strong> on Meta. Confirm below to go
                    live on Facebook &amp; Instagram.
                  </>
                ) : (
                  <>
                    Local draft is saved
                    {lastLaunchMetaError
                      ? ', but Meta sync failed. Confirm will retry publishing to Meta.'
                      : '. Connect Meta or Confirm to publish when ready.'}
                  </>
                )}
              </p>
              {lastLaunchedId && (
                <button
                  type="button"
                  className="btn-primary inline-flex items-center gap-2 mx-auto"
                  onClick={() => handleConfirm(lastLaunchedId)}
                  disabled={confirming === lastLaunchedId}
                >
                  {confirming === lastLaunchedId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Rocket className="w-4 h-4" />
                  )}
                  Confirm &amp; Go Live
                </button>
              )}
            </div>
          )}

          {/* Navigation */}
          {step < 5 && (
            <div className="flex justify-between gap-3 pt-2">
              <button
                type="button"
                className="btn-secondary flex items-center gap-1"
                onClick={prevStep}
                disabled={step === 0}
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              {step < 4 ? (
                <button type="button" className="btn-primary flex items-center gap-1" onClick={nextStep}>
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleLaunch(true)}
                    disabled={launching}
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    className="btn-primary flex items-center gap-2"
                    onClick={() => handleLaunch(false)}
                    disabled={launching || (validation !== null && !validation.can_launch)}
                  >
                    {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    Create on Meta
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview sidebar */}
        <div className="lg:col-span-2">
          <div className="meta-card p-5 sticky top-24">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">
              Live preview
            </p>
            <p className="text-[11px] text-[var(--muted)] mb-4">
              Same layout as Facebook Ads Manager / Ad Library feed
            </p>
            <FacebookAdPreview
              headline={previewAd?.headline || undefined}
              primaryText={previewAd?.copy_text}
              imageUrl={
                previewAd?.image_url
                  ? /^https?:\/\//i.test(previewAd.image_url)
                    ? `/api/ads/product-image?src=${encodeURIComponent(previewAd.image_url)}`
                    : previewAd.image_url
                  : undefined
              }
              cta={cta}
              pageName={
                (typeof previewAd?.headline === 'string' &&
                (previewAd.headline.includes('·') || previewAd.headline.includes('-'))
                  ? previewAd.headline.split(/[·\-]/)[0]?.trim()
                  : null) ||
                (previewAd?.media_payload as { product_name?: string } | undefined)?.product_name
                  ?.split('|')[0]
                  ?.trim() ||
                'Your Brand'
              }
              linkDisplay={
                websiteUrl
                  ? (() => {
                      try {
                        return new URL(websiteUrl).hostname;
                      } catch {
                        return websiteUrl;
                      }
                    })()
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* Existing campaigns */}
      {campaigns.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Megaphone className="w-5 h-5" /> Your campaigns
          </h2>
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="meta-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{c.name || c.objective}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--muted)] mt-0.5">
                    {formatCurrency(c.budget || 0)}/day · {new Date(c.created_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
                {c.status === 'draft' && (
                  <button
                    type="button"
                    className="btn-primary text-sm flex items-center gap-2 shrink-0"
                    onClick={() => handleConfirm(c.id)}
                    disabled={confirming === c.id}
                  >
                    {confirming === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    Confirm &amp; Launch
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
