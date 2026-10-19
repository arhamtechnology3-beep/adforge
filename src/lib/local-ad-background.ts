import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

const PALETTES = [
  ['#fff4dc', '#e5a24b', '#64351f', '#271c2f'],
  ['#e8f5ee', '#78b69b', '#17594a', '#102a43'],
  ['#f5eaff', '#b18ae0', '#633c8f', '#251938'],
  ['#fff0ed', '#ef8f72', '#a33f4b', '#30213c'],
  ['#eef4ff', '#86a9df', '#35558a', '#18243d'],
  ['#f6f3df', '#bbb36d', '#65602d', '#24281c'],
] as const;

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
  'diwali-thali-incomplete': ['#fff4dc', '#f0a202', '#c44900', '#3d1f0a'],
  'diwali-flavours-of-home': ['#fff8e7', '#e8a838', '#8b4513', '#2c1810'],
  'diwali-taste-of-tradition': ['#fff0d4', '#d4af37', '#b45309', '#422006'],
  'diwali-ghar-ka-swaad-stories': ['#ffedd5', '#f97316', '#9a3412', '#1c0a00'],
};

export type LocalBackgroundInput = {
  category?: string;
  angle?: string;
  seed?: number;
  aspect?: '1:1' | '4:5' | '9:16';
  preset?: string;
};

/** Render local Meta ad backdrop PNG (shared by /api/ads/background + Diwali force path). */
export async function renderLocalBackgroundPng(input: LocalBackgroundInput): Promise<Buffer> {
  const seed = Number.isFinite(input.seed) ? Math.abs(Math.trunc(input.seed || 1)) : 1;
  const aspect = input.aspect === '9:16' ? '9:16' : input.aspect === '4:5' ? '4:5' : '1:1';
  const category = (input.category || '').toLowerCase();
  const angle = (input.angle || '').toLowerCase();
  const preset = (input.preset || '').toLowerCase();
  const width = 1080;
  const height = aspect === '9:16' ? 1920 : aspect === '4:5' ? 1350 : 1080;
  const angleHash = angle.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const combinedSeed = seed + angleHash * 19 + category.length * 7 + preset.length * 11;
  const palette = PRESET_PALETTES[preset] || PALETTES[combinedSeed % PALETTES.length];
  const style = combinedSeed % 6;
  const food = /food|pickle|spice|snack|grocery|drink|beverage/.test(category);
  const ugc = /ugc|unbox|testimonial|review/.test(angle);
  const diwali = preset.startsWith('diwali') || /diwali|festive|thali/.test(angle + preset);
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
  const diwaliProps = diwali
    ? `
      <rect x="0" y="0" width="${width}" height="${Math.round(height * 0.14)}" fill="${palette[2]}" opacity=".45"/>
      <circle cx="70" cy="55" r="22" fill="#f97316"/>
      <circle cx="130" cy="48" r="16" fill="#fb923c"/>
      <circle cx="190" cy="58" r="20" fill="#ea580c"/>
      <circle cx="250" cy="45" r="14" fill="#fdba74"/>
      <circle cx="${width - 70}" cy="55" r="22" fill="#f97316"/>
      <circle cx="${width - 130}" cy="48" r="16" fill="#fb923c"/>
      <circle cx="${width - 190}" cy="58" r="20" fill="#ea580c"/>
      <circle cx="${width - 250}" cy="45" r="14" fill="#fdba74"/>
      <ellipse cx="${width / 2}" cy="${height * 0.78}" rx="460" ry="90" fill="${palette[2]}" opacity=".4"/>
      <circle cx="150" cy="${height - 200}" r="48" fill="#c2410c"/>
      <circle cx="150" cy="${height - 200}" r="34" fill="#f59e0b"/>
      <circle cx="150" cy="${height - 235}" r="16" fill="#fff7ed"/>
      <circle cx="${width - 150}" cy="${height - 210}" r="44" fill="#c2410c"/>
      <circle cx="${width - 150}" cy="${height - 210}" r="30" fill="#f59e0b"/>
      <circle cx="${width - 150}" cy="${height - 242}" r="14" fill="#fff7ed"/>
      <circle cx="280" cy="${height - 160}" r="28" fill="#c2410c" opacity=".9"/>
      <circle cx="280" cy="${height - 182}" r="10" fill="#fff7ed"/>
      <circle cx="${width - 280}" cy="${height - 155}" r="26" fill="#c2410c" opacity=".9"/>
      <circle cx="${width - 280}" cy="${height - 176}" r="9" fill="#fff7ed"/>
      <ellipse cx="${width / 2}" cy="${height * 0.55}" rx="210" ry="210" fill="none" stroke="#f59e0b" stroke-width="18" opacity=".55"/>
      <ellipse cx="${width / 2}" cy="${height * 0.55}" rx="160" ry="160" fill="#fff7ed" opacity=".35"/>
    `
    : '';
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
      ${diwaliProps}
      ${ugcFrame}
      <rect width="100%" height="100%" filter="url(#grain)" opacity=".22"/>
    </svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
}

/** Write a local backdrop into public/uploads/scenes and return a relative URL. */
export async function writeLocalBackgroundFile(input: LocalBackgroundInput): Promise<string> {
  const png = await renderLocalBackgroundPng(input);
  const dir = path.join(process.cwd(), 'public', 'uploads', 'scenes');
  await mkdir(dir, { recursive: true });
  const filename = `bg-${Date.now()}-${randomUUID().slice(0, 8)}.png`;
  await writeFile(path.join(dir, filename), png);
  return `/uploads/scenes/${filename}`;
}
