import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

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
  const candidates = [
    ...(configured ? [configured] : []),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    ...COMMON_FFMPEG_PATHS,
    // Let spawn perform the platform PATH lookup as the final fallback.
    'ffmpeg',
  ];

  for (const candidate of [...new Set(candidates)]) {
    if (candidate.includes('/') && !(await isExecutable(candidate))) continue;
    try {
      await spawnProcess(candidate, ['-version'], { timeoutMs: 5_000 });
      return candidate;
    } catch {
      // Try the next known location.
    }
  }
  return null;
}
