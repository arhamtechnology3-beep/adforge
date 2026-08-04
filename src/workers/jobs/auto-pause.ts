import { runOpsMonitorSlot } from './ops-monitor';

/** CPA auto-pause is handled inside afternoon/morning ops monitor rules */
export async function checkAndAutoPause() {
  return runOpsMonitorSlot('afternoon');
}
