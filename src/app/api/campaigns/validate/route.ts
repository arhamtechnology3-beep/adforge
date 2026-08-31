import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isTokenExpired } from '@/lib/meta';
import { validateCampaignLaunch } from '@/lib/campaign-validation';
import type { GeneratedAd } from '@/types/database';
import { getSessionUser } from '@/lib/auth/session';

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { ad_ids, ...input } = body;

  const supabase = await createClient();

  const { data: adAccount } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const metaConnected =
    !!adAccount?.access_token_encrypted &&
    !!adAccount?.meta_ad_account_id &&
    !isTokenExpired(adAccount.token_expires_at);

  let ads: Array<{
    id: string;
    copy_text: string;
    headline: string | null;
    image_url: string | null;
    status: string;
  }> = [];

  if (ad_ids?.length) {
    const { data } = await supabase
      .from('generated_ads')
      .select('id, copy_text, headline, image_url, status')
      .in('id', ad_ids);
    ads = data || [];
  }

  const result = validateCampaignLaunch({
    input: { ...input, ad_ids },
    ads: ads as GeneratedAd[],
    meta_connected: metaConnected,
    has_pixel: !!process.env.META_PIXEL_ID,
    page_id: process.env.META_PAGE_ID || null,
  });

  return NextResponse.json(result);
}
