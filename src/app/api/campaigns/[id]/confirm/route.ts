import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { retrieveToken, activateCampaign } from '@/lib/meta';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: campaign } = await supabase
    .from('meta_campaigns')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  if (campaign.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft campaigns can be confirmed' },
      { status: 400 }
    );
  }

  const { data: adAccount } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!adAccount?.access_token_encrypted) {
    return NextResponse.json({ error: 'Meta account not connected' }, { status: 400 });
  }

  try {
    const token = retrieveToken(adAccount.access_token_encrypted);
    await activateCampaign(token, campaign.meta_campaign_id!);

    const { data: updated } = await supabase
      .from('meta_campaigns')
      .update({ status: 'active' })
      .eq('id', params.id)
      .select()
      .single();

    return NextResponse.json({
      campaign: updated,
      message: 'Campaign is now live!',
    });
  } catch (err) {
    console.error('[Campaign Confirm]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Activation failed' },
      { status: 500 }
    );
  }
}
