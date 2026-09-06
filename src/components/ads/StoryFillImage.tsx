'use client';

import { useEffect, useState } from 'react';

/**
 * Client-side Stories/Reels fill: edge-to-edge blur cover + sharp product center.
 * Works even when the server still serves a square or black-letterboxed asset.
 */
export default function StoryFillImage({
  src,
  alt,
  className = '',
  onReady,
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  onReady?: () => void;
  onError?: () => void;
}) {
  const [out, setOut] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      onError?.();
      return;
    }
    let cancelled = false;
    setOut(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const iw = img.naturalWidth || 1;
        const ih = img.naturalHeight || 1;

        // Detect solid dark letterbox on already-tall images and crop to content
        const probe = document.createElement('canvas');
        const maxProbe = 64;
        const scale = Math.min(1, maxProbe / Math.max(iw, ih));
        const pw = Math.max(1, Math.round(iw * scale));
        const ph = Math.max(1, Math.round(ih * scale));
        probe.width = pw;
        probe.height = ph;
        const pctx = probe.getContext('2d', { willReadFrequently: true });
        if (!pctx) throw new Error('no probe');
        pctx.drawImage(img, 0, 0, pw, ph);
        const pixels = pctx.getImageData(0, 0, pw, ph).data;
        const rowLuma = (y: number) => {
          let sum = 0;
          for (let x = 0; x < pw; x += 1) {
            const i = (y * pw + x) * 4;
            sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          }
          return sum / pw;
        };
        let top = 0;
        let bottom = ph - 1;
        while (top < ph - 1 && rowLuma(top) < 28) top += 1;
        while (bottom > top && rowLuma(bottom) < 28) bottom -= 1;
        const contentH = bottom - top + 1;
        const letterboxed = ih / iw > 1.2 && contentH / ph < 0.78;

        const sx = 0;
        const sy = letterboxed ? Math.round((top / ph) * ih) : 0;
        const sw = iw;
        const sh = letterboxed ? Math.round((contentH / ph) * ih) : ih;

        const W = 540;
        const H = 960; // 9:16
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no canvas');

        const ir = sw / sh;
        const cr = W / H;
        let bw: number;
        let bh: number;
        if (ir > cr) {
          bh = H;
          bw = H * ir;
        } else {
          bw = W;
          bh = W / ir;
        }
        const bx = (W - bw) / 2;
        const by = (H - bh) / 2;

        ctx.filter = 'blur(18px) brightness(0.55) saturate(1.05)';
        ctx.drawImage(img, sx, sy, sw, sh, bx, by, bw, bh);
        ctx.filter = 'none';

        const safe = Math.min(W, H) * 0.92;
        let fw: number;
        let fh: number;
        if (ir >= 1) {
          fw = safe;
          fh = safe / ir;
        } else {
          fh = safe;
          fw = safe * ir;
        }
        const fx = (W - fw) / 2;
        const fy = (H - fh) / 2 - H * 0.04;
        ctx.drawImage(img, sx, sy, sw, sh, fx, fy, fw, fh);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        if (!cancelled) {
          setOut(dataUrl);
          onReady?.();
        }
      } catch {
        if (!cancelled) onError?.();
      }
    };

    img.onerror = () => {
      if (!cancelled) onError?.();
    };

    if (/^https?:\/\//i.test(src) && !src.includes('/api/ads/product-image')) {
      img.src = `/api/ads/product-image?src=${encodeURIComponent(src)}`;
    } else if (src.startsWith('/uploads/')) {
      img.src = `/api/ads/product-image?src=${encodeURIComponent(
        `${window.location.origin}${src}`
      )}`;
    } else {
      img.src = src;
    }

    return () => {
      cancelled = true;
    };
    // Intentionally only re-run when src changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (!out) {
    return <div className={`absolute inset-0 bg-[#111827] ${className}`} aria-hidden />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={out}
      alt={alt}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
    />
  );
}
