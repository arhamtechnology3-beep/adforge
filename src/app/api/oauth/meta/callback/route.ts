import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getAdAccounts,
  getFacebookPages,
  storeToken,
} from '@/lib/meta';
import { exchangeCodeForToken, getLongLivedToken } from '@/lib/meta-oauth';
import { saveDemoMetaConnection } from '@/lib/auth/demo-meta';
import { readDemoOnboarding, withDemoOnboardingCookie } from '@/lib/auth/demo-onboarding';
import { DEMO_USER } from '@/lib/auth/session';
import { getMetaAppConfig } from '@/lib/meta-app-config';

async function parseState(raw: string | null): Promise<{
  userId: string;
  isDemo: boolean;
  returnTo: string;
} | null> {
  if (!raw) return null;
  try {
    const json = JSON.parse(
      Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    ) as { userId?: string; isDemo?: boolean; returnTo?: string };
    if (!json.userId) return null;
    return {
      userId: json.userId,
      isDemo: Boolean(json.isDemo),
      returnTo: json.returnTo || '/campaigns?connected=true',
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateRaw = searchParams.get('state');
  const error = searchParams.get('error');
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  if (error) {
    return NextResponse.redirect(`${origin}/campaigns?error=meta_denied`);
  }

  const state = await parseState(stateRaw);
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/campaigns?error=meta_invalid`);
  }

  try {
    if (!getMetaAppConfig()) {
      return NextResponse.redirect(`${origin}/campaigns?error=meta_platform_setup`);
    }

    const shortToken = await exchangeCodeForToken(code);
    const longToken = await getLongLivedToken(shortToken.access_token);
    const [adAccounts, pages] = await Promise.all([
      getAdAccounts(longToken.access_token),
      getFacebookPages(longToken.access_token),
    ]);
    const primaryAccount = adAccounts[0];
    const primaryPage = pages[0];
    const expiresAt = new Date(
      Date.now() + (longToken.expires_in || 5184000) * 1000
    ).toISOString();
    const encrypted = storeToken(longToken.access_token);
    const pageId = primaryPage?.id || process.env.META_PAGE_ID || null;

    if (state.isDemo || state.userId === DEMO_USER.id) {
      await saveDemoMetaConnection({
        user_id: state.userId || DEMO_USER.id,
        meta_ad_account_id: primaryAccount?.id || null,
        meta_ad_account_name: primaryAccount?.name || null,
        access_token_encrypted: encrypted,
        token_expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        page_id: pageId,
      });

      const onboarding = await readDemoOnboarding();
      const response = NextResponse.redirect(
        `${origin}${state.returnTo.startsWith('/') ? state.returnTo : '/campaigns?connected=true'}`
      );
      if (onboarding) {
        return withDemoOnboardingCookie(response, { ...onboarding, meta_connected: true });
      }
      return response;
    }

    const supabase = await createClient();
    const { error: upsertError } = await supabase.from('ad_accounts').upsert(
      {
        user_id: state.userId,
        meta_ad_account_id: primaryAccount?.id || null,
        access_token_encrypted: encrypted,
        token_expires_at: expiresAt,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (upsertError) throw upsertError;

    return NextResponse.redirect(
      `${origin}${state.returnTo.startsWith('/') ? state.returnTo : '/campaigns?connected=true'}`
    );
  } catch (err) {
    console.error('[Meta OAuth Callback]', err);
    return NextResponse.redirect(`${origin}/campaigns?error=meta_failed`);
  }
}
