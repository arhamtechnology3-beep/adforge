import { NextResponse } from 'next/server';
import { readdir, readFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import sharp from 'sharp';
import { ffmpegDownloadIssue, resolveFfmpegPath, spawnProcess } from '@/lib/motion-video/ffmpeg';
import { listDeployProcesses } from '@/lib/stale-deploys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function readProcField(file: string, pattern: RegExp): Promise<string | null> {
  try {
    return (await readFile(file, 'utf8')).match(pattern)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Processes visible to this account (CageFS only shows our own): name, threads, age — no args/paths. */
async function accountProcesses(): Promise<Array<{
  pid: number;
  name: string;
  threads: number;
  age_s: number | null;
  current: boolean;
}> | null> {
  try {
    const uptime = Number((await readFile('/proc/uptime', 'utf8')).split(' ')[0]);
    const ticks = 100;
    const pids = (await readdir('/proc')).filter((entry) => /^\d+$/.test(entry));
    const rows = [];
    for (const pid of pids) {
      const status = await readFile(`/proc/${pid}/status`, 'utf8').catch(() => null);
      if (!status) continue;
      const stat = await readFile(`/proc/${pid}/stat`, 'utf8').catch(() => '');
      const startTicks = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]);
      rows.push({
        pid: Number(pid),
        name: status.match(/^Name:\s*(.+)$/m)?.[1]?.trim() ?? '?',
        threads: Number(status.match(/^Threads:\s*(\d+)/m)?.[1] ?? 0),
        age_s: Number.isFinite(startTicks) ? Math.round(uptime - startTicks / ticks) : null,
        current: Number(pid) === process.pid,
      });
    }
    return rows.sort((a, b) => b.threads - a.threads);
  } catch {
    return null;
  }
}

/** Six lavfi inputs → one 1s H.264 clip: same thread shape as a motion render, no files needed. */
async function probeRender(ffmpeg: string): Promise<string> {
  const inputs = Array.from({ length: 6 }, (_, index) => [
    '-threads',
    '1',
    '-f',
    'lavfi',
    '-i',
    `color=c=0x${(index * 2 + 3).toString(16).repeat(6)}:s=270x480:d=1:r=30`,
  ]).flat();
  const graph = `${Array.from({ length: 6 }, (_, index) => `[${index}:v]`).join('')}concat=n=6:v=1:a=0[v]`;
  try {
    await spawnProcess(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-filter_threads',
        '1',
        '-filter_complex_threads',
        '1',
        ...inputs,
        '-filter_complex',
        graph,
        '-map',
        '[v]',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-threads',
        '1',
        '-f',
        'null',
        '-',
      ],
      { timeoutMs: 60_000 }
    );
    return 'ok';
  } catch (error) {
    return (error instanceof Error ? error.message : String(error)).slice(-300);
  }
}

/** Public readiness probe for the creative renderers (no paths or secrets in the response). */
export async function GET(request: Request) {
  const ffmpeg = await resolveFfmpegPath();
  const probe = new URL(request.url).searchParams.get('probe') === '1';
  const processes = await accountProcesses();
  return NextResponse.json({
    ffmpeg: Boolean(ffmpeg),
    ffmpeg_issue: ffmpeg ? null : ffmpegDownloadIssue(),
    cpus: cpus().length,
    sharp_concurrency: sharp.concurrency(),
    process_threads: Number(await readProcField('/proc/self/status', /^Threads:\s*(\d+)/m)) || null,
    account_threads: processes ? processes.reduce((sum, row) => sum + row.threads, 0) : null,
    max_processes: await readProcField('/proc/self/limits', /^Max processes\s+(\S+)/m),
    render_probe: probe && ffmpeg ? await probeRender(ffmpeg) : undefined,
    processes,
    deploys: (await listDeployProcesses().catch(() => [])).map((row) => ({
      ...row,
      version: row.version?.slice(0, 8) ?? null,
    })),
  });
}
