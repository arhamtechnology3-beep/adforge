import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getMetaAppPublicStatus, savePlatformMetaApp } from '@/lib/meta-app-config';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(getMetaAppPublicStatus());
}

/**
 * One-time platform Meta App install (AdForge app credentials).
 * Customers do NOT call this — they only Facebook-login via /api/oauth/meta/connect.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const appId = typeof body.app_id === 'string' ? body.app_id : '';
  const appSecret = typeof body.app_secret === 'string' ? body.app_secret : '';
  const redirectUri = typeof body.redirect_uri === 'string' ? body.redirect_uri : undefined;

  try {
    const status = savePlatformMetaApp({ appId, appSecret, redirectUri });
    return NextResponse.json({
      ...status,
      note: 'Platform Meta App saved. Customers can now Connect Meta with one Facebook login — they never enter App Secret.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save Meta App' },
      { status: 400 }
    );
  }
}
