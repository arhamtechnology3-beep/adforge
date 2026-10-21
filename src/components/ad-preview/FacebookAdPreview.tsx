'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Globe, MoreHorizontal, ThumbsUp, MessageCircle, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { META_CTA_OPTIONS } from '@/lib/meta-campaign';
import StoryFillImage from '@/components/ads/StoryFillImage';

export type PreviewFormat = 'feed' | 'stories' | 'reels';

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

/** Map generated ad format → Meta placement preview tab */
export function previewFormatFromAdFormat(
  adFormat?: string | null
): PreviewFormat {
  if (adFormat === 'stories') return 'stories';
  if (adFormat === 'video') return 'reels';
  return 'feed';
}

export function FacebookAdPreview({
  headline,
  primaryText,
  imageUrl,
  cta,
  pageName = 'Your Brand',
  linkDisplay,
  preferredFormat,
  adFormatLabel,
  /** True when creative is Stories/Video 9:16 — false for Feed/Carousel squares */
  isVerticalNineSixteen = false,
  /** Meta Feed shows 4:5 in full. Square is only for 1:1 creatives. */
  feedAspect,
  carouselCards,
  hasAudio,
}: {
  headline?: string;
  primaryText?: string;
  imageUrl?: string;
  cta?: string;
  pageName?: string;
  linkDisplay?: string;
  /** When set (from selected creative), preview switches to that Meta placement */
  preferredFormat?: PreviewFormat;
  adFormatLabel?: string;
  isVerticalNineSixteen?: boolean;
  feedAspect?: '1:1' | '4:5' | null;
  carouselCards?: Array<{ image_url: string; headline?: string }>;
  hasAudio?: boolean;
}) {
  const [format, setFormat] = useState<PreviewFormat>(preferredFormat || 'feed');
  const [measuredFeedAspect, setMeasuredFeedAspect] = useState<'1:1' | '4:5' | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const cards = (carouselCards || []).filter((card) => card.image_url);
  const activeCard = cards.length >= 2 ? cards[Math.min(cardIndex, cards.length - 1)] : null;
  const ctaLabel =
    META_CTA_OPTIONS.find((c) => c.value === cta)?.label || 'Shop Now';

  useEffect(() => {
    if (preferredFormat) setFormat(preferredFormat);
  }, [preferredFormat]);

  useEffect(() => {
    setMeasuredFeedAspect(null);
    setCardIndex(0);
  }, [imageUrl, cards.length]);

  useEffect(() => {
    if (cards.length < 2 || format !== 'feed') return;
    const timer = window.setInterval(() => {
      setCardIndex((index) => (index + 1) % cards.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [cards.length, format]);

  const verticalPlacement = format === 'stories' || format === 'reels';
  const willCropOnMeta = verticalPlacement && !isVerticalNineSixteen;
  const feedIsFourFive =
    feedAspect === '1:1' ? false : feedAspect === '4:5' || measuredFeedAspect === '4:5';

  const domain = useMemo(() => {
    const raw = (linkDisplay || 'yourstore.com').replace(/^https?:\/\//i, '').replace(/\/$/, '');
    return raw.toUpperCase();
  }, [linkDisplay]);

  const formats: { id: PreviewFormat; label: string }[] = [
    { id: 'feed', label: 'Feed' },
    { id: 'stories', label: 'Stories' },
    { id: 'reels', label: 'Reels' },
  ];

  const fillSrc = imageUrl || '';

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

      {cards.length >= 2 ? (
        <p className="mb-2 rounded-md bg-[#E7F3FF] px-2 py-1.5 text-[12px] font-semibold text-[#0866FF]">
          Carousel is working · card {Math.min(cardIndex, cards.length - 1) + 1} of {cards.length}
          {activeCard?.headline ? ` · ${activeCard.headline}` : ''}
        </p>
      ) : null}

      {adFormatLabel ? (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#65676B]">
          Showing · {adFormatLabel}
          {verticalPlacement && isVerticalNineSixteen
            ? ' · as on Meta'
            : verticalPlacement
              ? ' · Feed/Carousel in Reels frame'
              : cards.length >= 2
                ? ` · carousel ${Math.min(cardIndex, cards.length - 1) + 1}/${cards.length}${feedAspect === '1:1' ? ' · 1:1' : feedIsFourFive ? ' · 4:5' : ''}`
                : feedAspect === '1:1'
                  ? ' · 1:1'
                  : feedIsFourFive
                    ? ' · 4:5 as on Meta'
                    : ' · as on Meta'}
          {hasAudio ? ' · soft audio' : ''}
        </p>
      ) : null}

      {willCropOnMeta ? (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950 leading-snug">
          <strong>Product edges look cut</strong> because this is a square Feed/Carousel image in a
          tall Reels/Stories frame. Meta will crop the same way live.
          <br />
          <span className="font-semibold">Fix:</span> go to <strong>/ads</strong> → enable{' '}
          <strong>Video</strong> → leave soft audio on → <strong>Regenerate pack</strong> → select
          that Video/Stories creative here (not Carousel alone).
        </div>
      ) : null}

      {/* Phone chrome */}
      <div
        className={cn(
          'bg-[#F0F2F5] border border-[#CCD0D5] shadow-[0_2px_12px_rgba(0,0,0,0.12)] overflow-hidden',
          format === 'feed' && 'rounded-2xl',
          (format === 'stories' || format === 'reels') &&
            'rounded-[28px] aspect-[9/16] max-h-[560px] bg-black border-black/40'
        )}
      >
        {format === 'feed' && (
          <div className="bg-white">
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

            {primaryText ? <FeedPrimaryText text={primaryText} /> : null}

            <div
              className={cn(
                'bg-[#E4E6EB] relative',
                feedIsFourFive ? 'aspect-[4/5]' : 'aspect-square'
              )}
            >
              {imageUrl || activeCard?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={activeCard?.image_url || imageUrl}
                  src={activeCard?.image_url || imageUrl}
                  alt=""
                  className={cn(
                    'w-full h-full',
                    feedAspect === '1:1' || feedIsFourFive ? 'object-contain' : 'object-cover'
                  )}
                  onLoad={(event) => {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    if (!naturalWidth || !naturalHeight) return;
                    const ratio = naturalWidth / naturalHeight;
                    setMeasuredFeedAspect(Math.abs(ratio - 4 / 5) <= 0.04 ? '4:5' : '1:1');
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-[#65676B]">
                  Creative preview
                </div>
              )}
              {cards.length >= 2 ? (
                <>
                  <button
                    type="button"
                    aria-label="Previous card"
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-1.5 text-white"
                    onClick={() =>
                      setCardIndex((index) => (index - 1 + cards.length) % cards.length)
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next card"
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-1.5 text-white"
                    onClick={() => setCardIndex((index) => (index + 1) % cards.length)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1">
                    {cards.map((card, index) => (
                      <span
                        key={`${card.image_url}-${index}`}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          index === Math.min(cardIndex, cards.length - 1)
                            ? 'bg-white'
                            : 'bg-white/45'
                        )}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div className="bg-[#F0F2F5] px-3 py-2.5 flex items-center gap-3 border-t border-[#E4E6EB]">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-[#65676B] tracking-wide truncate">{domain}</p>
                <p className="text-[17px] font-semibold text-[#050505] leading-[22px] line-clamp-2 break-words">
                  {activeCard?.headline || headline || 'Your headline here'}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 text-[15px] font-semibold text-[#050505] bg-[#E4E6EB] hover:bg-[#D8DADF] px-3.5 py-2 rounded-md transition-colors"
              >
                {ctaLabel}
              </button>
            </div>

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
          <div className="relative h-full min-h-[480px] bg-black">
            {fillSrc ? (
              willCropOnMeta ? (
                // Show full product for mismatched Feed/Carousel — Meta still crops live.
                <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fillSrc}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                  />
                  <div className="pointer-events-none absolute inset-x-0 top-14 z-[5] flex justify-center px-3">
                    <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-amber-200">
                      Preview fit — live Reels will crop sides
                    </span>
                  </div>
                </div>
              ) : (
                <StoryFillImage src={fillSrc} alt="" className="z-0" />
              )
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-[#1c2b4a] to-black" />
            )}
            <div className="absolute top-3 left-3 right-3 z-10 flex gap-1">
              <div className="h-[2px] flex-1 bg-white/35 rounded-full overflow-hidden">
                <div className="h-full w-2/5 bg-white rounded-full" />
              </div>
              <div className="h-[2px] flex-1 bg-white/35 rounded-full" />
            </div>
            <div className="absolute top-6 left-3 z-10 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0866FF] flex items-center justify-center text-white text-xs font-bold">
                {(pageName || 'Y').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white text-[13px] font-semibold leading-tight">{pageName}</p>
                <p className="text-white/70 text-[11px]">Sponsored</p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-16">
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
              <div className="absolute right-3 bottom-36 z-10 flex flex-col items-center gap-4 text-white text-[11px] font-semibold">
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
