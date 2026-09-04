#!/usr/bin/env node
/**
 * Register OpenRouter (+ optional Pollinations) as FreeLLMAPI custom media providers.
 * Reads keys from AdForge .env.local. Requires FreeLLMAPI running on :3001.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envLocal = path.join(root, '.env.local');
const base = process.env.FREELLM_API_BASE_URL?.replace(/\/v1$/, '') || 'http://127.0.0.1:3001';

function readEnvValue(name) {
  if (!existsSync(envLocal)) return '';
  const text = readFileSync(envLocal, 'utf8');
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

async function login() {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.FREELLM_ADMIN_EMAIL || 'adforge@local.dev',
      password: process.env.FREELLM_ADMIN_PASSWORD || 'adforge-local-dev',
    }),
  });
  if (!response.ok) throw new Error(`Login failed: HTTP ${response.status}`);
  const json = await response.json();
  if (!json.token) throw new Error('Login response missing token');
  return json.token;
}

async function registerCustom(token, payload) {
  const response = await fetch(`${base}/api/media/custom`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Custom media register failed (${payload.modality}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

const openrouterKey = readEnvValue('OPENROUTER_API_KEY');
const openrouterModel =
  readEnvValue('OPENROUTER_IMAGE_MODEL') || 'black-forest-labs/flux.2-klein-4b';
const pollinationsKey = readEnvValue('POLLINATIONS_API_KEY');
const openaiKey = readEnvValue('OPENAI_API_KEY');

const token = await login();
const registered = [];

if (openaiKey) {
  registered.push(
    await registerCustom(token, {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-image-1',
      displayName: 'OpenAI GPT Image',
      modality: 'image',
      apiKey: openaiKey,
      quotaLabel: 'OpenAI image',
    })
  );
}

if (openrouterKey) {
  registered.push(
    await registerCustom(token, {
      baseUrl: 'https://openrouter.ai/api/v1',
      model: openrouterModel,
      displayName: 'OpenRouter FLUX Image',
      modality: 'image',
      apiKey: openrouterKey,
      quotaLabel: 'OpenRouter image',
    })
  );
}

if (pollinationsKey) {
  registered.push(
    await registerCustom(token, {
      baseUrl: 'https://gen.pollinations.ai/v1',
      model: 'flux',
      displayName: 'Pollinations Flux',
      modality: 'image',
      apiKey: pollinationsKey,
      quotaLabel: 'Pollinations image',
    })
  );
}

console.log(
  `Registered ${registered.length} custom media provider(s): ${registered.map((r) => r.displayName).join(', ') || 'none'}`
);
