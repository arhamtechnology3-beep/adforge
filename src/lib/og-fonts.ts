import fs from 'fs';
import path from 'path';

function readFont(pkg: string, file: string): ArrayBuffer {
  return Uint8Array.from(
    fs.readFileSync(path.join(process.cwd(), 'node_modules/@fontsource', pkg, 'files', file))
  ).buffer;
}

/** Noto Sans (Latin + Devanagari) for Satori ImageResponse creatives. */
export function loadOgFonts() {
  return [
    { name: 'Noto Sans', data: readFont('noto-sans', 'noto-sans-latin-400-normal.woff'), weight: 400 as const },
    { name: 'Noto Sans', data: readFont('noto-sans', 'noto-sans-latin-700-normal.woff'), weight: 700 as const },
    {
      name: 'Noto Sans Devanagari',
      data: readFont('noto-sans-devanagari', 'noto-sans-devanagari-devanagari-400-normal.woff'),
      weight: 400 as const,
    },
    {
      name: 'Noto Sans Devanagari',
      data: readFont('noto-sans-devanagari', 'noto-sans-devanagari-devanagari-700-normal.woff'),
      weight: 700 as const,
    },
  ];
}
