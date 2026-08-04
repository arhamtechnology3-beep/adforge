import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { META_AD_FORMATS, type MetaAdFormat } from '@/lib/creatives';
import type { AdMediaPayload } from '@/types/database';

/** Manually add a client creative into Step 2 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const campaign_input_id = body.campaign_input_id as string;
  if (!campaign_input_id) {
    return NextResponse.json({ error: 'campaign_input_id required' }, { status: 400 });
  }

  const { data: campaignInput } = await supabase
    .from('campaigns_input')
    .select('id')
    .eq('id', campaign_input_id)
    .eq('user_id', user.id)
    .single();

  if (!campaignInput) {
    return NextResponse.json({ error: 'Campaign input not found' }, { status: 404 });
  }

  const adFormat = (
    ['single_image', 'carousel', 'stories', 'video'].includes(body.ad_format)
      ? body.ad_format
      : 'single_image'
  ) as MetaAdFormat;

  const headline = String(body.headline || 'Your product').slice(0, 40);
  const copy_text = String(body.copy_text || '').slice(0, 2200);
  const image_url = String(body.image_url || '').trim();

  if (!copy_text) {
    return NextResponse.json({ error: 'Primary text is required' }, { status: 400 });
  }
  if (!image_url) {
    return NextResponse.json({ error: 'Image / creative URL is required' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('generated_ads')
    .select('variant_number')
    .eq('campaign_input_id', campaign_input_id)
    .order('variant_number', { ascending: false })
    .limit(1);

  const variant_number = (existing?.[0]?.variant_number || 0) + 1;

  const media_payload: AdMediaPayload = {
    placement: META_AD_FORMATS[adFormat].placement,
    aspect: adFormat === 'stories' ? '9:16' : '1:1',
    manual: true,
    product_images: image_url ? [image_url] : [],
    ...(body.media_payload && typeof body.media_payload === 'object' ? body.media_payload : {}),
  };

  const { data, error } = await supabase
    .from('generated_ads')
    .insert({
      campaign_input_id,
      variant_number,
      copy_text,
      image_url,
      status: 'pending',
      ad_format: adFormat,
      media_payload,
      headline,
      angle: 'manual',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
