'use client';

import type { ReactNode } from 'react';

/**
 * Phone chrome matching Instagram / Facebook Stories & Reels on device.
 * Full-bleed 9:16 media + Meta UI overlays (not a letterboxed square).
 */
export default function StoriesPhoneChrome({
  children,
  pageName = 'Your Page',
  headline,
  cta = 'Shop Now',
  badge = 'Stories preview · as on IG/FB',
}: {
  children: ReactNode;
  pageName?: string;
  headline?: string | null;
  cta?: string;
  badge?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[260px]">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[28px] border border-black/40 bg-black shadow-[0_8px_28px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0">{children}</div>

        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
          <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/35">
            <div className="h-full w-2/5 rounded-full bg-white" />
          </div>
          <div className="h-[2px] flex-1 rounded-full bg-white/35" />
        </div>

        {/* Page row */}
        <div className="absolute top-6 left-3 right-3 z-20 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0866FF] text-xs font-bold text-white">
            {(pageName || 'Y').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-white">
              {pageName}
            </p>
            <p className="text-[11px] text-white/70">Sponsored</p>
          </div>
          <span className="text-lg leading-none text-white/80">···</span>
        </div>

        {/* Bottom CTA — Reels/Stories safe zone */}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-4 pt-16">
          {headline ? (
            <p className="mb-2 line-clamp-2 text-[15px] font-semibold leading-snug text-white">
              {headline}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-lg bg-white px-3.5 py-2 text-[13px] font-bold text-black">
              {cta}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-white/55">
              {badge}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
