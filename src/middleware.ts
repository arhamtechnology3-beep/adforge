import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/demo-product-packshot|api/ads/background|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
