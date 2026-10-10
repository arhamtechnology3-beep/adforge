import {
  NOTO_DEVANAGARI_400,
  NOTO_DEVANAGARI_700,
  NOTO_SANS_400,
  NOTO_SANS_700,
} from '@/lib/og-fonts-data';

type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 700 };

function decode(base64: string): ArrayBuffer {
  return Uint8Array.from(Buffer.from(base64, 'base64')).buffer;
}

let cached: OgFont[] | null = null;

/** Noto Sans (Latin + Devanagari) for Satori ImageResponse creatives. */
export function loadOgFonts(): OgFont[] {
  if (!cached) {
    cached = [
      { name: 'Noto Sans', data: decode(NOTO_SANS_400), weight: 400 },
      { name: 'Noto Sans', data: decode(NOTO_SANS_700), weight: 700 },
      { name: 'Noto Sans Devanagari', data: decode(NOTO_DEVANAGARI_400), weight: 400 },
      { name: 'Noto Sans Devanagari', data: decode(NOTO_DEVANAGARI_700), weight: 700 },
    ];
  }
  return cached;
}
