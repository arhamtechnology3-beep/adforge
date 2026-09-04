import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getMetaAuthUrl } from '@/lib/meta-oauth';
import { getMetaAppConfig } from '@/lib/meta-app-config';

/**
 * One-click customer Meta connect.
 * Uses AdForge's platform Meta App; customer only Facebook-logins and grants ad account access.
 */
export async function GET(request: Request) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const user = await getSessionUser();

  if (!user) {
    // Keep flow one-click in local/demo: start demo session then continue to Facebook
    const res = NextResponse.redirect(`${origin}/api/oauth/meta/connect`);
    res.cookies.set('demo_session', 'true', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  }

  const cfg = getMetaAppConfig();
  if (!cfg) {
    // Platform app not installed yet — send operator to setup (not customer secrets)
    return NextResponse.redirect(`${origin}/campaigns?error=meta_platform_setup`);
  }

  const state = Buffer.from(
    JSON.stringify({
      userId: user.id,
      isDemo: user.isDemo,
      returnTo: '/campaigns?connected=true',
    })
  ).toString('base64url');

  return NextResponse.redirect(getMetaAuthUrl(state));
}
