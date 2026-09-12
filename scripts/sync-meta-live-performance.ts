/**
 * Align AdForge campaign status with Meta and upsert today's insights.
 *
 * Usage: npx tsx scripts/sync-meta-live-performance.ts [userId?]
 */
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import { syncMetaPerformanceForUser } from '../src/lib/sync-meta-performance';

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const userFilter = process.argv[2];
  let userIds: string[] = [];

  if (userFilter) {
    userIds = [userFilter];
  } else {
    const { data: accounts, error } = await sb
      .from('ad_accounts')
      .select('user_id')
      .not('access_token_encrypted', 'is', null)
      .order('connected_at', { ascending: false });
    if (error) throw new Error(error.message);
    userIds = Array.from(new Set((accounts || []).map((a) => a.user_id)));
  }

  if (!userIds.length) throw new Error('No Meta-connected users');

  for (const userId of userIds) {
    console.log(`[sync] user=${userId}`);
    const result = await syncMetaPerformanceForUser(sb, { userId });
    for (const c of result.campaigns) {
      if (c.error) {
        console.log(`  ERR ${c.name}: ${c.error}`);
      } else {
        console.log(
          `  ${c.name}` +
            (c.statusSynced ? ` · status→${c.status}` : '') +
            (c.snapshot
              ? ` · snapshot spend=₹${c.spend} imps=${c.impressions} clicks=${c.clicks}`
              : ' · no insights today')
        );
      }
    }
    console.log(
      `  done · statusSynced=${result.statusSynced} · snapshotsWritten=${result.snapshotsWritten}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
