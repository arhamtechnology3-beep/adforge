import { NextResponse } from 'next/server';
import { renderLocalBackgroundPng } from '@/lib/local-ad-background';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function numberParam(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.abs(Math.trunc(parsed)) : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seed = numberParam(searchParams.get('seed'), 1);
  const aspect =
    searchParams.get('aspect') === '9:16'
      ? '9:16'
      : searchParams.get('aspect') === '4:5'
        ? '4:5'
        : '1:1';
  const png = await renderLocalBackgroundPng({
    seed,
    aspect,
    category: searchParams.get('category') || '',
    angle: searchParams.get('angle') || '',
    preset: searchParams.get('preset') || '',
  });
  return new NextResponse(Uint8Array.from(png).buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
