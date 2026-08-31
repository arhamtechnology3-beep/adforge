'use client';

import { useState } from 'react';
import { Globe, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { META_CTA_OPTIONS } from '@/lib/meta-campaign';

type PreviewFormat = 'feed' | 'stories' | 'reels';

export function FacebookAdPreview({
  headline,
  primaryText,
  imageUrl,
  cta,
  pageName = 'Your Brand',
  linkDisplay,
}: {
  headline?: string;
  primaryText?: string;
  imageUrl?: string;
  cta?: string;
  pageName?: string;
  linkDisplay?: string;
}) {
  const [format, setFormat] = useState<PreviewFormat>('feed');
  const ctaLabel =
    META_CTA_OPTIONS.find((c) => c.value === cta)?.label || 'Shop Now';

  const formats: { id: PreviewFormat; label: string }[] = [
    { id: 'feed', label: 'Feed' },
    { id: 'stories', label: 'Stories' },
    { id: 'reels', label: 'Reels' },
  ];

  return (
    <div className="w-full max-w-[320px] mx-auto">
      <div className="flex gap-1 mb-3 bg-gray-100 rounded-lg p-1">
        {formats.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFormat(f.id)}
            className={cn(
              'flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors',
              format === f.id
                ? 'bg-white text-[var(--meta-blue)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          'bg-white border border-[var(--border)] shadow-lg overflow-hidden',
          format === 'feed' && 'rounded-xl',
          format === 'stories' && 'rounded-3xl aspect-[9/16]',
          format === 'reels' && 'rounded-3xl aspect-[9/16]'
        )}
      >
        {/* Feed preview */}
        {format === 'feed' && (
          <>
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--meta-blue)] to-blue-400 flex items-center justify-center text-white text-xs font-bold">
                {pageName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{pageName}</p>
                <p className="text-[10px] text-[var(--muted)] flex items-center gap-1">
                  Sponsored · <Globe className="w-2.5 h-2.5" />
                </p>
              </div>
              <MoreHorizontal className="w-4 h-4 text-[var(--muted)]" />
            </div>

            {primaryText && (
              <p className="px-3 py-2 text-xs text-[var(--foreground)] leading-relaxed line-clamp-3">
                {primaryText}
              </p>
            )}

            <div className="aspect-square bg-gray-100 relative">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--muted)]">
                  Creative preview
                </div>
              )}
            </div>

            <div className="px-3 py-2.5 flex items-center justify-between gap-2 bg-gray-50">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-[var(--muted)] uppercase truncate">
                  {linkDisplay || 'yourstore.com'}
                </p>
                <p className="text-xs font-semibold truncate">
                  {headline || 'Your headline here'}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs font-semibold bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded-md transition-colors"
              >
                {ctaLabel}
              </button>
            </div>
          </>
        )}

        {/* Stories / Reels preview */}
        {(format === 'stories' || format === 'reels') && (
          <div className="relative h-full bg-black">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="w-full h-full object-cover opacity-90" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-purple-900 to-black" />
            )}
            <div className="absolute top-3 left-3 right-3">
              <div className="h-0.5 bg-white/30 rounded-full">
                <div className="h-full w-1/3 bg-white rounded-full" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-white text-xs font-semibold mb-1">{pageName}</p>
              {primaryText && (
                <p className="text-white/90 text-[11px] line-clamp-2 mb-2">{primaryText}</p>
              )}
              <button
                type="button"
                className="w-full text-xs font-semibold bg-white text-black py-2 rounded-lg"
              >
                {ctaLabel}
              </button>
            </div>
            {format === 'reels' && (
              <p className="absolute right-3 bottom-24 text-white text-[10px] font-medium rotate-0">
                ♥ Like
              </p>
            )}
          </div>
        )}
      </div>

      {/* Character counters */}
      <div className="mt-3 space-y-1 text-[10px] text-[var(--muted)]">
        <p className={cn((headline?.length || 0) > 40 && 'text-[var(--danger)]')}>
          Headline: {headline?.length || 0}/40
        </p>
        <p className={cn((primaryText?.length || 0) > 125 && 'text-amber-600')}>
          Primary text: {primaryText?.length || 0}/125 ideal · 2200 max
        </p>
      </div>
    </div>
  );
}
