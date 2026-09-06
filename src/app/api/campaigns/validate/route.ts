import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCampaignLaunch } from '@/lib/campaign-validation';
import type { GeneratedAd } from '@/types/database';
import { getSessionUser } from '@/lib/auth/session';
import {
  metaAccessToken,
  metaConnectionIsLive,
  resolveMetaConnection,
} from '@/lib/auth/demo-meta';
import { readDemoAds } from '@/lib/auth/demo-ads';
import { ensureFacebookPageId } from '@/lib/meta';

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { ad_ids, ...input } = body;

  const metaConnection = await resolveMetaConnection(user);
  const metaConnected = metaConnectionIsLive(metaConnection);

  let pageId = metaConnection?.page_id || process.env.META_PAGE_ID || null;
  if (metaConnected && metaConnection && (!pageId || pageId === 'me')) {
    try {
      const resolved = await ensureFacebookPageId({
        accessToken: metaAccessToken(metaConnection),
        storedPageId: metaConnection.page_id,
      });
      pageId = resolved.pageId;
      if (resolved.source === 'live' && !user.isDemo) {
        const supabase = await createClient();
        await supabase
          .from('ad_accounts')
          .update({ page_id: resolved.pageId, page_name: resolved.pageName || null })
          .eq('user_id', user.id);
      }
    } catch {
      pageId = null;
    }
  }

  let ads: Array<{
    id: string;
    copy_text: string;
    headline: string | null;
    image_url: string | null;
    status: string;
  }> = [];

  if (ad_ids?.length) {
    if (user.isDemo) {
      const demoAds = await readDemoAds();
      ads = demoAds
        .filter((ad) => ad_ids.includes(ad.id))
        .map((ad) => ({
          id: ad.id,
          copy_text: ad.copy_text,
          headline: ad.headline,
          image_url: ad.image_url,
          status: ad.status,
        }));
    } else {
      const supabase = await createClient();
      const { data } = await supabase
        .from('generated_ads')
        .select('id, copy_text, headline, image_url, status')
        .in('id', ad_ids);
      ads = data || [];
    }
  }

  const result = validateCampaignLaunch({
    input: { ...input, ad_ids },
    ads: ads as GeneratedAd[],
    meta_connected: metaConnected,
    has_pixel: !!process.env.META_PIXEL_ID,
    page_id: pageId,
  });

  return NextResponse.json(result);
}
