import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { Browser, ChromiumBrowser } from 'playwright';

/** System Chrome avoids "Chrome for Testing" SIGABRT when spawned from IDE sandboxes on macOS. */
const MAC_SYSTEM_CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

export function resolveChromiumExecutable(root?: string): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE.trim();
    if (fromEnv && existsSync(fromEnv)) return fromEnv;
  }

  // Bundled Playwright Chromium is most reliable when spawned from worker / IDE subprocesses.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const playwright = require('playwright') as typeof import('playwright');
    const bundled = playwright.chromium.executablePath();
    if (bundled && existsSync(bundled)) return bundled;
  } catch {
    /* playwright not installed */
  }

  if (root) {
    const cached = path.join(root, 'scripts', 'chromium-path.txt');
    if (existsSync(cached)) {
      const fromFile = readFileSync(cached, 'utf8').trim();
      if (fromFile && existsSync(fromFile)) return fromFile;
    }
  }

  if (process.platform === 'darwin') {
    for (const candidate of MAC_SYSTEM_CHROME) {
      if (existsSync(candidate)) return candidate;
    }
  }

  return undefined;
}

export function chromiumLaunchOptions(executablePath: string) {
  return {
    headless: true as const,
    executablePath,
    args: [
      '--headless=new',
      '--disable-blink-features=AutomationControlled',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
    ],
  };
}

export async function launchChromium(
  playwright: typeof import('playwright')
): Promise<ChromiumBrowser | Browser> {
  const executablePath = resolveChromiumExecutable(process.cwd());
  if (!executablePath) {
    throw new Error(
      "Chromium executable not found. On macOS install Google Chrome, or run: npx playwright install chromium"
    );
  }
  return playwright.chromium.launch(chromiumLaunchOptions(executablePath));
}

export function isBrowserLaunchError(message: string): boolean {
  return /Executable doesn't exist|browserType\.launch|Target page, context or browser has been closed|Browser logs|ENOENT|spawn|SIGABRT|crash/i.test(
    message
  );
}
