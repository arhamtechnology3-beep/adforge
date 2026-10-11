import { spawn } from 'node:child_process';
import { access, chmod, mkdir, rename, rm } from 'node:fs/promises';
import { constants, createWriteStream } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { createGunzip } from 'node:zlib';

const COMMON_FFMPEG_PATHS = [
  '/opt/homebrew/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/usr/bin/ffmpeg',
  '/bin/ffmpeg',
];

export interface SpawnResult {
  stdout: string;
  stderr: string;
}

export function spawnProcess(
  executable: string,
  args: readonly string[],
  options: { cwd?: string; timeoutMs?: number } = {}
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...args], {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const maxCapturedCharacters = 80_000;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout = (stdout + chunk).slice(-maxCapturedCharacters);
    });
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-maxCapturedCharacters);
    });

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Process timed out after ${options.timeoutMs ?? 120_000}ms`));
    }, options.timeoutMs ?? 120_000);

    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const detail = stderr.trim().split('\n').slice(-8).join('\n');
      reject(
        new Error(
          `Process exited with ${signal ? `signal ${signal}` : `code ${code}`}${
            detail ? `: ${detail}` : ''
          }`
        )
      );
    });
  });
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve and verify ffmpeg without invoking a shell. */
export async function resolveFfmpegPath(): Promise<string | null> {
  const configured = process.env.FFMPEG_PATH?.trim();
  let packaged: string | null = null;
  try {
    packaged = (await import('ffmpeg-static')).default as unknown as string | null;
  } catch {
    // Package missing on this host — fall through to system ffmpeg.
  }
  const candidates = [
    ...(configured ? [configured] : []),
    ...(packaged ? [packaged] : []),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    ...COMMON_FFMPEG_PATHS,
    // Let spawn perform the platform PATH lookup as the final fallback.
    'ffmpeg',
  ];

  for (const candidate of [...new Set(candidates)]) {
    if (await isWorkingFfmpeg(candidate)) return candidate;
  }
  return downloadFfmpeg();
}

async function isWorkingFfmpeg(candidate: string): Promise<boolean> {
  return (await probeFfmpeg(candidate)) === null;
}

/** null when the binary runs; otherwise the reason it does not. */
async function probeFfmpeg(candidate: string): Promise<string | null> {
  if (candidate.includes('/') && !(await isExecutable(candidate))) return 'not executable';
  try {
    await spawnProcess(candidate, ['-version'], { timeoutMs: 5_000 });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const FFMPEG_STATIC_RELEASE = 'b6.1.1';
let downloadInFlight: Promise<string | null> | null = null;
let lastDownloadIssue: string | null = null;

/** Why the runtime ffmpeg download did not produce a usable binary (for user-facing flags). */
export function ffmpegDownloadIssue(): string | null {
  return lastDownloadIssue;
}

/**
 * Hosts that install with scripts disabled (Hostinger) get `ffmpeg-static` without its binary.
 * Fetch the same static build once into a writable cache dir. Disable with FFMPEG_AUTO_DOWNLOAD=0.
 */
export function downloadFfmpeg(): Promise<string | null> {
  if (process.env.FFMPEG_AUTO_DOWNLOAD === '0') {
    lastDownloadIssue = 'auto-download disabled (FFMPEG_AUTO_DOWNLOAD=0)';
    return Promise.resolve(null);
  }
  if (
    !['linux', 'darwin'].includes(process.platform) ||
    !['x64', 'arm64'].includes(process.arch)
  ) {
    lastDownloadIssue = `no static build for ${process.platform}-${process.arch}`;
    return Promise.resolve(null);
  }
  downloadInFlight ??= (async () => {
    const dirs = [
      process.env.FFMPEG_CACHE_DIR?.trim(),
      path.join(homedir(), '.cache', 'adforge-ffmpeg'),
      path.join(tmpdir(), 'adforge-ffmpeg'),
    ].filter((dir): dir is string => Boolean(dir));
    const binaryName = `ffmpeg-${FFMPEG_STATIC_RELEASE}-${process.platform}-${process.arch}`;

    for (const dir of dirs) {
      const target = path.join(dir, binaryName);
      if (await isWorkingFfmpeg(target)) return target;
    }

    const issues: string[] = [];
    const url = `https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG_STATIC_RELEASE}/ffmpeg-${process.platform}-${process.arch}.gz`;
    for (const dir of dirs) {
      const target = path.join(dir, binaryName);
      const partial = `${target}.${process.pid}.part`;
      try {
        await mkdir(dir, { recursive: true });
        const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
        await pipeline(
          Readable.fromWeb(response.body as WebReadableStream),
          createGunzip(),
          createWriteStream(partial, { mode: 0o755 })
        );
        await chmod(partial, 0o755);
        await rename(partial, target);
        const problem = await probeFfmpeg(target);
        if (!problem) {
          console.info('[ffmpeg] downloaded static build to', target);
          lastDownloadIssue = null;
          return target;
        }
        issues.push(`${dir}: binary will not run (${problem.slice(0, 120)})`);
      } catch (error) {
        issues.push(`${dir}: ${error instanceof Error ? error.message : String(error)}`);
        await rm(partial, { force: true }).catch(() => undefined);
      }
    }
    lastDownloadIssue = issues.join('; ').slice(0, 400);
    console.warn('[ffmpeg] runtime download failed:', lastDownloadIssue);
    return null;
  })().finally(() => {
    downloadInFlight = null;
  });
  return downloadInFlight;
}
