import { NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PALETTES = [
  ['#fff4dc', '#e5a24b', '#64351f', '#271c2f'],
  ['#e8f5ee', '#78b69b', '#17594a', '#102a43'],
  ['#f5eaff', '#b18ae0', '#633c8f', '#251938'],
  ['#fff0ed', '#ef8f72', '#a33f4b', '#30213c'],
  ['#eef4ff', '#86a9df', '#35558a', '#18243d'],
  ['#f6f3df', '#bbb36d', '#65602d', '#24281c'],
] as const;

/** Distinct palette per MD prompt preset — local fallback matches preset mood */
const PRESET_PALETTES: Record<string, readonly [string, string, string, string]> = {
  'premium-luxury-studio': ['#f8f4ee', '#d4af37', '#8b7355', '#2c2419'],
  'natural-lifestyle': ['#f5ebe0', '#c9a66b', '#6b5344', '#3d2c1e'],
  'bold-scroll-stopper': ['#ff6b35', '#f7c59f', '#004e89', '#1a1a2e'],
  'sunlight-premium-home': ['#fff8e7', '#ffd166', '#e8a838', '#5c4a2a'],
  'minimal-clean': ['#ffffff', '#e8e8e8', '#b0b0b0', '#404040'],
  'dark-cinematic': ['#1a1a2e', '#4a4e69', '#22223b', '#0d0d14'],
  'soft-beauty': ['#fce4ec', '#f8bbd9', '#e891a9', '#6d4c5e'],
  'fresh-clean': ['#e8f5e9', '#81c784', '#4caf50', '#1b5e20'],
  'modern-urban': ['#eceff1', '#90a4ae', '#546e7a', '#263238'],
  'problem-solution': ['#e3f2fd', '#64b5f6', '#1976d2', '#0d47a1'],
  'premium-ugc': ['#faf6f0', '#d7ccc8', '#a1887f', '#4e342e'],
};

function numberParam(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.abs(Math.trunc(parsed)) : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seed = numberParam(searchParams.get('seed'), 1);
  const aspect = searchParams.get('aspect') === '9:16' ? '9:16' : searchParams.get('aspect') === '4:5' ? '4:5' : '1:1';
  const category = (searchParams.get('category') || '').toLowerCase();
  const angle = (searchParams.get('angle') || '').toLowerCase();
  const preset = (searchParams.get('preset') || '').toLowerCase();
  const width = 1080;
  const height = aspect === '9:16' ? 1920 : aspect === '4:5' ? 1350 : 1080;
  const angleHash = angle.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const combinedSeed = seed + angleHash * 19 + category.length * 7 + preset.length * 11;
  const palette =
    PRESET_PALETTES[preset] || PALETTES[combinedSeed % PALETTES.length];
  const style = preset ? combinedSeed % 6 : combinedSeed % 6;
  const food = /food|pickle|spice|snack|grocery|drink|beverage/.test(category);
  const ugc = /ugc|unbox|testimonial|review/.test(angle);
  const accentX = 120 + ((combinedSeed * 97) % 700);
  const accentY = 130 + ((combinedSeed * 53) % Math.max(300, height - 500));

  const scene =
    style === 0
      ? `<ellipse cx="${width / 2}" cy="${height * 0.58}" rx="390" ry="95" fill="${palette[0]}" opacity=".86"/>
         <path d="M0 ${height * 0.62} H${width} V${height} H0Z" fill="${palette[2]}" opacity=".34"/>
         <circle cx="${accentX}" cy="${accentY}" r="170" fill="${palette[1]}" opacity=".3"/>`
      : style === 1
        ? `<path d="M0 ${height * 0.72} C240 ${height * 0.61}, 700 ${height * 0.82}, ${width} ${height * 0.64} V${height} H0Z" fill="${palette[2]}" opacity=".42"/>
           <rect x="300" y="${height * 0.54}" width="480" height="165" rx="34" fill="${palette[0]}" opacity=".82"/>
           <circle cx="${accentX}" cy="${accentY}" r="220" fill="${palette[1]}" opacity=".24"/>`
        : style === 2
          ? `<path d="M-100 ${height * 0.22} Q280 ${height * 0.04} 560 ${height * 0.27} T1180 ${height * 0.17}" fill="none" stroke="${palette[1]}" stroke-width="170" opacity=".26"/>
             <ellipse cx="540" cy="${height * 0.7}" rx="430" ry="120" fill="${palette[0]}" opacity=".76"/>
             <circle cx="${accentX}" cy="${accentY}" r="100" fill="${palette[2]}" opacity=".22"/>`
          : style === 3
            ? `<rect x="80" y="${height * 0.08}" width="920" height="${height * 0.78}" rx="70" fill="#ffffff" opacity=".18"/>
             <path d="M0 ${height * 0.74} H${width} V${height} H0Z" fill="${palette[3]}" opacity=".35"/>
             <circle cx="${accentX}" cy="${accentY}" r="190" fill="${palette[1]}" opacity=".32"/>`
            : style === 4
              ? `<path d="M0 ${height * 0.35} Q${width / 2} ${height * 0.15} ${width} ${height * 0.4}" fill="none" stroke="${palette[2]}" stroke-width="120" opacity=".3"/>
                 <ellipse cx="${width / 2}" cy="${height * 0.78}" rx="500" ry="110" fill="${palette[0]}" opacity=".7"/>
                 <circle cx="${accentX}" cy="${accentY}" r="140" fill="${palette[1]}" opacity=".28"/>`
              : `<rect x="0" y="${height * 0.5}" width="${width}" height="${height * 0.5}" fill="${palette[3]}" opacity=".25"/>
                 <circle cx="${width * 0.25}" cy="${height * 0.35}" r="200" fill="${palette[1]}" opacity=".22"/>
                 <circle cx="${width * 0.78}" cy="${height * 0.62}" r="260" fill="${palette[0]}" opacity=".35"/>`;
  const props = food
    ? `<circle cx="105" cy="${height - 150}" r="68" fill="${palette[1]}" opacity=".4"/>
       <circle cx="970" cy="${height - 190}" r="48" fill="${palette[0]}" opacity=".42"/>`
    : `<rect x="55" y="${height - 250}" width="140" height="140" rx="30" fill="${palette[1]}" opacity=".28"/>
       <circle cx="965" cy="${height - 185}" r="70" fill="${palette[0]}" opacity=".4"/>`;
  const ugcFrame = ugc
    ? `<rect x="32" y="32" width="${width - 64}" height="${height - 64}" rx="44" fill="none" stroke="#ffffff" stroke-width="10" opacity=".45"/>
       <circle cx="92" cy="91" r="18" fill="#ff4b55"/>`
    : '';
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="${palette[0]}"/>
          <stop offset=".52" stop-color="${palette[1]}"/>
          <stop offset="1" stop-color="${palette[3]}"/>
        </linearGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="55"/></filter>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="${combinedSeed}"/>
          <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .07 0"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <g filter="url(#blur)">${scene}</g>
      ${props}
      ${ugcFrame}
      <rect width="100%" height="100%" filter="url(#grain)" opacity=".22"/>
    </svg>`;
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
  return new NextResponse(Uint8Array.from(png).buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
