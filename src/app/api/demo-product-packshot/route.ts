import { NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';

export async function GET() {
  const svg = `
    <svg width="900" height="1100" viewBox="0 0 900 1100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pack" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#fff7df"/>
          <stop offset="1" stop-color="#f6c85f"/>
        </linearGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="22" flood-opacity=".24"/></filter>
      </defs>
      <g filter="url(#shadow)">
        <path d="M190 90h520l62 95v800c0 42-34 76-76 76H204c-42 0-76-34-76-76V185z" fill="url(#pack)"/>
        <path d="M190 90h520l62 95H128z" fill="#173f35"/>
        <rect x="184" y="278" width="532" height="514" rx="34" fill="#fffdf6" stroke="#173f35" stroke-width="8"/>
        <circle cx="450" cy="415" r="84" fill="#df6f2b"/>
        <path d="M395 425c40-55 79-55 110 0-34-17-70-17-110 0z" fill="#fff7df"/>
        <text x="450" y="560" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#173f35">AAROHI PANTRY</text>
        <text x="450" y="635" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#9c3f1d">EVERYDAY</text>
        <text x="450" y="702" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#9c3f1d">MASALA BLEND</text>
        <text x="450" y="750" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#173f35">DEMO PRODUCT • 200 g</text>
      </g>
    </svg>`;
  const image = await sharp(Buffer.from(svg)).png().toBuffer();
  return new NextResponse(Uint8Array.from(image).buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
