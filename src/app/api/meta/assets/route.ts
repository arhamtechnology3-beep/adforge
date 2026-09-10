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
  getAdAccounts,
  getFacebookPages,
  getAdAccountPixels,
  getAdAccountStatus,
  isWebsiteMetaPixel,
  normalizeMetaAdAccountId,
  pickBestFacebookPage,
  pickBestWebsitePixel,
  describeAdAccountBlocker,
} from '@/lib/meta';

function accountKey(id: string): string {
  return normalizeMetaAdAccountId(id).replace(/^act_/, '');
}

/** List ad accounts + Pages + Pixels for this client's Meta connection. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const connection = await resolveMetaConnection(user);
  if (!metaConnectionIsLive(connection) || !connection) {
    return NextResponse.json({ error: 'Meta not connected' }, { status: 400 });
  }

  try {
    const token = metaAccessToken(connection);
    const storedAccountId = connection.meta_ad_account_id!;
    const [pages, allAccounts] = await Promise.all([
      getFacebookPages(token),
      getAdAccounts(token),
    ]);

    const accounts = allAccounts.map((a) => ({
      id: a.id,
      name: a.name || a.id,
      account_status: a.account_status ?? null,
      timezone_name: a.timezone_name || null,
      blocked: Boolean(describeAdAccountBlocker(a.account_status)),
    }));

    // Prefer stored account; if missing from Meta list, fall back to first
    let adAccountId = storedAccountId;
    if (
      accounts.length &&
      !accounts.some((a) => accountKey(a.id) === accountKey(storedAccountId))
    ) {
      adAccountId = accounts[0].id;
    }

    const [pixels, accountInfo] = await Promise.all([
      getAdAccountPixels(token, adAccountId),
      getAdAccountStatus(token, adAccountId).catch(() => null),
    ]);

    const websitePixels = pixels.filter(isWebsiteMetaPixel);
    const otherPixels = pixels.filter((p) => !isWebsiteMetaPixel(p));

    const selectedPageId = connection.page_id || null;
    const selectedPageName = connection.page_name || null;
    let selectedPixelId = connection.pixel_id || null;
    let selectedPixelName = connection.pixel_name || null;

    if (
      selectedPixelId &&
      !websitePixels.some((p) => p.id === selectedPixelId)
    ) {
      selectedPixelId = null;
      selectedPixelName = null;
    }

    const accountName =
      accountInfo?.name ||
      accounts.find((a) => accountKey(a.id) === accountKey(adAccountId))?.name ||
      connection.meta_ad_account_name ||
      null;

    return NextResponse.json({
      meta_ad_account_id: adAccountId,
      meta_ad_account_name: accountName,
      ad_accounts: accounts,
      selected: {
        page_id: selectedPageId,
        page_name: selectedPageName,
        pixel_id: selectedPixelId,
        pixel_name: selectedPixelName,
      },
      suggested: {
        page: pickBestFacebookPage(pages, {
          brandHints: [
            selectedPixelName,
            accountName,
            selectedPageName,
          ].filter(Boolean) as string[],
        }),
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

/** Save ad account and/or Page + Pixel for this client. */
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
  let pixelId = String(body.pixel_id || '').trim() || null;
  let pixelName = String(body.pixel_name || '').trim() || null;
  const requestedAccountId = String(body.meta_ad_account_id || '').trim() || null;

  if (pageId && !/^\d{5,}$/.test(pageId)) {
    return NextResponse.json({ error: 'Invalid Page ID' }, { status: 400 });
  }
  if (pixelId && !/^\d{5,}$/.test(pixelId)) {
    return NextResponse.json({ error: 'Invalid Pixel ID' }, { status: 400 });
  }

  const token = metaAccessToken(connection);
  let nextAccountId = connection.meta_ad_account_id!;
  let timezone_id = connection.timezone_id ?? null;
  let timezone_name = connection.timezone_name ?? null;
  let timezone_offset_hours_utc = connection.timezone_offset_hours_utc ?? null;
  let accountName = connection.meta_ad_account_name || null;

  if (requestedAccountId) {
    const accounts = await getAdAccounts(token);
    const match = accounts.find(
      (a) => accountKey(a.id) === accountKey(requestedAccountId)
    );
    if (!match) {
      return NextResponse.json(
        {
          error:
            'That ad account is not visible to this Facebook login. In Ads Manager, open the new account once, then Reconnect Facebook in AdForge and try again.',
        },
        { status: 400 }
      );
    }
    nextAccountId = match.id;
    accountName = match.name || null;
    timezone_id = match.timezone_id ?? null;
    timezone_name = match.timezone_name ?? null;
    timezone_offset_hours_utc = match.timezone_offset_hours_utc ?? null;

    // Pixel must belong to the selected ad account
    if (pixelId) {
      try {
        const pixels = await getAdAccountPixels(token, nextAccountId);
        if (!pixels.some((p) => p.id === pixelId)) {
          pixelId = null;
          pixelName = null;
        }
      } catch {
        pixelId = null;
        pixelName = null;
      }
    }
  }

  const patch = {
    meta_ad_account_id: nextAccountId,
    page_id: pageId,
    page_name: pageName,
    pixel_id: pixelId,
    pixel_name: pixelName,
    timezone_id,
    timezone_name,
    timezone_offset_hours_utc,
  };

  if (user.isDemo) {
    await saveDemoMetaConnection({
      ...connection,
      ...patch,
      meta_ad_account_name: accountName,
    });
    return NextResponse.json({
      ok: true,
      ...patch,
      meta_ad_account_name: accountName,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('ad_accounts').update(patch).eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ...patch,
    meta_ad_account_name: accountName,
  });
}
