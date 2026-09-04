/**
 * Local Ad Library worker — Playwright cannot run inside Next.js API routes.
 * Start with: npm run ad-library-worker (auto-started alongside npm run dev)
 */
import { createRequire } from 'module';
import http from 'http';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { resolveChromiumExecutable } from './playwright-browser.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const script = path.join(root, 'scripts', 'fetch-ad-library-web.cjs');
const PORT = Number(process.env.AD_LIBRARY_WORKER_PORT || 3021);
const cacheDir = path.join(root, '.cache', 'ad-library');

function cacheKey(input) {
  return String(input.pageId || input.searchTerms || 'default').replace(/[^a-z0-9_-]/gi, '_');
}

function writeLiveCache(input, result) {
  if (!Array.isArray(result.ads) || result.ads.length === 0) return;
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(
    path.join(cacheDir, `${cacheKey(input)}.json`),
    JSON.stringify({ savedAt: new Date().toISOString(), result })
  );
}

const projectBrowsers = path.join(root, '.cache', 'playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(projectBrowsers)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = projectBrowsers;
}
const chromPathFile = path.join(root, 'scripts', 'chromium-path.txt');
if (!process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE && existsSync(chromPathFile)) {
  const fromFile = require('fs').readFileSync(chromPathFile, 'utf8').trim();
  if (fromFile && existsSync(fromFile)) {
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE = fromFile;
  }
}

async function fetchAds(inputJson) {
  const chromium = resolveChromiumExecutable(root);
  if (!chromium) {
    throw new Error(
      'Chromium not found. Run: npx playwright install chromium && npm run build:ad-library'
    );
  }
  if (!existsSync(script)) {
    throw new Error('Missing scripts/fetch-ad-library-web.cjs — run: npm run build:ad-library');
  }

  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE = chromium;
  const input = JSON.parse(inputJson || '{}');
  const { runAdLibraryWebFetchInProcess } = require('./fetch-ad-library-web.cjs');
  const result = await runAdLibraryWebFetchInProcess(input);
  writeLiveCache(input, result);
  return JSON.stringify(result);
}

function privateAddress(address) {
  if (address === '::1' || /^f[cd]|^fe80:/i.test(address)) return true;
  const parts = address.split('.').map(Number);
  return (
    parts.length === 4 &&
    (parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168))
  );
}

async function fetchProductPage(inputJson) {
  const input = JSON.parse(inputJson || '{}');
  const url = new URL(String(input.url || ''));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Invalid public product URL');
  }
  if (
    url.hostname === 'localhost' ||
    url.hostname.endsWith('.local') ||
    (isIP(url.hostname) && privateAddress(url.hostname))
  ) {
    throw new Error('Private or local product URLs are not allowed');
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) {
    throw new Error('Product URL must resolve to a public website');
  }
  const chromiumPath = resolveChromiumExecutable(root);
  if (!chromiumPath) throw new Error('Chromium not found');
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    });
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
    const finalUrl = page.url();
    const finalHost = new URL(finalUrl).hostname;
    const finalAddresses = await lookup(finalHost, { all: true });
    if (finalAddresses.some((entry) => privateAddress(entry.address))) {
      throw new Error('Product page redirected to a private website');
    }
    const html = await page.content();
    if (html.length > 4_000_000) throw new Error('Product page is too large to import');
    return JSON.stringify({ html, url: finalUrl });
  } finally {
    await browser.close();
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    const chromium = resolveChromiumExecutable(root);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, chromium: Boolean(chromium), browser: chromium }));
    return;
  }

  if (req.method !== 'POST' || !['/fetch', '/product-page'].includes(req.url || '')) {
    res.writeHead(404);
    res.end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', async () => {
    try {
      const result = req.url === '/product-page' ? await fetchProductPage(body) : await fetchAds(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(result);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const chromium = resolveChromiumExecutable(root);
  console.log(`[ad-library-worker] listening on http://127.0.0.1:${PORT}`);
  console.log(`[ad-library-worker] browser: ${chromium || 'MISSING — run npx playwright install chromium'}`);
});
