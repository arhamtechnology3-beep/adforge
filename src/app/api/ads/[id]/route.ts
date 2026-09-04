import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AdFormat, AdMediaPayload } from '@/types/database';
import { getSessionUser } from '@/lib/auth/session';
import { readDemoAds, persistDemoAds } from '@/lib/auth/demo-ads';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
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

  if (sessionUser.isDemo) {
    const ads = await readDemoAds();
    const idx = ads.findIndex((a) => a.id === params.id);
    if (idx < 0) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }
    if (body.status === 'approved' && ads[idx].media_payload?.quality_valid === false) {
      return NextResponse.json(
        {
          error: 'Fix the flagged product, copy, or media issues before approving this creative.',
          flags: ads[idx].media_payload.quality_flags || [],
        },
        { status: 422 }
      );
    }
    const updated = {
      ...ads[idx],
      ...update,
      media_payload: update.media_payload
        ? { ...ads[idx].media_payload, ...(update.media_payload as AdMediaPayload) }
        : ads[idx].media_payload,
    };
    ads[idx] = updated;
    const response = NextResponse.json(updated);
    return persistDemoAds(response, ads);
  }

  const supabase = await createClient();
  if (update.media_payload || body.status === 'approved') {
    const { data: existing } = await supabase
      .from('generated_ads')
      .select('media_payload')
      .eq('id', params.id)
      .single();
    if (
      body.status === 'approved' &&
      (existing?.media_payload as AdMediaPayload | null)?.quality_valid === false
    ) {
      return NextResponse.json(
        {
          error: 'Fix the flagged product, copy, or media issues before approving this creative.',
          flags:
            (existing?.media_payload as AdMediaPayload | null)?.quality_flags || [],
        },
        { status: 422 }
      );
    }
    if (!update.media_payload) {
      // Approval check only; do not rewrite the payload.
    } else {
    update.media_payload = {
      ...((existing?.media_payload as AdMediaPayload | null) || {}),
      ...(update.media_payload as AdMediaPayload),
    };
    }
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
  _request: Request,
  { params }: { params: { id: string } }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (sessionUser.isDemo) {
    const ads = await readDemoAds();
    const next = ads.filter((a) => a.id !== params.id);
    if (next.length === ads.length) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }
    const response = NextResponse.json({ success: true });
    return persistDemoAds(response, next);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('generated_ads').delete().eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
