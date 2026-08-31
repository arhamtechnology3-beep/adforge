import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { GeneratedAd } from '@/types/database';
import { DEMO_CAMPAIGN_INPUT_ID } from '@/lib/auth/demo-onboarding';

export const DEMO_ADS_COOKIE = 'demo_generated_ads';

export async function readDemoAds(): Promise<GeneratedAd[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DEMO_ADS_COOKIE)?.value;
  if (!raw) return [];
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

export function withDemoAdsCookie(response: NextResponse, ads: GeneratedAd[]) {
  response.cookies.set(DEMO_ADS_COOKIE, encodeURIComponent(JSON.stringify(ads)), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
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
