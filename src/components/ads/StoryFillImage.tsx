'use client';

import { useEffect, useState } from 'react';

/**
 * Meta Stories / Reels replica fill.
 * Real FB/IG vertical placements cover the phone edge-to-edge (no black bars).
 * Square packshots are cover-cropped into 9:16 — sides may crop; frame is always full.
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

        const probe = document.createElement('canvas');
        const maxProbe = 72;
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
        const colLuma = (x: number) => {
          let sum = 0;
          for (let y = 0; y < ph; y += 1) {
            const i = (y * pw + x) * 4;
            sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          }
          return sum / ph;
        };

        // Strip baked black letterbox / pillarbox before cover-crop
        let top = 0;
        let bottom = ph - 1;
        let left = 0;
        let right = pw - 1;
        while (top < ph - 1 && rowLuma(top) < 30) top += 1;
        while (bottom > top && rowLuma(bottom) < 30) bottom -= 1;
        while (left < pw - 1 && colLuma(left) < 30) left += 1;
        while (right > left && colLuma(right) < 30) right -= 1;

        const sx = Math.round((left / pw) * iw);
        const sy = Math.round((top / ph) * ih);
        const sw = Math.max(1, Math.round(((right - left + 1) / pw) * iw));
        const sh = Math.max(1, Math.round(((bottom - top + 1) / ph) * ih));

        const W = 540;
        const H = 960; // 9:16 phone
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no canvas');

        // Cover fill — same as Instagram Stories / Reels on device
        const ir = sw / sh;
        const cr = W / H;
        let dw: number;
        let dh: number;
        if (ir > cr) {
          dh = H;
          dw = H * ir;
        } else {
          dw = W;
          dh = W / ir;
        }
        const dx = (W - dw) / 2;
        const dy = (H - dh) / 2;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (!out) {
    return <div className={`absolute inset-0 bg-black ${className}`} aria-hidden />;
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
