import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import {
  metaAccessToken,
  metaConnectionIsLive,
  resolveMetaConnection,
  saveDemoMetaConnection,
} from '@/lib/auth/demo-meta';
import {
  getFacebookPages,
  getAdAccountPixels,
  isWebsiteMetaPixel,
  pickBestFacebookPage,
  pickBestWebsitePixel,
} from '@/lib/meta';

/** List Pages + Pixels for this client's Meta connection (multi-tenant). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const connection = await resolveMetaConnection(user);
  if (!metaConnectionIsLive(connection) || !connection) {
    return NextResponse.json({ error: 'Meta not connected' }, { status: 400 });
  }

  try {
    const token = metaAccessToken(connection);
    const adAccountId = connection.meta_ad_account_id!;
    const [pages, pixels] = await Promise.all([
      getFacebookPages(token),
      getAdAccountPixels(token, adAccountId),
    ]);

    const websitePixels = pixels.filter(isWebsiteMetaPixel);
    const otherPixels = pixels.filter((p) => !isWebsiteMetaPixel(p));

    const selectedPageId = connection.page_id || null;
    const selectedPageName = connection.page_name || null;
    let selectedPixelId = connection.pixel_id || null;
    let selectedPixelName = connection.pixel_name || null;

    // If a WhatsApp dataset was wrongly stored, clear it in the response (client can Save)
    if (
      selectedPixelId &&
      !websitePixels.some((p) => p.id === selectedPixelId)
    ) {
      selectedPixelId = null;
      selectedPixelName = null;
    }

    return NextResponse.json({
      meta_ad_account_id: adAccountId,
      selected: {
        page_id: selectedPageId,
        page_name: selectedPageName,
        pixel_id: selectedPixelId,
        pixel_name: selectedPixelName,
      },
      suggested: {
        page: pickBestFacebookPage(pages),
        pixel: pickBestWebsitePixel(pixels),
      },
      pages: pages.map((p) => ({ id: p.id, name: p.name || p.id })),
      pixels: websitePixels.map((p) => ({
        id: p.id,
        name: p.name || p.id,
        kind: 'website' as const,
      })),
      skipped_pixels: otherPixels.map((p) => ({
        id: p.id,
        name: p.name || p.id,
        kind: 'whatsapp_or_other' as const,
      })),
    });
  } catch (err) {
    console.error('[Meta Assets GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load Meta assets' },
      { status: 502 }
    );
  }
}

/** Save this client's chosen Page + Pixel (never use global env for other tenants). */
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const connection = await resolveMetaConnection(user);
  if (!metaConnectionIsLive(connection) || !connection) {
    return NextResponse.json({ error: 'Meta not connected' }, { status: 400 });
  }

  const body = await request.json();
  const pageId = String(body.page_id || '').trim() || null;
  const pageName = String(body.page_name || '').trim() || null;
  const pixelId = String(body.pixel_id || '').trim() || null;
  const pixelName = String(body.pixel_name || '').trim() || null;

  if (pageId && !/^\d{5,}$/.test(pageId)) {
    return NextResponse.json({ error: 'Invalid Page ID' }, { status: 400 });
  }
  if (pixelId && !/^\d{5,}$/.test(pixelId)) {
    return NextResponse.json({ error: 'Invalid Pixel ID' }, { status: 400 });
  }

  if (user.isDemo) {
    await saveDemoMetaConnection({
      ...connection,
      page_id: pageId,
      page_name: pageName,
      pixel_id: pixelId,
      pixel_name: pixelName,
    });
    return NextResponse.json({
      ok: true,
      page_id: pageId,
      page_name: pageName,
      pixel_id: pixelId,
      pixel_name: pixelName,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('ad_accounts')
    .update({
      page_id: pageId,
      page_name: pageName,
      pixel_id: pixelId,
      pixel_name: pixelName,
    })
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    page_id: pageId,
    page_name: pageName,
    pixel_id: pixelId,
    pixel_name: pixelName,
  });
}
