import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scrapeWebsite, generateAdCopy, generateAdImage, AD_ANGLES } from '@/lib/ai';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { campaign_input_id } = await request.json();

  const { data: campaignInput } = await supabase
    .from('campaigns_input')
    .select('*')
    .eq('id', campaign_input_id)
    .eq('user_id', user.id)
    .single();

  if (!campaignInput) {
    return NextResponse.json({ error: 'Campaign input not found' }, { status: 404 });
  }

  const websiteContent = await scrapeWebsite(campaignInput.website_url);

  const competitors =
    Array.isArray(campaignInput.competitors) && campaignInput.competitors.length > 0
      ? campaignInput.competitors
      : campaignInput.competitor_url
        ? [{ url: campaignInput.competitor_url, type: campaignInput.competitor_type || 'website' }]
        : [];

  const variants = await generateAdCopy(websiteContent, competitors);

  const ads = [];
  for (const variant of variants) {
    const angle = AD_ANGLES.find((a) => a.angle === variant.angle) || AD_ANGLES[0];
    const imageUrl = await generateAdImage(
      variant.copy_text,
      angle.angle,
      variant.variant_number
    );

    ads.push({
      campaign_input_id: campaignInput.id,
      variant_number: variant.variant_number,
      copy_text: variant.copy_text,
      image_url: imageUrl,
      status: 'pending' as const,
    });
  }

  const { data: savedAds, error } = await supabase
    .from('generated_ads')
    .insert(ads)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ads: savedAds, count: savedAds?.length || 0 });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const campaignInputId = searchParams.get('campaign_input_id');

  if (!campaignInputId) {
    return NextResponse.json({ error: 'campaign_input_id required' }, { status: 400 });
  }

  const { data: ads } = await supabase
    .from('generated_ads')
    .select('*')
    .eq('campaign_input_id', campaignInputId)
    .order('variant_number');

  return NextResponse.json({ ads: ads || [] });
}
