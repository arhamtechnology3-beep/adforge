import { NextResponse } from 'next/server';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Demo mode is disabled in production' }, { status: 403 });
  }

  const response = NextResponse.json({ success: true, redirect: '/dashboard' });
  response.cookies.set('demo_session', 'true', {
    path: '/',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
  });
  return response;
}
