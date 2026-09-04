import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import {
  CAROUSEL_URL_MAX,
  CAROUSEL_URL_MIN,
  resolveCarouselProductUrls,
} from '@/lib/carousel-from-urls';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Preview-resolve product page URLs into carousel card candidates (image + title + link). */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { products, urls } = await resolveCarouselProductUrls(
    body.product_urls ?? body.urls ?? body.text
  );

  if (urls.length < CAROUSEL_URL_MIN) {
    return NextResponse.json(
      {
        error: `Paste at least ${CAROUSEL_URL_MIN} product URLs (max ${CAROUSEL_URL_MAX}).`,
        products,
        urls,
      },
      { status: 400 }
    );
  }

  const ready = products.filter((p) => p.image_url);
  const failed = products.filter((p) => !p.image_url);

  return NextResponse.json({
    products,
    ready_count: ready.length,
    failed_count: failed.length,
    urls,
    note:
      failed.length > 0
        ? `${failed.length} URL(s) had no image and will be skipped when generating.`
        : undefined,
  });
}
