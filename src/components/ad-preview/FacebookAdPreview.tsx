'use client';

import { useMemo, useState } from 'react';
import { Globe, MoreHorizontal, ThumbsUp, MessageCircle, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { META_CTA_OPTIONS } from '@/lib/meta-campaign';

type PreviewFormat = 'feed' | 'stories' | 'reels';

/** Meta feed usually shows ~125 chars then “See more”. */
const FEED_PRIMARY_COLLAPSE_AT = 125;

function FeedPrimaryText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsCollapse = text.length > FEED_PRIMARY_COLLAPSE_AT;
  const visible = !needsCollapse || expanded ? text : `${text.slice(0, FEED_PRIMARY_COLLAPSE_AT).trimEnd()}`;

  return (
    <p className="px-3 pt-1 pb-2 text-[15px] leading-[20px] text-[#050505] whitespace-pre-wrap break-words">
      {visible}
      {needsCollapse && !expanded && (
        <>
          {' '}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline text-[15px] leading-[20px] text-[#65676B] font-normal hover:underline"
          >
            … See more
          </button>
        </>
      )}
      {needsCollapse && expanded && (
        <>
          {' '}
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline text-[15px] leading-[20px] text-[#65676B] font-normal hover:underline"
          >
            See less
          </button>
        </>
      )}
    </p>
  );
}

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

  const domain = useMemo(() => {
    const raw = (linkDisplay || 'yourstore.com').replace(/^https?:\/\//i, '').replace(/\/$/, '');
    return raw.toUpperCase();
  }, [linkDisplay]);

  const formats: { id: PreviewFormat; label: string }[] = [
    { id: 'feed', label: 'Feed' },
    { id: 'stories', label: 'Stories' },
    { id: 'reels', label: 'Reels' },
  ];

  return (
    <div className="w-full max-w-[360px] mx-auto">
      <div className="flex gap-1 mb-3 bg-[#F0F2F5] rounded-lg p-1">
        {formats.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFormat(f.id)}
            className={cn(
              'flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors',
              format === f.id
                ? 'bg-white text-[#0866FF] shadow-sm'
                : 'text-[#65676B] hover:text-[#050505]'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Phone chrome */}
      <div
        className={cn(
          'bg-[#F0F2F5] border border-[#CCD0D5] shadow-[0_2px_12px_rgba(0,0,0,0.12)] overflow-hidden',
          format === 'feed' && 'rounded-2xl',
          (format === 'stories' || format === 'reels') && 'rounded-[28px] aspect-[9/16] bg-black'
        )}
      >
        {format === 'feed' && (
          <div className="bg-white">
            {/* Page header — matches Meta feed */}
            <div className="flex items-start gap-2 px-3 pt-3 pb-2">
              <div className="w-10 h-10 rounded-full bg-[#0866FF] flex items-center justify-center text-white text-base font-bold shrink-0">
                {(pageName || 'Y').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[15px] font-semibold text-[#050505] leading-5 hover:underline cursor-default truncate">
                  {pageName}
                </p>
                <p className="text-[13px] text-[#65676B] leading-4 flex items-center gap-1">
                  Sponsored
                  <span className="text-[#65676B]">·</span>
                  <Globe className="w-3 h-3" strokeWidth={2} />
                </p>
              </div>
              <button type="button" className="p-1 text-[#65676B]" aria-label="More">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            {/* Primary text — Facebook-style wrap + See more (no mid-word CSS clamp) */}
            {primaryText ? <FeedPrimaryText text={primaryText} /> : null}

            {/* Creative — edge-to-edge */}
            <div className="aspect-square bg-[#E4E6EB] relative">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-[#65676B]">
                  Creative preview
                </div>
              )}
            </div>

            {/* Link / CTA strip — Ads Manager style */}
            <div className="bg-[#F0F2F5] px-3 py-2.5 flex items-center gap-3 border-t border-[#E4E6EB]">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-[#65676B] tracking-wide truncate">{domain}</p>
                <p className="text-[17px] font-semibold text-[#050505] leading-[22px] line-clamp-2 break-words">
                  {headline || 'Your headline here'}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 text-[15px] font-semibold text-[#050505] bg-[#E4E6EB] hover:bg-[#D8DADF] px-3.5 py-2 rounded-md transition-colors"
              >
                {ctaLabel}
              </button>
            </div>

            {/* Social row — makes it feel like a real feed unit */}
            <div className="flex items-center justify-between px-1 py-1 border-t border-[#E4E6EB]">
              {[
                { icon: ThumbsUp, label: 'Like' },
                { icon: MessageCircle, label: 'Comment' },
                { icon: Share2, label: 'Share' },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold text-[#65676B] hover:bg-[#F0F2F5] rounded-md"
                >
                  <action.icon className="w-4 h-4" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {(format === 'stories' || format === 'reels') && (
          <div className="relative h-full min-h-[520px] bg-black">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-[#1c2b4a] to-black" />
            )}
            <div className="absolute top-3 left-3 right-3 flex gap-1">
              <div className="h-[2px] flex-1 bg-white/35 rounded-full overflow-hidden">
                <div className="h-full w-2/5 bg-white rounded-full" />
              </div>
              <div className="h-[2px] flex-1 bg-white/35 rounded-full" />
            </div>
            <div className="absolute top-6 left-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0866FF] flex items-center justify-center text-white text-xs font-bold">
                {(pageName || 'Y').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white text-[13px] font-semibold leading-tight">{pageName}</p>
                <p className="text-white/70 text-[11px]">Sponsored</p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-16">
              {headline && (
                <p className="text-white text-[17px] font-semibold leading-snug mb-1 break-words">
                  {headline}
                </p>
              )}
              {primaryText && (
                <p className="text-white/90 text-[13px] leading-snug mb-3 line-clamp-3 break-words">
                  {primaryText}
                </p>
              )}
              <button
                type="button"
                className="w-full text-[15px] font-semibold bg-white text-[#050505] py-2.5 rounded-full"
              >
                {ctaLabel}
              </button>
            </div>
            {format === 'reels' && (
              <div className="absolute right-3 bottom-36 flex flex-col items-center gap-4 text-white text-[11px] font-semibold">
                <span className="flex flex-col items-center gap-1">
                  <ThumbsUp className="w-6 h-6" /> Like
                </span>
                <span className="flex flex-col items-center gap-1">
                  <MessageCircle className="w-6 h-6" /> Comment
                </span>
                <span className="flex flex-col items-center gap-1">
                  <Share2 className="w-6 h-6" /> Share
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1 text-[11px] text-[#65676B]">
        <p className={cn((headline?.length || 0) > 40 && 'text-red-600 font-medium')}>
          Headline: {headline?.length || 0}/40
          {(headline?.length || 0) > 40 ? ' — Meta may truncate' : ''}
        </p>
        <p className={cn((primaryText?.length || 0) > 125 && 'text-amber-700')}>
          Primary text: {primaryText?.length || 0}/125 shown before “See more” · 2,200 max
        </p>
      </div>
    </div>
  );
}
