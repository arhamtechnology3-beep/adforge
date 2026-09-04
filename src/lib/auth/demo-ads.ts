import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { GeneratedAd } from '@/types/database';
import { DEMO_CAMPAIGN_INPUT_ID } from '@/lib/auth/demo-onboarding';
import { DEMO_USER } from '@/lib/auth/session';

export const DEMO_ADS_COOKIE = 'demo_generated_ads';

/** Prefer file storage — carousel payloads exceed browser cookie size (~4KB). */
function demoAdsFilePath(userId = DEMO_USER.id): string {
  return path.join(process.cwd(), '.data', `demo-ads-${userId}.json`);
}

async function readDemoAdsFromFile(userId = DEMO_USER.id): Promise<GeneratedAd[] | null> {
  try {
    const raw = await readFile(demoAdsFilePath(userId), 'utf8');
    const parsed = JSON.parse(raw) as GeneratedAd[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeDemoAdsToFile(ads: GeneratedAd[], userId = DEMO_USER.id): Promise<void> {
  const dir = path.dirname(demoAdsFilePath(userId));
  await mkdir(dir, { recursive: true });
  await writeFile(demoAdsFilePath(userId), JSON.stringify(ads), 'utf8');
}

export async function readDemoAds(): Promise<GeneratedAd[]> {
  const fromFile = await readDemoAdsFromFile();
  if (fromFile) return fromFile;

  // Legacy fallback: small packs still in cookie (ignore marker "file")
  const cookieStore = await cookies();
  const raw = cookieStore.get(DEMO_ADS_COOKIE)?.value;
  if (!raw || raw === 'file') return [];
  try {
    return JSON.parse(decodeURIComponent(raw)) as GeneratedAd[];
  } catch {
    try {
      return JSON.parse(raw) as GeneratedAd[];
    } catch {
      return [];
    }
  }
}

export async function saveDemoAds(ads: GeneratedAd[]): Promise<void> {
  await writeDemoAdsToFile(ads);
}

export function withDemoAdsCookie(response: NextResponse) {
  // Persist reliably on disk (async fire-and-forget is unsafe here — caller should await saveDemoAds).
  // Keep a tiny cookie marker so older clients still know demo ads exist.
  response.cookies.set(DEMO_ADS_COOKIE, 'file', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

/** Save demo ads to disk and attach a small cookie marker on the response. */
export async function persistDemoAds(
  response: NextResponse,
  ads: GeneratedAd[]
): Promise<NextResponse> {
  await saveDemoAds(ads);
  return withDemoAdsCookie(response);
}

export function normalizeDemoAd(ad: Record<string, unknown>, index: number): GeneratedAd {
  const now = new Date().toISOString();
  return {
    id: String(ad.id || `demo-ad-${index}-${Date.now()}`),
    campaign_input_id: String(ad.campaign_input_id || DEMO_CAMPAIGN_INPUT_ID),
    variant_number: Number(ad.variant_number) || index + 1,
    copy_text: String(ad.copy_text || ''),
    image_url: ad.image_url ? String(ad.image_url) : null,
    status: (ad.status as GeneratedAd['status']) || 'pending',
    ad_format: (ad.ad_format as GeneratedAd['ad_format']) || 'single_image',
    media_payload: (ad.media_payload as GeneratedAd['media_payload']) || {},
    headline: ad.headline ? String(ad.headline) : null,
    angle: ad.angle ? String(ad.angle) : null,
    created_at: String(ad.created_at || now),
  };
}
