#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envLocal = path.join(root, '.env.local');
const freellmDir = process.env.FREELLMAPI_DIR || path.join(process.env.HOME || '', 'freellmapi');
const dbPath = path.join(freellmDir, 'server', 'data', 'freeapi.db');
const port = process.env.FREELLM_PORT || '3001';

if (!existsSync(dbPath)) {
  console.error('FreeLLMAPI database not found:', dbPath);
  process.exit(1);
}

const require = createRequire(path.join(freellmDir, 'server', 'dist', 'index.js'));
const Database = require('better-sqlite3');
const db = new Database(dbPath, { readonly: true });
const row = db.prepare("SELECT value FROM settings WHERE key = 'unified_api_key'").get();
if (!row?.value) {
  console.error('Unified API key missing in FreeLLMAPI database');
  process.exit(1);
}

const block = [
  '',
  '# FreeLLMAPI — free image & video generation',
  `FREELLM_API_KEY=${row.value}`,
  `FREELLM_API_BASE_URL=http://localhost:${port}/v1`,
  'FREELLM_IMAGE_MODEL=auto',
  'FREELLM_VIDEO_MODEL=auto',
  '',
].join('\n');

let text = existsSync(envLocal) ? readFileSync(envLocal, 'utf8') : '';
if (/^FREELLM_API_KEY=/m.test(text)) {
  text = text.replace(/^FREELLM_API_KEY=.*$/m, `FREELLM_API_KEY=${row.value}`);
  text = text.replace(
    /^FREELLM_API_BASE_URL=.*$/m,
    `FREELLM_API_BASE_URL=http://localhost:${port}/v1`
  );
  if (!/^FREELLM_IMAGE_MODEL=/m.test(text)) text += '\nFREELLM_IMAGE_MODEL=auto';
  if (!/^FREELLM_VIDEO_MODEL=/m.test(text)) text += '\nFREELLM_VIDEO_MODEL=auto';
} else {
  text = `${text.replace(/\s*$/, '')}${block}`;
}

writeFileSync(envLocal, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
console.log('Updated .env.local with FREELLM_API_KEY');
