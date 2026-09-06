'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Globe,
  Users,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  PackageCheck,
  Upload,
  LayoutGrid,
} from 'lucide-react';
import { detectCompetitorType } from '@/lib/utils';
import { WizardStepper } from '@/components/campaign-wizard/WizardStepper';
import { CAROUSEL_URL_MAX, CAROUSEL_URL_MIN } from '@/lib/carousel-from-urls';
import { saveCarouselUrlPrefill } from '@/lib/carousel-url-prefill';

const STEPS = [
  { id: 'website', label: 'Your Website', shortLabel: 'Website' },
  { id: 'product', label: 'Approve Product', shortLabel: 'Product' },
  { id: 'competitors', label: 'Competitors', shortLabel: 'Competitors' },
];

const MAX_COMPETITORS = 10;

function linesToText(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join('\n');
  return typeof value === 'string' ? value : '';
}

export default function OnboardingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryStep = searchParams.get('step') ? parseInt(searchParams.get('step')!) - 1 : null;
  const connectedQuery = searchParams.get('connected') === 'true';
  const error = searchParams.get('error');

  const [step, setStep] = useState(Math.min(queryStep ?? 0, 2));
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [competitors, setCompetitors] = useState<Array<{ url: string; meta_page_id: string }>>([
    { url: '', meta_page_id: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [errorMsg, setErrorMsg] = useState(
    error ? 'Meta connection failed. You can connect Meta later from Campaigns after generating ads.' : ''
  );
  const [productId, setProductId] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [carouselExtraUrls, setCarouselExtraUrls] = useState('');
  const [brandName, setBrandName] = useState('');
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [benefits, setBenefits] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [approvedClaims, setApprovedClaims] = useState('');
  const [prohibitedClaims, setProhibitedClaims] = useState('');
  const [price, setPrice] = useState('');
  const [offer, setOffer] = useState('');
  const [primaryPackshot, setPrimaryPackshot] = useState('');
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [importingProduct, setImportingProduct] = useState(false);
  const [suggestedImages, setSuggestedImages] = useState<string[]>([]);
  const [selectedSuggestedImage, setSelectedSuggestedImage] = useState('');
  const [packshotNotice, setPackshotNotice] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const res = await fetch('/api/onboarding');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data) return;

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

        const productResponse = await fetch('/api/products');
        const productPayload = productResponse.ok ? await productResponse.json() : [];
        const products = Array.isArray(productPayload)
          ? productPayload
          : productPayload.products || [];
        const product = products[0];
        if (product) {
          setProductId(product.id);
          setProductUrl(product.product_url || '');
          setBrandName(product.brand_name || '');
          setProductName(product.product_name || '');
          setCategory(product.category || '');
          setBenefits((product.benefits || []).join('\n'));
          setIngredients((product.ingredients || []).join('\n'));
          setApprovedClaims((product.approved_claims || []).join('\n'));
          setProhibitedClaims((product.prohibited_claims || []).join('\n'));
          setPrice(product.price || '');
          setOffer(product.offer || '');
          setPrimaryPackshot(product.primary_packshot || '');
        }

        const done = new Set<number>();
        if (data.website_url) done.add(0);
        if (product?.is_approved && product?.primary_packshot) done.add(1);
        if (fromCompetitors.length > 0 || data.competitor_url) done.add(2);
        setCompletedSteps(done);

        if (queryStep === null) {
          // Meta connect is no longer part of onboarding — finish after competitors.
          if (connectedQuery) {
            router.replace('/ads');
            return;
          }
          if (fromCompetitors.length > 0 || data.competitor_url) setStep(2);
          else if (product?.is_approved && product?.primary_packshot) setStep(2);
          else if (data.website_url) setStep(1);
          else setStep(0);
        } else if (queryStep >= 3) {
          // Old ?step=4 Meta links → ads
          router.replace('/ads');
          return;
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [connectedQuery, queryStep, router]);

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

  function collectCarouselUrls(): string[] {
    const primary = productUrl.trim();
    const extras = carouselExtraUrls
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const all = [primary, ...extras].filter(Boolean);
    return [...new Set(all)].slice(0, CAROUSEL_URL_MAX);
  }

  async function saveProgress(nextStep: number | 'finish') {
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
    if (step === 0 && !brandName) {
      try {
        const host = new URL(websiteUrl).hostname.replace(/^www\./, '').split('.')[0];
        setBrandName(host.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()));
      } catch {
        // The API validates the website URL.
      }
    }

    if (nextStep === 'finish') {
      const urls = collectCarouselUrls();
      if (urls.length >= CAROUSEL_URL_MIN) {
        saveCarouselUrlPrefill(urls);
      }
      router.push('/ads');
      return;
    }

    setStep(nextStep);
    setLoading(false);
  }

  async function importPackshotFromUrl(imageUrl: string, notice?: string) {
    setUploadingProduct(true);
    setErrorMsg('');
    setSelectedSuggestedImage(imageUrl);
    try {
      const response = await fetch('/api/products/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not import product image');
      setPrimaryPackshot(data.url);
      setPackshotNotice(
        notice ||
          (data.background_removed
            ? 'Imported from product page and cleaned. Confirm the packshot looks exact, or pick another image.'
            : 'Imported from product page. Confirm it looks exact, or upload a cleaner packshot.')
      );
    } catch (uploadError) {
      setErrorMsg(uploadError instanceof Error ? uploadError.message : 'Could not import product image');
    } finally {
      setUploadingProduct(false);
    }
  }

  async function uploadPackshot(file: File) {
    setUploadingProduct(true);
    setErrorMsg('');
    try {
      const form = new FormData();
      form.append('image', file);
      const response = await fetch('/api/products/upload', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      setPrimaryPackshot(data.url);
      setPackshotNotice(
        data.background_removed
          ? 'Background removed automatically. Confirm that the product label and packaging still look exact.'
          : 'Image normalized. Transparent PNGs give the cleanest background variations.'
      );
    } catch (uploadError) {
      setErrorMsg(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setUploadingProduct(false);
    }
  }

  async function importProductPage() {
    if (!productUrl.trim()) {
      setErrorMsg('Paste the exact product page URL first.');
      return;
    }
    setImportingProduct(true);
    setErrorMsg('');
    try {
      const response = await fetch('/api/products/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_url: productUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not import product page');
      if (data.brand_name) setBrandName(data.brand_name);
      if (data.product_name) setProductName(data.product_name);
      if (data.category) setCategory(data.category);
      if (data.price) setPrice(data.price);
      if (data.offer) setOffer(data.offer);
      setBenefits(linesToText(data.benefits));
      setIngredients(linesToText(data.ingredients));
      setApprovedClaims(linesToText(data.approved_claims));
      setProhibitedClaims(linesToText(data.prohibited_claims));
      const images = Array.isArray(data.image_urls) ? data.image_urls.filter(Boolean) : [];
      setSuggestedImages(images);
      setSelectedSuggestedImage(images[0] || '');
      if (images[0]) {
        await importPackshotFromUrl(
          images[0],
          'Primary packshot imported from the product page. Click another thumbnail to switch, or upload a cleaner image.'
        );
      }
    } catch (importError) {
      setErrorMsg(importError instanceof Error ? importError.message : 'Could not import product page');
    } finally {
      setImportingProduct(false);
    }
  }

  async function saveProduct() {
    if (!brandName.trim() || !productName.trim() || !primaryPackshot) {
      setErrorMsg(
        'Brand name, product name, and a packshot are required. Use Import suggestions to pull the image from the product page.'
      );
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const lines = (value: string) =>
      value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
    const payload = {
      brand_name: brandName,
      product_name: productName,
      category,
      benefits: lines(benefits),
      ingredients: lines(ingredients),
      price,
      offer,
      product_url: productUrl || websiteUrl,
      approved_claims: lines(approvedClaims),
      prohibited_claims: lines(prohibitedClaims),
      packshots: [primaryPackshot],
      primary_packshot: primaryPackshot,
      is_active: true,
      is_approved: true,
    };
    const brandResponse = await fetch('/api/brand-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_name: brandName,
        website_url: websiteUrl,
        approved_claims: lines(approvedClaims),
        prohibited_claims: lines(prohibitedClaims),
      }),
    });
    const brand = await brandResponse.json();
    if (!brandResponse.ok) {
      setErrorMsg(brand.error || 'Could not save brand profile');
      setLoading(false);
      return;
    }
    const response = await fetch(productId ? `/api/products/${productId}` : '/api/products', {
      method: productId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, brand_profile_id: brand.id }),
    });
    const data = await response.json();
    if (!response.ok) {
      setErrorMsg(data.error || 'Could not save product');
      setLoading(false);
      return;
    }
    setProductId(data.id);
    const urls = collectCarouselUrls();
    if (urls.length >= CAROUSEL_URL_MIN) {
      saveCarouselUrlPrefill(urls);
    }
    setCompletedSteps((previous) => new Set([...previous, 1]));
    setStep(2);
    setLoading(false);
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
          3 quick steps — approve your real product before generating any creative. Connect Meta later when you launch.
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
              <PackageCheck className="w-5 h-5 text-[var(--meta-blue)]" />
              <h2 className="font-semibold text-lg">Review and approve your product</h2>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Import fills brand, product, claims, and packshot from the product page. Review and approve —
              you should rarely need to type these by hand.
            </p>
            <div>
              <label className="label">Primary product page URL</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  className="input flex-1"
                  placeholder="https://yourstore.com/products/product-name"
                  value={productUrl}
                  onChange={(event) => setProductUrl(event.target.value)}
                />
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center justify-center gap-2 shrink-0"
                  disabled={importingProduct || uploadingProduct || !productUrl.trim()}
                  onClick={importProductPage}
                >
                  {importingProduct || uploadingProduct ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Import suggestions
                </button>
              </div>
              <p className="text-xs text-[var(--muted)] mt-1.5">
                Imports name, brand, category, price, benefits, ingredients, claims, and the primary product image.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--meta-bg)]/40 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[var(--meta-blue)]" />
                <label className="label mb-0">More product URLs for Facebook carousel (optional)</label>
              </div>
              <textarea
                className="input min-h-24 font-mono text-sm"
                placeholder={`One product URL per line (up to ${CAROUSEL_URL_MAX} total with primary)\nhttps://yourstore.com/products/product-2\nhttps://yourstore.com/products/product-3`}
                value={carouselExtraUrls}
                onChange={(event) => setCarouselExtraUrls(event.target.value)}
              />
              <p className="text-xs text-[var(--muted)]">
                Carousel ads need {CAROUSEL_URL_MIN}–{CAROUSEL_URL_MAX} product pages. Add extras here; we&apos;ll
                prefill Ad Generation so each card can use its own URL and image.
              </p>
            </div>

            {suggestedImages.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2">Images from the product page — click to set packshot</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {suggestedImages.map((image) => (
                      <button
                        key={image}
                        type="button"
                        disabled={uploadingProduct}
                        onClick={() => void importPackshotFromUrl(image)}
                        className={`w-20 h-20 rounded-lg border bg-white p-1 shrink-0 transition ring-offset-2 ${
                          selectedSuggestedImage === image
                            ? 'ring-2 ring-[var(--meta-blue)]'
                            : 'hover:border-[var(--meta-blue)]'
                        }`}
                        title="Use as packshot"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image} alt="" className="w-full h-full object-contain" />
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Exact brand name</label>
                <input className="input" value={brandName} onChange={(event) => setBrandName(event.target.value)} />
              </div>
              <div>
                <label className="label">Exact product name</label>
                <input className="input" value={productName} onChange={(event) => setProductName(event.target.value)} />
              </div>
              <div>
                <label className="label">Category</label>
                <input className="input" value={category} onChange={(event) => setCategory(event.target.value)} />
              </div>
              <div>
                <label className="label">Price / offer</label>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" placeholder="₹499" value={price} onChange={(event) => setPrice(event.target.value)} />
                  <input className="input" placeholder="10% off" value={offer} onChange={(event) => setOffer(event.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <label className="label">
                Packshot {primaryPackshot ? '(imported — optional replace)' : '(import or upload)'}
              </label>
              {primaryPackshot ? (
                <div className="mt-1 w-40 h-40 rounded-xl border bg-white flex items-center justify-center p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={primaryPackshot} alt="Approved packshot" className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <p className="text-xs text-amber-800 mt-1">
                  No packshot yet — click Import suggestions, or upload below.
                </p>
              )}
              <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer mt-3">
                {uploadingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {primaryPackshot ? 'Replace with upload' : 'Upload PNG, JPEG, WebP, GIF or AVIF'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                  className="hidden"
                  disabled={uploadingProduct}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void uploadPackshot(file);
                  }}
                />
              </label>
              {packshotNotice && <p className="text-xs text-emerald-800 mt-2">{packshotNotice}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Benefits (auto-filled — edit if needed)</label>
                <textarea
                  className="input min-h-24"
                  placeholder="Benefits — one per line"
                  value={benefits}
                  onChange={(event) => setBenefits(event.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">Ingredients (auto-filled — edit if needed)</label>
                <textarea
                  className="input min-h-24"
                  placeholder="Ingredients / materials — one per line"
                  value={ingredients}
                  onChange={(event) => setIngredients(event.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">Approved claims (auto-filled — review)</label>
                <textarea
                  className="input min-h-24"
                  placeholder="Approved claims — one per line"
                  value={approvedClaims}
                  onChange={(event) => setApprovedClaims(event.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">Prohibited claims (auto-filled — review)</label>
                <textarea
                  className="input min-h-24"
                  placeholder="Prohibited claims — one per line"
                  value={prohibitedClaims}
                  onChange={(event) => setProhibitedClaims(event.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setStep(0)}>
                Back
              </button>
              <button
                className="btn-primary flex items-center gap-2"
                disabled={loading || uploadingProduct || importingProduct}
                onClick={saveProduct}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Approve product &amp; Continue
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[var(--meta-blue)]" />
              <h2 className="font-semibold text-lg">Competitor ads to clone</h2>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Add competitor websites or Meta Ad Library URLs. Optional Page ID unlocks live ads (e.g. FarmDidi =
              108788791719221).
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
              <button className="btn-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="btn-primary flex items-center gap-2"
                disabled={loading}
                onClick={() => saveProgress('finish')}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Finish &amp; generate ads <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
