import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { CompetitorEntry } from '@/types/database';

export const DEMO_ONBOARDING_COOKIE = 'demo_onboarding';
export const DEMO_CAMPAIGN_INPUT_ID = 'demo-campaign-input-id';

export type DemoOnboarding = {
  id: string;
  user_id: string;
  website_url: string;
  competitors: CompetitorEntry[];
  competitor_url: string | null;
  competitor_type: string | null;
  meta_connected: boolean;
  demo: true;
};

export async function readDemoOnboarding(): Promise<DemoOnboarding | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DEMO_ONBOARDING_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as DemoOnboarding;
  } catch {
    try {
      return JSON.parse(raw) as DemoOnboarding;
    } catch {
      return null;
    }
  }
}

export function withDemoOnboardingCookie(response: NextResponse, data: DemoOnboarding) {
  response.cookies.set(DEMO_ONBOARDING_COOKIE, encodeURIComponent(JSON.stringify(data)), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
