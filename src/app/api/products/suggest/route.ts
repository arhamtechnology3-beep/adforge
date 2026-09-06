import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import {
  enrichProductSuggestions,
  parseProductPageHtml,
  suggestProductFromPage,
} from '@/lib/product-page-suggestions';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const productUrl = typeof body.product_url === 'string' ? body.product_url.trim() : '';
  if (!productUrl) {
    return NextResponse.json({ error: 'product_url is required' }, { status: 400 });
  }

  try {
    return NextResponse.json(await suggestProductFromPage(productUrl));
  } catch (directError) {
    try {
      const workerPort = process.env.AD_LIBRARY_WORKER_PORT || '3021';
      const response = await fetch(`http://127.0.0.1:${workerPort}/product-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl }),
        signal: AbortSignal.timeout(45000),
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || !payload.html || !payload.url) {
        throw new Error(payload.error || 'Browser importer could not read this page');
      }
      return NextResponse.json(
        enrichProductSuggestions(parseProductPageHtml(payload.html, payload.url))
      );
    } catch (workerError) {
      const error =
        workerError instanceof Error && workerError.message
          ? workerError
          : directError;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not import the product page',
      },
      { status: 422 }
    );
    }
  }
}
