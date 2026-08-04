import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AdFormat, AdMediaPayload } from '@/types/database';
import { META_AD_FORMATS } from '@/lib/creatives';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const update: Record<string, unknown> = {};

  if (body.status) update.status = body.status;
  if (typeof body.copy_text === 'string') update.copy_text = body.copy_text.slice(0, 2200);
  if (typeof body.headline === 'string') update.headline = body.headline.slice(0, 255);
  if (typeof body.image_url === 'string') update.image_url = body.image_url;
  if (typeof body.angle === 'string') update.angle = body.angle.slice(0, 120);
  if (body.ad_format && ['single_image', 'carousel', 'stories', 'video'].includes(body.ad_format)) {
    update.ad_format = body.ad_format as AdFormat;
  }
  if (body.media_payload && typeof body.media_payload === 'object') {
    update.media_payload = body.media_payload as AdMediaPayload;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('generated_ads')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase.from('generated_ads').delete().eq('id', params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
