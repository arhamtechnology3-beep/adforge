import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getAdAccounts,
  storeToken,
} from '@/lib/meta';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(`${origin}/onboarding?error=meta_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/onboarding?error=meta_invalid`);
  }

  try {
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
    const shortToken = await exchangeCodeForToken(code);
    const longToken = await getLongLivedToken(shortToken.access_token);
    const adAccounts = await getAdAccounts(longToken.access_token);

    const supabase = await createClient();
    const expiresAt = new Date(
      Date.now() + (longToken.expires_in || 5184000) * 1000
    ).toISOString();

    const primaryAccount = adAccounts[0];

    const { error: upsertError } = await supabase.from('ad_accounts').upsert(
      {
        user_id: userId,
        meta_ad_account_id: primaryAccount?.id || null,
        access_token_encrypted: storeToken(longToken.access_token),
        token_expires_at: expiresAt,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (upsertError) throw upsertError;

    return NextResponse.redirect(`${origin}/onboarding?step=3&connected=true`);
  } catch (err) {
    console.error('[Meta OAuth Callback]', err);
    return NextResponse.redirect(`${origin}/onboarding?error=meta_failed`);
  }
}
