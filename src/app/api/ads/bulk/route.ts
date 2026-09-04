import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { readDemoAds, persistDemoAds } from '@/lib/auth/demo-ads';
import { createClient } from '@/lib/supabase/server';
import type { AdStatus } from '@/types/database';

const ALLOWED = new Set<AdStatus>(['pending', 'approved', 'rejected']);

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids)
    ? body.ids.map(String).filter(Boolean).slice(0, 100)
    : [];
  const status = String(body.status || '') as AdStatus;
  if (!ids.length || !ALLOWED.has(status)) {
    return NextResponse.json({ error: 'Valid ids and status required' }, { status: 400 });
  }

  if (user.isDemo) {
    const ads = await readDemoAds();
    const selected = new Set(ids);
    const eligible = new Set(
      ads
        .filter(
          (ad) =>
            selected.has(ad.id) &&
            (status !== 'approved' || ad.media_payload?.quality_valid !== false)
        )
        .map((ad) => ad.id)
    );
    const updated = ads.map((ad) => (eligible.has(ad.id) ? { ...ad, status } : ad));
    return persistDemoAds(
      NextResponse.json({
        updated: updated.filter((ad) => eligible.has(ad.id)),
        skipped: ids.filter((id) => !eligible.has(id)),
      }),
      updated
    );
  }

  const supabase = await createClient();
  let eligibleIds = ids;
  if (status === 'approved') {
    const { data: rows, error: readError } = await supabase
      .from('generated_ads')
      .select('id, media_payload')
      .in('id', ids);
    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }
    eligibleIds = (rows || [])
      .filter((row) => row.media_payload?.quality_valid !== false)
      .map((row) => row.id);
  }
  if (!eligibleIds.length) {
    return NextResponse.json({ updated: [], skipped: ids });
  }
  const { data, error } = await supabase
    .from('generated_ads')
    .update({ status })
    .in('id', eligibleIds)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    updated: data || [],
    skipped: ids.filter((id) => !eligibleIds.includes(id)),
  });
}
