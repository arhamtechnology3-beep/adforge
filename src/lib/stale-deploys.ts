import { readdir, readFile, readlink } from 'node:fs/promises';

const VERSION_PATTERN = /\/hbuilds\/versions\/([0-9a-f-]{8,})\//i;

export interface DeployProcess {
  pid: number;
  version: string | null;
  ageSeconds: number | null;
  stale: boolean;
}

async function processVersion(pid: number): Promise<string | null> {
  const sources = await Promise.all([
    readlink(`/proc/${pid}/cwd`).catch(() => ''),
    readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => ''),
  ]);
  for (const source of sources) {
    const match = `${source.replace(/\0/g, ' ')}/`.match(VERSION_PATTERN);
    if (match) return match[1]!;
  }
  return null;
}

/**
 * Hostinger leaves Node servers from earlier deploys running; each holds ~11 threads against the
 * account's thread cap, which starves ffmpeg. A process is stale only when its deploy folder is
 * known, is older than ours, and it started before us.
 */
export async function listDeployProcesses(): Promise<DeployProcess[]> {
  const current = await processVersion(process.pid);
  if (!current) return [];
  const uptime = Number((await readFile('/proc/uptime', 'utf8')).split(' ')[0]);
  const ageOf = async (pid: number) => {
    const stat = await readFile(`/proc/${pid}/stat`, 'utf8').catch(() => '');
    const startTicks = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]);
    return Number.isFinite(startTicks) ? Math.round(uptime - startTicks / 100) : null;
  };
  const ownAge = await ageOf(process.pid);
  const rows: DeployProcess[] = [];
  for (const entry of await readdir('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    const version = await processVersion(pid);
    if (!version) continue;
    const ageSeconds = await ageOf(pid);
    rows.push({
      pid,
      version,
      ageSeconds,
      // Version folders are UUIDv7 (time-ordered), so an older deploy never stops a newer one.
      stale:
        pid !== process.pid &&
        version.toLowerCase() < current.toLowerCase() &&
        ageSeconds !== null &&
        ownAge !== null &&
        ageSeconds > ownAge,
    });
  }
  return rows;
}

export async function reapStaleDeploys(): Promise<number[]> {
  if (process.platform !== 'linux' || process.env.REAP_STALE_DEPLOYS === '0') return [];
  const stale = (await listDeployProcesses().catch(() => [])).filter((row) => row.stale);
  const killed: number[] = [];
  for (const row of stale) {
    try {
      process.kill(row.pid, 'SIGTERM');
      killed.push(row.pid);
    } catch {
      // Already gone or not ours.
    }
  }
  if (killed.length) {
    console.info('[stale-deploys] stopped servers from earlier deploys', killed.join(','));
  }
  return killed;
}
