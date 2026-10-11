import { NextResponse } from 'next/server';
import { readdir, readFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import sharp from 'sharp';
import { ffmpegDownloadIssue, resolveFfmpegPath, spawnProcess } from '@/lib/motion-video/ffmpeg';

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

/** Threads across every process visible to this account (CageFS only shows our own). */
async function accountThreads(): Promise<number | null> {
  try {
    const pids = (await readdir('/proc')).filter((entry) => /^\d+$/.test(entry));
    let total = 0;
    for (const pid of pids) {
      const threads = await readProcField(`/proc/${pid}/status`, /^Threads:\s*(\d+)/m);
      if (threads) total += Number(threads);
    }
    return total;
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
  return NextResponse.json({
    ffmpeg: Boolean(ffmpeg),
    ffmpeg_issue: ffmpeg ? null : ffmpegDownloadIssue(),
    cpus: cpus().length,
    sharp_concurrency: sharp.concurrency(),
    process_threads: Number(await readProcField('/proc/self/status', /^Threads:\s*(\d+)/m)) || null,
    account_threads: await accountThreads(),
    max_processes: await readProcField('/proc/self/limits', /^Max processes\s+(\S+)/m),
    render_probe: probe && ffmpeg ? await probeRender(ffmpeg) : undefined,
  });
}
