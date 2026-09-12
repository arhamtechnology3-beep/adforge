import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncMetaPerformanceForUser } from '@/lib/sync-meta-performance';

/** POST — pull latest Meta insights into performance_snapshots (Reports Sync). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let campaignId: string | null = null;
  try {
    const body = await request.json();
    if (body?.campaignId && body.campaignId !== 'all') {
      campaignId = String(body.campaignId);
    }
  } catch {
    /* empty body ok */
  }

  try {
    const result = await syncMetaPerformanceForUser(supabase, {
      userId: user.id,
      campaignId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
