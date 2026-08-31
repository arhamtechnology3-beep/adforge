'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveCampaignPrefill } from '@/lib/campaign-prefill';
import {
  Sparkles,
  Check,
  Pencil,
  Loader2,
  Image as ImageIcon,
  LayoutGrid,
  Smartphone,
  Clapperboard,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Swords,
  ShieldCheck,
  ExternalLink,
  Eye,
  Radio,
  Flame,
  CheckCircle2,
  Rocket,
  Info,
  Plus,
  Trash2,
} from 'lucide-react';
import type { CompetitorIntel, MetaAdLibraryAd } from '@/lib/ai';
import { performanceBadgeClass } from '@/lib/ad-performance';
import { normalizeCreativeUrl } from '@/lib/app-url';
import { META_AD_FORMATS, type MetaAdFormat } from '@/lib/creatives';
import type { AdFormat, GeneratedAd } from '@/types/database';

const FORMAT_FILTERS: { id: 'all' | MetaAdFormat; label: string; icon: typeof ImageIcon }[] = [
  { id: 'all', label: 'All formats', icon: LayoutGrid },
  { id: 'single_image', label: 'Image', icon: ImageIcon },
  { id: 'carousel', label: 'Carousel', icon: LayoutGrid },
  { id: 'stories', label: 'Stories', icon: Smartphone },
  { id: 'video', label: 'Video', icon: Clapperboard },
];

function normalizeLoadedAd(ad: GeneratedAd): GeneratedAd {
  const payload = ad.media_payload;
  return {
    ...ad,
    image_url: ad.image_url ? normalizeCreativeUrl(ad.image_url) : ad.image_url,
    media_payload: payload
      ? {
          ...payload,
          cards: payload.cards?.map((c) => ({
            ...c,
            image_url: normalizeCreativeUrl(c.image_url),
          })),
          frames: payload.frames?.map((f) => ({
            ...f,
            image_url: normalizeCreativeUrl(f.image_url),
          })),
        }
      : payload,
  };
}

function normalizeFormat(ad: GeneratedAd): MetaAdFormat {
  const f = ad.ad_format as MetaAdFormat | undefined;
  if (f && META_AD_FORMATS[f]) return f;
  try {
    const url = ad.image_url || '';
    const fromQuery = new URL(url, 'http://localhost').searchParams.get('ad_format') as MetaAdFormat | null;
    if (fromQuery && META_AD_FORMATS[fromQuery]) return fromQuery;
    if (url.includes('format=story_9x16')) return 'stories';
  } catch {
    /* ignore */
  }
  return 'single_image';
}

function CreativePreview({
  url,
  variant,
  aspect = 'square',
}: {
  url: string;
  variant: number;
  aspect?: 'square' | 'story';
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setStatus('loading');
    const t = window.setTimeout(() => {
      setStatus((s) => (s === 'loading' ? 'error' : s));
    }, 25000);
    return () => window.clearTimeout(t);
  }, [url]);

  return (
    <div
      className={`relative w-full bg-gray-200 overflow-hidden ${
        aspect === 'story' ? 'aspect-[9/16] max-h-[420px] mx-auto' : 'aspect-square'
      }`}
    >
      {status !== 'ready' && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center text-xs text-muted px-4 text-center">
          {status === 'error' ? 'Creative failed — click Regenerate' : 'Rendering creative…'}
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Meta creative ${variant}`}
        className={`relative w-full h-full object-cover transition-opacity ${
          status === 'ready' ? 'opacity-100' : 'opacity-0'
        }`}
        loading="eager"
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
      />
    </div>
  );
}

function CarouselPreview({ ad }: { ad: GeneratedAd }) {
  const cards = ad.media_payload?.cards || [];
  const [idx, setIdx] = useState(0);
  if (cards.length === 0 && ad.image_url) {
    return <CreativePreview url={ad.image_url} variant={ad.variant_number} />;
  }

  const card = cards[idx];
  return (
    <div className="relative">
      {card && (
        <CreativePreview url={card.image_url} variant={ad.variant_number} />
      )}
      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2 z-10">
        <button
          type="button"
          className="p-1.5 rounded-full bg-black/50 text-white"
          onClick={() => setIdx((i) => (i - 1 + cards.length) % cards.length)}
          aria-label="Previous card"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex gap-1">
          {cards.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-white/40'}`}
              onClick={() => setIdx(i)}
              aria-label={`Card ${i + 1}`}
            />
          ))}
        </div>
        <button
          type="button"
          className="p-1.5 rounded-full bg-black/50 text-white"
          onClick={() => setIdx((i) => (i + 1) % cards.length)}
          aria-label="Next card"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <p className="absolute top-2 left-2 z-10 text-[10px] font-semibold uppercase tracking-wide bg-black/55 text-white px-2 py-1 rounded">
        Card {idx + 1}/{cards.length}
      </p>
    </div>
  );
}

function VeoVideoPreview({ url }: { url: string }) {
  return (
    <div className="relative aspect-square bg-black">
      <video
        src={url}
        className="w-full h-full object-cover"
        controls
        autoPlay
        muted
        loop
        playsInline
      />
      <p className="absolute top-2 left-2 z-10 text-[10px] font-semibold uppercase tracking-wide bg-black/55 text-white px-2 py-1 rounded">
        Veo video
      </p>
    </div>
  );
}

function VideoPreview({ ad }: { ad: GeneratedAd }) {
  const videoUrl = ad.media_payload?.video_url;
  if (videoUrl && /\.mp4(\?|$)/i.test(videoUrl)) {
    return <VeoVideoPreview url={videoUrl} />;
  }
  return <SlideshowVideoPreview ad={ad} />;
}

function SlideshowVideoPreview({ ad }: { ad: GeneratedAd }) {
  const frames = ad.media_payload?.frames || [];
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const ms = frames[idx]?.duration_ms || 2200;
    const t = window.setTimeout(() => {
      setIdx((i) => (i + 1) % frames.length);
    }, ms);
    return () => window.clearTimeout(t);
  }, [playing, idx, frames.length]);

  if (frames.length === 0 && ad.image_url) {
    return <CreativePreview url={ad.image_url} variant={ad.variant_number} />;
  }

  const frame = frames[idx];
  return (
    <div className="relative">
      {frame && (
        <CreativePreview
          key={`${ad.id}-${idx}`}
          url={frame.image_url}
          variant={ad.variant_number}
        />
      )}
      <button
        type="button"
        className="absolute bottom-3 right-3 z-10 p-2 rounded-full bg-black/55 text-white"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <div className="absolute bottom-3 left-3 z-10 flex gap-1">
        {frames.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-3 bg-white/40'}`}
          />
        ))}
      </div>
      <p className="absolute top-2 left-2 z-10 text-[10px] font-semibold uppercase tracking-wide bg-black/55 text-white px-2 py-1 rounded">
        Video preview · {idx + 1}/{frames.length}
      </p>
    </div>
  );
}

function AdMedia({ ad }: { ad: GeneratedAd }) {
  const format = normalizeFormat(ad);
  if (format === 'carousel') return <CarouselPreview ad={ad} />;
  if (format === 'video') return <VideoPreview ad={ad} />;
  if (format === 'stories') {
    return (
      <div className="bg-[#111] py-3">
        <CreativePreview url={ad.image_url || ''} variant={ad.variant_number} aspect="story" />
      </div>
    );
  }
  return <CreativePreview url={ad.image_url || ''} variant={ad.variant_number} />;
}

export default function AdsPage() {
  const router = useRouter();
  const [campaignInputId, setCampaignInputId] = useState<string | null>(null);
  const [ads, setAds] = useState<GeneratedAd[]>([]);
  const [competitorIntel, setCompetitorIntel] = useState<CompetitorIntel[]>([]);
  const [compTab, setCompTab] = useState<'strategy' | 'meta_ads'>('meta_ads');
  const [activeStep, setActiveStep] = useState<
    'step1_select_competitor' | 'step2_our_counter_ads'
  >('step1_select_competitor');
  const [selectedCompetitorAdIds, setSelectedCompetitorAdIds] = useState<string[]>([]);
  const [selectedLibraryAds, setSelectedLibraryAds] = useState<MetaAdLibraryAd[]>([]);
  const [loadingLiveMeta, setLoadingLiveMeta] = useState(false);
  const [liveMetaFetched, setLiveMetaFetched] = useState(false);
  const [liveMetaError, setLiveMetaError] = useState<string | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualForm, setManualForm] = useState({
    headline: '',
    copy_text: '',
    image_url: '',
    ad_format: 'single_image' as MetaAdFormat,
  });
  const [editForm, setEditForm] = useState<{
    id: string;
    headline: string;
    copy_text: string;
    image_url: string;
    ad_format: MetaAdFormat;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<'all' | MetaAdFormat>('all');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  function goToCampaignLaunch(adsList: MetaAdLibraryAd[] = selectedLibraryAds) {
    const platforms = new Set(
      adsList.flatMap((a) => (a.publisher_platforms || []).map((p) => p.toLowerCase()))
    );
    const ctaRaw = (adsList[0]?.cta || 'SHOP_NOW').toUpperCase().replace(/\s+/g, '_');
    const allowed = ['SHOP_NOW', 'ORDER_NOW', 'LEARN_MORE', 'SIGN_UP', 'GET_OFFER', 'BUY_NOW'];
    const hooks = adsList
      .map((a) => a.headline || a.primary_text?.slice(0, 60))
      .filter(Boolean)
      .slice(0, 3);
    const hasWinner = adsList.some((a) => a.performance_rating === 'WINNER');

    saveCampaignPrefill({
      fromAds: true,
      name: hasWinner ? 'Counter-Campaign — Winner Pack' : 'Counter-Campaign — D2C Pack',
      objective: 'OUTCOME_SALES',
      budget: hasWinner ? 3500 : 1500,
      budget_type: 'daily',
      cta: allowed.includes(ctaRaw) ? ctaRaw : 'SHOP_NOW',
      link_description: hooks.length ? hooks.join(' · ').slice(0, 120) : undefined,
      placements: {
        reels: platforms.has('instagram') || platforms.size === 0,
        ig_feed: platforms.has('instagram') || platforms.size === 0,
        fb_feed: platforms.has('facebook') || platforms.size === 0,
        stories: platforms.has('instagram') || platforms.has('facebook') || platforms.size === 0,
      },
    });
    router.push('/campaigns?from=ads');
  }

  useEffect(() => {
    setLoadError(null);
    fetch('/api/onboarding')
      .then((r) => r.json())
      .then((data) => {
        if (!data?.id) {
          setLoadError('Complete onboarding first — add your website and competitor URLs.');
          setLoading(false);
          return;
        }
        setCampaignInputId(data.id);
        return fetch(`/api/ads/generate?campaign_input_id=${data.id}`);
      })
      .then((r) => {
        if (!r) return null;
        if (!r.ok) throw new Error('Failed to load competitor data');
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (data?.ads) setAds(data.ads.map(normalizeLoadedAd));
        if (data?.competitor_intel) setCompetitorIntel(data.competitor_intel);
        if (data?.note && !data?.competitor_intel?.length) {
          setLoadError(data.note);
        }
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load ads page');
        setLoading(false);
      });
  }, []);

  // Auto-fetch live Ad Library ads once we have competitors
  useEffect(() => {
    if (campaignInputId && competitorIntel.length > 0 && !liveMetaFetched && !loadingLiveMeta) {
      void fetchLiveMetaAds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignInputId, competitorIntel.length]);

  async function fetchLiveMetaAds(force = false) {
    if (!campaignInputId) return;
    if (loadingLiveMeta) return;
    if (liveMetaFetched && !force) return;

    setLoadingLiveMeta(true);
    setLiveMetaError(null);
    try {
      const res = await fetch('/api/competitors/meta-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_input_id: campaignInputId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLiveMetaError(data.error || 'Failed to fetch Meta Ad Library ads');
        return;
      }
      if (data?.competitor_intel) {
        setCompetitorIntel(data.competitor_intel);
        setLiveMetaFetched(true);
      }
    } catch (err) {
      setLiveMetaError(String(err));
    } finally {
      setLoadingLiveMeta(false);
    }
  }

  // Auto-fetch live Library ads when Meta tab is active (manual refresh)
  useEffect(() => {
    if (
      activeStep === 'step1_select_competitor' &&
      compTab === 'meta_ads' &&
      campaignInputId &&
      competitorIntel.length > 0 &&
      !liveMetaFetched &&
      !loadingLiveMeta
    ) {
      void fetchLiveMetaAds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, compTab, campaignInputId, competitorIntel.length, liveMetaFetched]);

  async function uploadMediaFile(file: File): Promise<{ url: string; is_video: boolean } | null> {
    setUploadingMedia(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/ads/media/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Upload failed');
        return null;
      }
      return { url: data.url, is_video: !!data.is_video };
    } catch (err) {
      alert(String(err));
      return null;
    } finally {
      setUploadingMedia(false);
    }
  }

  function toggleCompetitorAdSelection(ad: MetaAdLibraryAd | string) {
    if (typeof ad === 'string') {
      setSelectedCompetitorAdIds((prev) =>
        prev.includes(ad) ? prev.filter((id) => id !== ad) : [...prev, ad]
      );
      return;
    }
    setSelectedCompetitorAdIds((prev) =>
      prev.includes(ad.id) ? prev.filter((id) => id !== ad.id) : [...prev, ad.id]
    );
    setSelectedLibraryAds((prev) => {
      const exists = prev.some((a) => a.id === ad.id);
      const next = exists ? prev.filter((a) => a.id !== ad.id) : [...prev, ad];
      return next;
    });
  }

  async function handleGenerate() {
    if (!campaignInputId) return;
    if (selectedLibraryAds.length === 0 && selectedCompetitorAdIds.length === 0) {
      alert('Select at least one competitor ad in Step 1 (prefer ads with Best performer / Strong runner badges).');
      return;
    }
    setGenerating(true);

    const selected_ads = selectedLibraryAds.map((ad) => {
      const hostBrand =
        competitorIntel.find((c) => (c.live_meta_ads || []).some((x) => x.id === ad.id))?.brand ||
        null;
      return {
        id: ad.id,
        library_id: ad.library_id,
        primary_text: ad.primary_text,
        headline: ad.headline,
        cta: ad.cta,
        ad_format: ad.ad_format,
        media_url: ad.media_url,
        performance_rating: ad.performance_rating,
        performance_label: ad.performance_label,
        brand: hostBrand,
      };
    });

    const res = await fetch('/api/ads/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_input_id: campaignInputId,
        selected_ads,
        selected_competitor_ad_ids: selectedCompetitorAdIds,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to generate ads');
      setGenerating(false);
      return;
    }
    if (data.ads) {
      setAds(data.ads.map(normalizeLoadedAd));
    }
    if (data.competitor_intel) setCompetitorIntel(data.competitor_intel);
    setFormatFilter('all');
    setActiveStep('step2_our_counter_ads');
    setGenerating(false);
    setToastMessage(
      data.note || `Created ${data.count || 0} creatives from your selected ads`
    );
    setTimeout(() => setToastMessage(null), 4000);
  }

  async function handleManualAdd() {
    if (!campaignInputId) return;
    const res = await fetch('/api/ads/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_input_id: campaignInputId, ...manualForm }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to add ad');
      return;
    }
    setAds((prev) => [...prev, data]);
    setShowManualAdd(false);
    setManualForm({ headline: '', copy_text: '', image_url: '', ad_format: 'single_image' });
    setToastMessage('Manual ad added — edit & approve when ready');
    setTimeout(() => setToastMessage(null), 3000);
  }

  async function handleFullSaveEdit() {
    if (!editForm) return;
    const res = await fetch(`/api/ads/${editForm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headline: editForm.headline.slice(0, 40),
        copy_text: editForm.copy_text.slice(0, 2200),
        image_url: editForm.image_url,
        ad_format: editForm.ad_format,
        media_payload: {
          manual: true,
          aspect: editForm.ad_format === 'stories' ? '9:16' : '1:1',
          product_images: editForm.image_url ? [editForm.image_url] : [],
        },
      }),
    });
    const updated = await res.json();
    if (!res.ok) {
      alert(updated.error || 'Failed to save');
      return;
    }
    setAds((prev) => prev.map((a) => (a.id === editForm.id ? { ...a, ...updated } : a)));
    setEditForm(null);
    setEditingId(null);
  }

  async function handleDeleteAd(id: string) {
    if (!confirm('Remove this creative?')) return;
    const res = await fetch(`/api/ads/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to delete');
      return;
    }
    setAds((prev) => prev.filter((a) => a.id !== id));
  }

  async function updateAd(id: string, status?: string, copy_text?: string) {
    const res = await fetch(`/api/ads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, copy_text }),
    });

    const updated = await res.json();
    setAds((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
    setEditingId(null);
  }

  const approved = ads.filter((a) => a.status === 'approved');
  const approvedCount = approved.length;
  const filtered =
    formatFilter === 'all' ? ads : ads.filter((a) => normalizeFormat(a) === formatFilter);

  const counts = ads.reduce<Record<string, number>>((acc, ad) => {
    const f = normalizeFormat(ad);
    acc[f] = (acc[f] || 0) + 1;
    return acc;
  }, {});

  const approvedByFormat = approved.reduce<Record<string, number>>((acc, ad) => {
    const f = normalizeFormat(ad);
    acc[f] = (acc[f] || 0) + 1;
    return acc;
  }, {});

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
        <p className="text-muted mb-4">Add your website & competitors, then generate Meta-ready creatives.</p>
        <a href="/onboarding" className="btn-primary">
          Go to Onboarding
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ad Generation & Competitor Benchmark</h1>
          <p className="text-muted mt-1">
            Select competitor Meta Ads to outcompete, generate custom counter-creatives, then launch
          </p>
        </div>
      </div>

      {/* Step Navigation Bar */}
      <div className="bg-white border border-purple-200 p-3 rounded-2xl mb-6 flex flex-col lg:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            type="button"
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeStep === 'step1_select_competitor'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setActiveStep('step1_select_competitor')}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] shrink-0">1</span>
            Step 1: Pick best ads ({selectedCompetitorAdIds.length})
          </button>

          <button
            type="button"
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeStep === 'step2_our_counter_ads'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setActiveStep('step2_our_counter_ads')}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] shrink-0">2</span>
            Step 2: Replicate &amp; edit ({ads.length})
          </button>

          {approvedCount > 0 && (
            <button
              type="button"
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 bg-[var(--meta-blue)] text-white shadow-md"
              onClick={() => goToCampaignLaunch(selectedLibraryAds)}
            >
              <Rocket className="w-4 h-4" /> Launch on Meta →
            </button>
          )}
        </div>

        <button
          className="w-full lg:w-auto btn-primary flex items-center justify-center gap-2 text-xs py-2.5 px-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 font-bold text-white shadow-md"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {ads.length > 0 ? 'Regenerate from selection' : 'Generate & Replicate'}
        </button>
      </div>

      {loadError && (
        <div className="mb-6 meta-card p-4 border-amber-200 bg-amber-50 text-amber-900 text-sm">
          {loadError}{' '}
          <a href="/onboarding" className="font-semibold text-[var(--meta-blue)] hover:underline">
            Go to Onboarding →
          </a>
        </div>
      )}

      {loading && (
        <div className="meta-card p-12 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--meta-blue)] mb-3" />
          <p className="text-sm text-[var(--muted)]">Loading competitor ads from Meta Ad Library…</p>
        </div>
      )}

      {!loading && activeStep === 'step1_select_competitor' && competitorIntel.length === 0 && (
        <div className="meta-card p-10 text-center">
          <Swords className="w-12 h-12 text-[var(--muted)] mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">No competitors configured yet</h2>
          <p className="text-sm text-[var(--muted)] mb-6 max-w-md mx-auto">
            Add your website and at least one competitor URL in onboarding. We&apos;ll fetch their live Meta ads for you to clone.
          </p>
          <a href="/onboarding" className="btn-primary inline-flex items-center gap-2">
            Complete onboarding →
          </a>
        </div>
      )}

      {activeStep === 'step1_select_competitor' && competitorIntel.length > 0 && (
        <div className="mb-6 border border-purple-200 bg-gradient-to-r from-purple-50/90 via-indigo-50/70 to-blue-50/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-600 text-white shadow-md">
                <Swords className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-gray-900 flex items-center gap-2">
                  Competitor Intelligence
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 uppercase tracking-wider border border-slate-300">
                    Website intel · Meta Library link
                  </span>
                </h2>
                <p className="text-xs text-muted">
                  We scrape the competitor website for positioning. Live Meta creatives/spend are not available without the official Ad Library API.
                </p>
              </div>
            </div>

            <div className="flex bg-white/80 border border-purple-100 p-1 rounded-xl shrink-0 text-xs">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                  compTab === 'strategy' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => setCompTab('strategy')}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Counter Strategy
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                  compTab === 'meta_ads' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => setCompTab('meta_ads')}
              >
                <Radio className="w-3.5 h-3.5" /> Meta Ad Library
              </button>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-950 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              <strong>How to pick winners:</strong> Ads are sorted like Meta Ad Library (total impressions).
              Badges use Library rank + how long the ad has been running. Meta does <strong>not</strong> publish
              commercial spend/ROAS for these ads — choose creatives that match your product, then we replicate
              them with your store assets in Step 2.
            </p>
          </div>

          {compTab === 'strategy' ? (
            <div className="grid md:grid-cols-3 gap-4">
              {competitorIntel.map((comp, idx) => (
                <div key={idx} className="bg-white/95 backdrop-blur rounded-xl p-4 border border-purple-100 shadow-sm flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-gray-900 truncate">{comp.brand}</span>
                      <a
                        href={comp.meta_ad_library_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-indigo-600 hover:underline inline-flex items-center gap-1 shrink-0 font-semibold bg-indigo-50 px-2 py-0.5 rounded"
                      >
                        Meta Ad Library <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    
                    <p className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded-md mb-2">
                      {comp.positioning}
                    </p>

                    <div className="text-xs text-gray-600 space-y-1">
                      <p className="line-clamp-2 italic text-[11px]">&quot;{comp.hook}&quot;</p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-gray-100 bg-emerald-50/80 -mx-4 -mb-4 p-3 rounded-b-xl">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Our Counter-Strategy
                    </p>
                    <p className="text-xs text-emerald-950 font-medium leading-snug">
                      {comp.counterAngle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  {loadingLiveMeta ? (
                    <span className="inline-flex items-center gap-2 font-medium text-indigo-700">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Fetching live ads from Meta Ad Library…
                    </span>
                  ) : liveMetaError ? (
                    <span className="text-red-700">{liveMetaError}</span>
                  ) : (
                    <span>
                      {competitorIntel.reduce((n, c) => n + (c.live_meta_ads?.length || 0), 0)} live Library ads loaded
                      {competitorIntel[0]?.library_fetch_note
                        ? ` · ${competitorIntel[0].library_fetch_note}`
                        : ''}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 inline-flex items-center gap-1.5 disabled:opacity-60"
                  onClick={() => fetchLiveMetaAds(true)}
                  disabled={loadingLiveMeta || !campaignInputId}
                >
                  {loadingLiveMeta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                  Refresh from Ad Library
                </button>
              </div>

              {competitorIntel.map((comp, idx) => {
                const adsList = [...(comp.live_meta_ads || [])].sort(
                  (a, b) => (b.performance_score || 0) - (a.performance_score || 0)
                );
                return (
                  <div key={idx} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                          {comp.brand.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-gray-900 truncate">{comp.brand}</h3>
                          <p className="text-[11px] text-muted truncate">
                            {comp.domain}
                            {comp.meta_page_id ? ` · Page ${comp.meta_page_id}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {adsList.length} live ads
                        </span>
                        <a
                          href={comp.meta_ad_library_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-indigo-600 hover:underline inline-flex items-center gap-1 font-semibold"
                        >
                          Open in Library <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {adsList.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-indigo-200 bg-white/80 p-4 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900 mb-1">No live ads ingested yet</p>
                        <p className="text-xs text-muted leading-relaxed mb-3">
                          {comp.library_fetch_note ||
                            'Add Meta Page ID in onboarding (from Ad Library URL), then refresh. farmdidi.com resolves automatically to Page 108788791719221.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={comp.meta_ad_library_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs btn-secondary py-2 px-3 inline-flex items-center gap-1.5 text-indigo-700 bg-indigo-50 border-indigo-200 font-semibold"
                          >
                            <Eye className="w-3.5 h-3.5" /> Open Meta Ad Library
                          </a>
                          <button
                            type="button"
                            className="text-xs font-bold py-2 px-3 rounded-lg border bg-purple-50 text-purple-900 border-purple-200"
                            onClick={() => toggleCompetitorAdSelection(`competitor:${comp.url}`)}
                          >
                            Select competitor anyway
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {adsList.map((ad) => {
                          const selected = selectedCompetitorAdIds.includes(ad.id);
                          return (
                            <div
                              key={ad.id}
                              className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col ${
                                selected ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-purple-100'
                              }`}
                            >
                              <div className="relative aspect-[4/5] bg-gray-100">
                                {ad.media_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={`/api/competitor-media/proxy?url=${encodeURIComponent(ad.media_url)}`}
                                    alt={ad.headline || comp.brand}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs text-muted p-4 text-center">
                                    Creative preview unavailable — open Library snapshot
                                  </div>
                                )}
                                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                                  {ad.performance_label && (
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${performanceBadgeClass(
                                        ad.performance_rating
                                      )}`}
                                    >
                                      {ad.performance_rating === 'WINNER' ? '★ ' : ''}
                                      {ad.performance_label}
                                      {ad.library_rank ? ` · #${ad.library_rank}` : ''}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                                    {ad.active_status}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white uppercase">
                                    {ad.ad_format.replace('_', ' ')}
                                  </span>
                                </div>
                              </div>
                              <div className="p-3 space-y-2 flex-1 flex flex-col">
                                <p className="text-[10px] text-muted font-mono">Library ID {ad.library_id}</p>
                                {ad.headline && (
                                  <p className="text-sm font-bold text-gray-900 line-clamp-2">{ad.headline}</p>
                                )}
                                {ad.performance_reason && (
                                  <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 leading-snug">
                                    <Flame className="w-3 h-3 inline mr-1 text-amber-600" />
                                    {ad.performance_reason}
                                    {ad.runtime_days != null ? ` · ${ad.runtime_days}d live` : ''}
                                    {ad.performance_score != null ? ` · score ${ad.performance_score}` : ''}
                                  </p>
                                )}
                                <p className="text-xs text-gray-700 line-clamp-4 flex-1">
                                  {ad.primary_text || 'No primary text captured'}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {(ad.publisher_platforms || []).slice(0, 4).map((p) => (
                                    <span
                                      key={p}
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                                    >
                                      {p}
                                    </span>
                                  ))}
                                  {ad.started_date && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-600">
                                      Started {ad.started_date}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-2 pt-1">
                                  {(ad.snapshot_url || comp.meta_ad_library_url) && (
                                    <a
                                      href={ad.snapshot_url || comp.meta_ad_library_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex-1 text-[11px] font-semibold py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 text-center"
                                    >
                                      View in Library
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    className={`flex-1 text-[11px] font-bold py-2 rounded-lg border ${
                                      selected
                                        ? 'bg-emerald-600 text-white border-emerald-700'
                                        : 'bg-purple-50 text-purple-900 border-purple-200'
                                    }`}
                                    onClick={() => toggleCompetitorAdSelection(ad)}
                                  >
                                    {selected ? 'Selected' : 'Select to replicate'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Floating Action Bar for Step 1 Competitor Ad Selection */}
      {activeStep === 'step1_select_competitor' && selectedCompetitorAdIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-purple-950/95 backdrop-blur text-white border border-purple-500/40 px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shadow">
              {selectedLibraryAds.length || selectedCompetitorAdIds.length}
            </span>
            <p className="text-xs font-semibold">
              Selected — we&apos;ll replicate these with your products
            </p>
          </div>

          <button
            type="button"
            className="btn-primary text-xs py-2.5 px-5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 font-bold text-white shadow-lg flex items-center gap-1.5"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate &amp; Replicate →
          </button>
        </div>
      )}

      {/* Step 2 Content: Rendered strictly when activeStep === 'step2_our_counter_ads' */}
      {activeStep === 'step2_our_counter_ads' && (
        <div className="space-y-6">
          {selectedLibraryAds.length > 0 && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-indigo-950">
                  Selected competitor ads ({selectedLibraryAds.length}) — replicated below with your products
                </h3>
                <button
                  type="button"
                  className="text-xs font-semibold text-indigo-700 hover:underline"
                  onClick={() => setActiveStep('step1_select_competitor')}
                >
                  Change selection
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {selectedLibraryAds.map((ad) => (
                  <div
                    key={ad.id}
                    className="min-w-[160px] max-w-[180px] bg-white rounded-xl border border-indigo-100 overflow-hidden shrink-0"
                  >
                    {ad.media_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/competitor-media/proxy?url=${encodeURIComponent(ad.media_url)}`}
                        alt=""
                        className="h-24 w-full object-cover"
                      />
                    )}
                    <div className="p-2 space-y-1">
                      {ad.performance_label && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${performanceBadgeClass(
                            ad.performance_rating
                          )}`}
                        >
                          {ad.performance_label}
                        </span>
                      )}
                      <p className="text-[11px] font-semibold line-clamp-2">{ad.headline || ad.library_id}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {ads.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {FORMAT_FILTERS.map(({ id, label, icon: Icon }) => {
                  const count = id === 'all' ? ads.length : counts[id] || 0;
                  const active = formatFilter === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFormatFilter(id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        active
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-foreground border-[var(--border)] hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                      <span className={`text-xs ${active ? 'text-white/80' : 'text-muted'}`}>({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              className="text-xs font-bold px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 inline-flex items-center gap-1.5"
              onClick={() => setShowManualAdd((v) => !v)}
            >
              <Plus className="w-3.5 h-3.5" /> Add my ad manually
            </button>
          </div>

          {showManualAdd && (
            <div className="card p-4 space-y-3 border-emerald-200">
              <h4 className="text-sm font-bold">Manual creative</h4>
              <p className="text-xs text-muted">
                Upload image/video or paste a URL. Headline ≤40 · primary text ≤125 ideal (Meta).
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  className="input text-sm"
                  placeholder="Headline (max 40)"
                  value={manualForm.headline}
                  onChange={(e) => setManualForm((f) => ({ ...f, headline: e.target.value }))}
                />
                <select
                  className="input text-sm"
                  value={manualForm.ad_format}
                  onChange={(e) =>
                    setManualForm((f) => ({ ...f, ad_format: e.target.value as MetaAdFormat }))
                  }
                >
                  <option value="single_image">Single image</option>
                  <option value="carousel">Carousel</option>
                  <option value="stories">Stories</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <label className="btn-secondary text-xs py-2 px-3 inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
                  {uploadingMedia ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Upload image / video
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    disabled={uploadingMedia}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      const uploaded = await uploadMediaFile(file);
                      if (!uploaded) return;
                      setManualForm((f) => ({
                        ...f,
                        image_url: uploaded.url,
                        ad_format: uploaded.is_video ? 'video' : f.ad_format,
                      }));
                    }}
                  />
                </label>
                <input
                  className="input text-sm flex-1"
                  placeholder="Or paste image / video URL (https://…)"
                  value={manualForm.image_url}
                  onChange={(e) => setManualForm((f) => ({ ...f, image_url: e.target.value }))}
                />
              </div>
              {manualForm.image_url && (
                <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50 max-h-40 flex items-center justify-center">
                  {/\.(mp4|webm|mov)(\?|$)/i.test(manualForm.image_url) ||
                  manualForm.ad_format === 'video' ? (
                    <video src={manualForm.image_url} className="max-h-40" controls muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={manualForm.image_url} alt="Preview" className="max-h-40 object-contain" />
                  )}
                </div>
              )}
              <textarea
                className="input text-sm min-h-[90px]"
                placeholder="Primary text (your brand only — no competitor names)"
                value={manualForm.copy_text}
                onChange={(e) => setManualForm((f) => ({ ...f, copy_text: e.target.value }))}
              />
              <div className="flex gap-2">
                <button type="button" className="btn-primary text-xs py-2" onClick={handleManualAdd}>
                  Save manual ad
                </button>
                <button type="button" className="btn-secondary text-xs py-2" onClick={() => setShowManualAdd(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {ads.length === 0 && !generating && (
            <div className="card text-center py-12">
              <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
              <p className="font-medium">No replicated ads yet</p>
              <p className="text-muted text-sm mt-1">
                Select best-performing competitor ads in Step 1, then Generate &amp; Replicate — or add your own ad manually.
              </p>
              <button
                type="button"
                className="btn-primary mt-4 inline-flex items-center gap-2 text-xs py-2 px-4"
                onClick={() => setActiveStep('step1_select_competitor')}
              >
                ← Back to Step 1
              </button>
            </div>
          )}

          {generating && (
            <div className="card text-center py-12">
              <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
              <p className="font-medium">Replicating selected ads with your products…</p>
              <p className="text-sm text-muted mt-1">
                Matching competitor format + Stories variants using your store images
              </p>
            </div>
          )}

          <div id="ads-grid" className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((ad) => {
          const format = normalizeFormat(ad);
          const meta = META_AD_FORMATS[format];
          const headline = ad.headline || null;
          const angle = ad.angle;
          const isReplicate = !!ad.media_payload?.replicate || !!ad.media_payload?.source_library_id;
          const isManual = !!ad.media_payload?.manual || angle === 'manual';

          return (
            <div
              key={ad.id}
              className={`card p-0 overflow-hidden ${
                ad.status === 'approved'
                  ? 'ring-2 ring-green-500'
                  : ad.status === 'rejected'
                    ? 'opacity-60'
                    : ''
              }`}
            >
              <div className="bg-[#f0f2f5] px-3 py-2 border-b border-[var(--border)] flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#65676b] uppercase tracking-wide truncate">
                  {meta.placement}
                </span>
                <span className="text-[11px] text-[#65676b] shrink-0">
                  {meta.shortLabel} · {meta.aspect}
                </span>
              </div>

              {ad.image_url && <AdMedia ad={ad} />}

              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-xs font-medium text-muted shrink-0">#{ad.variant_number}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 truncate">
                      {meta.label}
                    </span>
                    {isReplicate && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-800">
                        Replicated
                      </span>
                    )}
                    {isManual && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
                        Manual
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      ad.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : ad.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-muted'
                    }`}
                  >
                    {ad.status}
                  </span>
                </div>

                {ad.media_payload?.source_headline && (
                  <p className="text-[11px] text-slate-600 bg-slate-50 rounded-lg px-2 py-1.5">
                    Inspired by: <span className="font-medium">{ad.media_payload.source_headline}</span>
                  </p>
                )}

                {editForm?.id === ad.id ? (
                  <div className="space-y-2 border border-purple-100 rounded-xl p-3 bg-purple-50/40">
                    <p className="text-[10px] font-bold uppercase text-purple-900">Full edit</p>
                    <input
                      className="input text-sm"
                      value={editForm.headline}
                      onChange={(e) => setEditForm({ ...editForm, headline: e.target.value })}
                      placeholder="Headline ≤40"
                    />
                    <textarea
                      className="input text-sm min-h-[90px]"
                      value={editForm.copy_text}
                      onChange={(e) => setEditForm({ ...editForm, copy_text: e.target.value })}
                      placeholder="Primary text (your brand only)"
                    />
                    <div className="flex flex-col gap-2">
                      <label className="btn-secondary text-xs py-2 px-3 inline-flex items-center justify-center gap-1.5 cursor-pointer">
                        {uploadingMedia ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5" />
                        )}
                        Change media (image / video)
                        <input
                          type="file"
                          accept="image/*,video/mp4,video/webm,video/quicktime"
                          className="hidden"
                          disabled={uploadingMedia}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file || !editForm) return;
                            const uploaded = await uploadMediaFile(file);
                            if (!uploaded) return;
                            setEditForm({
                              ...editForm,
                              image_url: uploaded.url,
                              ad_format: uploaded.is_video ? 'video' : editForm.ad_format,
                            });
                          }}
                        />
                      </label>
                      <input
                        className="input text-sm"
                        value={editForm.image_url}
                        onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })}
                        placeholder="Or paste media URL"
                      />
                      {editForm.image_url && (
                        <div className="rounded-lg border bg-white max-h-32 overflow-hidden flex items-center justify-center">
                          {/\.(mp4|webm|mov)(\?|$)/i.test(editForm.image_url) ||
                          editForm.ad_format === 'video' ? (
                            <video src={editForm.image_url} className="max-h-32" controls muted />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={editForm.image_url}
                              alt="Media"
                              className="max-h-32 object-contain"
                            />
                          )}
                        </div>
                      )}
                    </div>
                    <select
                      className="input text-sm"
                      value={editForm.ad_format}
                      onChange={(e) =>
                        setEditForm({ ...editForm, ad_format: e.target.value as MetaAdFormat })
                      }
                    >
                      <option value="single_image">Single image</option>
                      <option value="carousel">Carousel</option>
                      <option value="stories">Stories</option>
                      <option value="video">Video</option>
                    </select>
                    <div className="flex gap-2">
                      <button className="btn-primary text-xs py-1.5" onClick={handleFullSaveEdit}>
                        Save all
                      </button>
                      <button
                        className="btn-secondary text-xs py-1.5"
                        onClick={() => {
                          setEditForm(null);
                          setEditingId(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {headline && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted mb-0.5">
                          Headline ({(headline || '').length}/40)
                        </p>
                        <p className="text-sm font-semibold">{headline}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted mb-0.5">
                        Primary text ({ad.copy_text.length} chars)
                      </p>
                      <p className="text-sm leading-relaxed">{ad.copy_text}</p>
                    </div>
                  </>
                )}

                {editForm?.id !== ad.id && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {ad.status !== 'approved' && (
                      <button
                        className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100"
                        onClick={() => updateAd(ad.id, 'approved')}
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                    {ad.status === 'approved' && (
                      <button
                        className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-amber-50 text-amber-800"
                        onClick={() => updateAd(ad.id, 'pending')}
                      >
                        Unapprove
                      </button>
                    )}
                    <button
                      className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-gray-50 text-muted hover:bg-gray-100"
                      onClick={() => {
                        setEditingId(ad.id);
                        setEditForm({
                          id: ad.id,
                          headline: ad.headline || '',
                          copy_text: ad.copy_text,
                          image_url: ad.image_url || '',
                          ad_format: normalizeFormat(ad),
                        });
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit all
                    </button>
                    <button
                      className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                      onClick={() => handleDeleteAd(ad.id)}
                      aria-label="Delete ad"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {approvedCount > 0 && (
        <div className="mt-8 card p-6 text-center space-y-3">
          <p className="font-medium">
            {approvedCount} creative{approvedCount > 1 ? 's' : ''} approved
            {Object.keys(approvedByFormat).length > 0 && (
              <span className="text-muted font-normal">
                {' '}
                (
                {Object.entries(approvedByFormat)
                  .map(([f, c]) => `${c} ${META_AD_FORMATS[f as AdFormat]?.shortLabel || f}`)
                  .join(' · ')}
                )
              </span>
            )}
          </p>
          <p className="text-sm text-muted">
            Next: launch your approved creatives in the campaign wizard.
          </p>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2 font-bold py-2.5 px-6"
            onClick={() => goToCampaignLaunch(selectedLibraryAds)}
          >
            <Rocket className="w-4 h-4" /> Launch campaign →
          </button>
        </div>
      )}
        </div>
      )}

      {/* Floating launch CTA */}
      {activeStep === 'step2_our_counter_ads' && approvedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[var(--meta-blue)] text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center">
              {approvedCount}
            </span>
            <p className="text-xs font-semibold">Approved — ready to launch</p>
          </div>
          <button
            type="button"
            className="bg-white text-[var(--meta-blue)] text-xs py-2.5 px-5 font-bold rounded-lg shadow flex items-center gap-1.5"
            onClick={() => goToCampaignLaunch(selectedLibraryAds)}
          >
            <Rocket className="w-4 h-4" /> Launch campaign →
          </button>
        </div>
      )}

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-purple-500/30 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <p className="text-xs font-medium leading-relaxed">{toastMessage}</p>
        </div>
      )}
    </div>
  );
}
