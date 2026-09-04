'use client';

import type { ReactNode } from 'react';
import type { MetaAdFormat } from '@/lib/creatives';

export type Step2ProductOption = {
  id: string;
  brand_name: string;
  product_name: string;
};

export function Step2Studio(props: {
  products: Step2ProductOption[];
  selectedProductId: string;
  language: string;
  tone: string;
  variantCount: number;
  formats: MetaAdFormat[];
  carouselProductUrls: string;
  generating: boolean;
  resolvingCarousel?: boolean;
  carouselPreviewNote?: string | null;
  onProductChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onToneChange: (value: string) => void;
  onVariantCountChange: (value: number) => void;
  onFormatsChange: (value: MetaAdFormat[]) => void;
  onCarouselProductUrlsChange: (value: string) => void;
  onPreviewCarouselUrls?: () => void;
  onGenerate: () => void;
  children: ReactNode;
}) {
  const carouselSelected = props.formats.includes('carousel');

  return (
    <div className="space-y-6">
      <div className="card p-4 border-indigo-200 bg-white">
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
              value={props.tone}
              onChange={(event) => props.onToneChange(event.target.value)}
            >
              <option>Trustworthy</option>
              <option>Premium</option>
              <option>Playful</option>
              <option>Direct response</option>
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
              <option value={5}>5</option>
            </select>
          </div>
          <button
            type="button"
            className="btn-primary text-xs py-2.5"
            onClick={props.onGenerate}
            disabled={props.generating || !props.selectedProductId}
          >
            {props.generating ? 'Generating…' : 'Regenerate pack'}
          </button>
        </div>

        {carouselSelected && (
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="label text-xs mb-0">Carousel product URLs</label>
                <p className="text-[11px] text-slate-500">
                  Paste 2–10 product page links (one per line). Each card uses that product’s store
                  image — no AI image generation — and Shop Now opens that URL.
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
              placeholder={`https://store.com/products/product-1\nhttps://store.com/products/product-2\nhttps://store.com/products/product-3`}
              value={props.carouselProductUrls}
              onChange={(event) => props.onCarouselProductUrlsChange(event.target.value)}
            />
            {props.carouselPreviewNote && (
              <p className="text-[11px] text-slate-600">{props.carouselPreviewNote}</p>
            )}
          </div>
        )}
      </div>
      {props.children}
    </div>
  );
}
