'use client';

import type { ReactNode } from 'react';
import type { MetaAdFormat } from '@/lib/creatives';
import { DIWALI_TAGLINES } from '@/lib/creative-engine/diwali-campaign';

export type Step2ProductOption = {
  id: string;
  brand_name: string;
  product_name: string;
};

const TONE_OPTIONS = [
  'Trustworthy',
  'Premium',
  'Playful',
  'Direct response',
  'Diwali festive',
] as const;

export function Step2Studio(props: {
  products: Step2ProductOption[];
  selectedProductId: string;
  language: string;
  tone: string;
  variantCount: number;
  formats: MetaAdFormat[];
  carouselProductUrls: string;
  carouselHook: string;
  carouselOverlays: string;
  carouselReels: boolean;
  reelsAudio: boolean;
  generating: boolean;
  resolvingCarousel?: boolean;
  carouselPreviewNote?: string | null;
  onProductChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onToneChange: (value: string) => void;
  onVariantCountChange: (value: number) => void;
  onFormatsChange: (value: MetaAdFormat[]) => void;
  onCarouselProductUrlsChange: (value: string) => void;
  onCarouselHookChange: (value: string) => void;
  onCarouselOverlaysChange: (value: string) => void;
  onCarouselReelsChange: (value: boolean) => void;
  onReelsAudioChange: (value: boolean) => void;
  onPreviewCarouselUrls?: () => void;
  onGenerate: () => void;
  children: ReactNode;
}) {
  const carouselSelected = props.formats.includes('carousel');
  const diwaliActive = /diwali/i.test(props.tone);

  function enableDiwaliPack() {
    props.onToneChange('Diwali festive');
    props.onVariantCountChange(4);
    const formats = new Set(props.formats);
    formats.add('single_image');
    formats.add('stories');
    props.onFormatsChange(Array.from(formats));
    if (!props.carouselHook.trim()) {
      props.onCarouselHookChange(DIWALI_TAGLINES[0].headline.slice(0, 40));
    }
  }

  function disableDiwaliPack() {
    props.onToneChange('Trustworthy');
    if (props.variantCount === 4) props.onVariantCountChange(3);
  }

  return (
    <div className="space-y-6">
      <div className="card p-4 border-indigo-200 bg-white">
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-amber-950">Campaign pack</p>
              <p className="text-[11px] text-amber-900/80">
                Diwali = 4 new festival scenes + taglines. Logo &amp; brand colors stay on your
                real packshot.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={`text-[11px] px-3 py-1.5 rounded-lg border font-semibold ${
                  !diwaliActive
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-white/60 border-amber-200 text-amber-800'
                }`}
                onClick={disableDiwaliPack}
              >
                Standard
              </button>
              <button
                type="button"
                className={`text-[11px] px-3 py-1.5 rounded-lg border font-semibold ${
                  diwaliActive
                    ? 'bg-amber-600 border-amber-700 text-white'
                    : 'bg-white border-amber-300 text-amber-950'
                }`}
                onClick={enableDiwaliPack}
              >
                Diwali (4 creatives)
              </button>
            </div>
          </div>
          {diwaliActive && (
            <div className="space-y-1.5 pt-1 border-t border-amber-200/80">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                Locked taglines — click to set Card 1 hook · then Regenerate pack
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DIWALI_TAGLINES.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    title={entry.tagline}
                    className={`text-[11px] px-2.5 py-1.5 rounded-lg border text-left max-w-full ${
                      props.carouselHook === entry.headline
                        ? 'bg-amber-100 border-amber-400 text-amber-950'
                        : 'bg-white border-amber-200 text-amber-900 hover:bg-amber-50'
                    }`}
                    onClick={() => props.onCarouselHookChange(entry.headline.slice(0, 40))}
                  >
                    {entry.tagline}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="label text-xs">Approved product</label>
            <select
              className="input text-sm"
              value={props.selectedProductId}
              onChange={(event) => props.onProductChange(event.target.value)}
            >
              {props.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.brand_name} · {product.product_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Language</label>
            <select
              className="input text-sm"
              value={props.language}
              onChange={(event) => props.onLanguageChange(event.target.value)}
            >
              <option>English</option>
              <option>Hindi</option>
              <option>Hinglish</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Formats</label>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['single_image', 'Image'],
                  ['carousel', 'Carousel'],
                  ['stories', 'Story'],
                  ['video', 'Video'],
                ] as Array<[MetaAdFormat, string]>
              ).map(([format, label]) => {
                const active = props.formats.includes(format);
                return (
                  <button
                    key={format}
                    type="button"
                    className={`text-[11px] px-2 py-1.5 rounded-lg border ${
                      active
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                        : 'bg-white border-slate-200 text-slate-500'
                    }`}
                    onClick={() => {
                      const next = active
                        ? props.formats.filter((item) => item !== format)
                        : [...props.formats, format];
                      if (next.length) props.onFormatsChange(next);
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="label text-xs">Tone</label>
            <select
              className="input text-sm"
              value={TONE_OPTIONS.includes(props.tone as (typeof TONE_OPTIONS)[number]) ? props.tone : props.tone}
              onChange={(event) => {
                const next = event.target.value;
                props.onToneChange(next);
                if (/diwali/i.test(next)) {
                  props.onVariantCountChange(4);
                }
              }}
            >
              {TONE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Best variants</label>
            <select
              className="input text-sm"
              value={props.variantCount}
              onChange={(event) => props.onVariantCountChange(Number(event.target.value))}
            >
              <option value={1}>1</option>
              <option value={3}>3</option>
              <option value={4}>4 (Diwali pack)</option>
              <option value={5}>5</option>
            </select>
          </div>
          <button
            type="button"
            className="btn-primary text-xs py-2.5"
            onClick={props.onGenerate}
            disabled={props.generating || !props.selectedProductId}
          >
            {props.generating
              ? 'Generating…'
              : diwaliActive
                ? 'Generate Diwali pack'
                : 'Regenerate pack'}
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2.5 space-y-2">
          <p className="text-[11px] font-semibold text-indigo-950">
            Soft audio + fresh Reels (not on Audience step)
          </p>
          <label className="flex items-start gap-2 text-[11px] text-slate-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={props.reelsAudio}
              onChange={(event) => props.onReelsAudioChange(event.target.checked)}
            />
            <span>
              Add soft background audio on Reels / Video MP4 (original ambient bed — not Instagram
              Music). Applies when you regenerate with <strong>Video</strong> or carousel Reels
              checked.
            </span>
          </label>
          <p className="text-[10px] text-slate-600 leading-snug">
            Tip: turn on <strong>Video</strong> (+ Story) formats above, keep this audio on, then
            click <strong>Regenerate pack</strong> for new creatives — old carousel ads that already
            spent should not be re-used alone on Reels.
          </p>
        </div>

        {carouselSelected && (
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="label text-xs mb-0">Carousel product URLs</label>
                <p className="text-[11px] text-slate-500">
                  Paste 2–10 product page links (one per line). Card 1 gets a hook headline, the
                  next cards get a benefit overlay from each product page, and a final Shop Now card
                  is added. Up to 6 products are kept so the story stays tight.
                </p>
              </div>
              {props.onPreviewCarouselUrls && (
                <button
                  type="button"
                  className="btn-secondary text-[11px] py-1.5 px-3"
                  onClick={props.onPreviewCarouselUrls}
                  disabled={props.resolvingCarousel || !props.carouselProductUrls.trim()}
                >
                  {props.resolvingCarousel ? 'Checking…' : 'Preview URLs'}
                </button>
              )}
            </div>
            <textarea
              className="input text-sm min-h-[110px] font-mono"
              placeholder={`https://divyaprabhafoods.com/products/…\nhttps://divyaprabhafoods.com/products/…\n(one real product URL per line — grey text is only an example)`}
              value={props.carouselProductUrls}
              onChange={(event) => props.onCarouselProductUrlsChange(event.target.value)}
            />
            <p className="text-[10px] text-slate-500">
              URLs are saved in this browser automatically. Grey example lines are not real links —
              paste your live Divyaprabha product pages.
            </p>
            {props.carouselPreviewNote && (
              <p className="text-[11px] text-slate-600">{props.carouselPreviewNote}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label text-xs">Card 1 hook (optional)</label>
                <input
                  className="input text-sm"
                  maxLength={40}
                  placeholder="Auto from approved claims, e.g. Authentic Saurashtra Flavours"
                  value={props.carouselHook}
                  onChange={(event) => props.onCarouselHookChange(event.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">Benefit overlays (optional, comma separated)</label>
                <input
                  className="input text-sm"
                  placeholder="Auto from each product page, e.g. Traditional Recipe, Handmade"
                  value={props.carouselOverlays}
                  onChange={(event) => props.onCarouselOverlaysChange(event.target.value)}
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Typed overlays go on every product card — only use claims true for all products.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-700">
              <input
                type="checkbox"
                checked={props.carouselReels}
                onChange={(event) => props.onCarouselReelsChange(event.target.checked)}
              />
              Also build a 9:16 Reels video from the same cards (launch both in one ad set)
            </label>
          </div>
        )}
      </div>
      {props.children}
    </div>
  );
}
