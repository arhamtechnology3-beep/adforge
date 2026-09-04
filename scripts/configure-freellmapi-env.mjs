#!/usr/bin/env node
/**
 * Configure ~/freellmapi/.env from AdForge .env.local provider keys.
 * Usage: node scripts/configure-freellmapi-env.mjs
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envLocalPath = path.join(root, '.env.local');
const freellmDir = process.env.FREELLMAPI_DIR || path.join(process.env.HOME || '', 'freellmapi');
const freellmEnvPath = path.join(freellmDir, '.env');
const port = process.env.FREELLM_PORT || '3001';

function readEnvValue(name) {
  if (!existsSync(envLocalPath)) return '';
  const text = readFileSync(envLocalPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (key !== name) continue;
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return '';
}

const keys = [];
const add = (platform, envName, label) => {
  const value = readEnvValue(envName);
  if (value) keys.push({ platform, key: value, label, enabled: true });
};

add('openrouter', 'OPENROUTER_API_KEY', 'adforge-openrouter');
const cfToken = readEnvValue('CLOUDFLARE_API_TOKEN');
const cfAccount = readEnvValue('CLOUDFLARE_ACCOUNT_ID');
if (cfToken && cfAccount) {
  keys.push({
    platform: 'cloudflare',
    key: `${cfAccount}:${cfToken}`,
    label: 'adforge-cloudflare',
    enabled: true,
  });
}
add('google', 'GOOGLE_API_KEY', 'adforge-google');
add('google', 'GEMINI_API_KEY', 'adforge-gemini');
add('groq', 'GROQ_API_KEY', 'adforge-groq');
add('pollinations', 'POLLINATIONS_API_KEY', 'adforge-pollinations');

let encryptionKey = readEnvValue('FREELLM_ENCRYPTION_KEY');
if (!encryptionKey) {
  encryptionKey = randomBytes(32).toString('hex');
}

const config = JSON.stringify({ keys, routing: { strategy: 'balanced' } });
const envBody = [
  `ENCRYPTION_KEY=${encryptionKey}`,
  `PORT=${port}`,
  'NODE_ENV=production',
  `FREEAPI_CONFIG_JSON=${config}`,
  '',
].join('\n');

writeFileSync(freellmEnvPath, envBody, 'utf8');
console.log(`Configured ${freellmEnvPath} with ${keys.length} provider key(s).`);
