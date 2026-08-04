import { createClient } from '@supabase/supabase-js';
import { runOpsMonitorSlot } from './ops-monitor';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * When META_POLICY_PACK_VERSION bumps, re-scan all users and email notice.
 * Called from morning slot or manually.
 */
export async function runPolicyGuardScan() {
  const result = await runOpsMonitorSlot('morning');
  const supabase = getServiceClient();

  await supabase.from('agent_runs').insert({
    user_id: null,
    slot: 'morning',
    status: 'completed',
    summary: {
      type: 'policy_guard',
      ...result,
      pack: process.env.META_POLICY_PACK_VERSION || 'v1',
    },
  });

  return result;
}
