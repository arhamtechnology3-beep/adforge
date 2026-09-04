#!/usr/bin/env node
/**
 * Resolve CLOUDFLARE_ACCOUNT_ID from CLOUDFLARE_API_TOKEN when missing.
 * Writes to .env.local without printing secrets.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envLocal = path.join(root, '.env.local');

function readEnvFile() {
  if (!existsSync(envLocal)) return { text: '', values: new Map() };
  const text = readFileSync(envLocal, 'utf8');
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return { text, values };
}

function upsertEnvValue(name, value) {
  const { text, values } = readEnvFile();
  values.set(name, value);
  const lines = text.split(/\r?\n/);
  let found = false;
  const out = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const idx = trimmed.indexOf('=');
    if (idx < 1) return line;
    const key = trimmed.slice(0, idx).trim();
    if (key !== name) return line;
    found = true;
    return `${name}=${value}`;
  });
  if (!found) out.push(`${name}=${value}`);
  writeFileSync(envLocal, out.join('\n').replace(/\n?$/, '\n'), 'utf8');
}

const token = readEnvFile().values.get('CLOUDFLARE_API_TOKEN') || '';
const existing = readEnvFile().values.get('CLOUDFLARE_ACCOUNT_ID') || '';

if (!token) {
  console.log('No CLOUDFLARE_API_TOKEN — skip account lookup.');
  process.exit(0);
}

if (existing) {
  console.log('CLOUDFLARE_ACCOUNT_ID already set.');
  process.exit(0);
}

const response = await fetch('https://api.cloudflare.com/client/v4/accounts?per_page=1', {
  headers: { Authorization: `Bearer ${token}` },
});

if (!response.ok) {
  console.error(`Cloudflare accounts lookup failed: HTTP ${response.status}`);
  process.exit(1);
}

const json = await response.json();
const accountId = json?.result?.[0]?.id;
if (!accountId) {
  console.error('Cloudflare returned no accounts for this token.');
  process.exit(1);
}

upsertEnvValue('CLOUDFLARE_ACCOUNT_ID', accountId);
console.log('Resolved and saved CLOUDFLARE_ACCOUNT_ID.');
