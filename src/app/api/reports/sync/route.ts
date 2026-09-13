import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { syncMetaPerformanceForUser } from '@/lib/sync-meta-performance';

async function runSync(userId: string, campaignId: string | null) {
  const writer = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? await createServiceClient()
    : await createClient();

  return syncMetaPerformanceForUser(writer, { userId, campaignId });
}

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
    const result = await runSync(user.id, campaignId);
    const failed = result.campaigns.filter((c) => c.error);
    if (result.snapshotsWritten === 0 && failed.length) {
      return NextResponse.json(
        { error: failed[0].error || 'Sync failed', ...result },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
