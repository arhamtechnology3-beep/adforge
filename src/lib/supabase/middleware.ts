import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const isDemo = request.cookies.get('demo_session')?.value === 'true';

  let user = null;
  if (!isDemo) {
    try {
      const { data } = await Promise.race([
        supabase.auth.getUser(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('supabase-timeout')), 3000)
        ),
      ]);
      user = data.user;
    } catch {
      // Supabase network / DNS / timeout — allow login + demo fallback
    }
  }

  const effectiveUser = user || (isDemo ? { id: 'demo-user-id', email: 'jesalp85@gmail.com' } : null);

  const isPublicPage =
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/privacy') ||
    request.nextUrl.pathname.startsWith('/terms') ||
    request.nextUrl.pathname.startsWith('/data-deletion');
  const isAuthPage =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup');
  const isPublicApi =
    request.nextUrl.pathname.startsWith('/api/webhooks') ||
    request.nextUrl.pathname.startsWith('/api/oauth/meta/callback') ||
    request.nextUrl.pathname.startsWith('/api/ads/creative') ||
    request.nextUrl.pathname.startsWith('/api/ads/product-image') ||
    request.nextUrl.pathname.startsWith('/api/auth/demo');

  if (!effectiveUser && !isAuthPage && !isPublicApi && !isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (effectiveUser && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
