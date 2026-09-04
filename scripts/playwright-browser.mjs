import { createRequire } from 'module';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);

const MAC_SYSTEM_CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

export function resolveChromiumExecutable(rootDir) {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE.trim();
    if (fromEnv && existsSync(fromEnv)) return fromEnv;
  }

  try {
    const playwright = require('playwright');
    const bundled = playwright.chromium.executablePath();
    if (bundled && existsSync(bundled)) return bundled;
  } catch {
    /* playwright missing */
  }

  if (rootDir) {
    const cached = path.join(rootDir, 'scripts', 'chromium-path.txt');
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

  return null;
}

export function chromiumLaunchOptions(executablePath) {
  return {
    headless: true,
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
