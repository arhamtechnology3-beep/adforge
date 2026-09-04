#!/usr/bin/env bash
# Install and start FreeLLMAPI from source (no Docker required).
# Reads provider keys from AdForge .env.local and writes FREELLM_API_KEY back.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FREELLM_DIR="${FREELLMAPI_DIR:-$HOME/freellmapi}"
FREELLM_REPO="${FREELLM_REPO:-https://github.com/arhamtechnology3-beep/freellmapi.git}"
PORT="${FREELLM_PORT:-3001}"
ENV_LOCAL="$ROOT/.env.local"

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN\033[0m %s\n' "$*" >&2; }

if [[ ! -f "$ENV_LOCAL" ]]; then
  echo "Missing $ENV_LOCAL — create it from .env.example first." >&2
  exit 1
fi

read_env_local() {
  local key="$1"
  node -e "
    const fs = require('fs');
    const key = process.argv[1];
    const text = fs.readFileSync(process.argv[2], 'utf8');
    for (const line of text.split(/\\r?\\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx < 1) continue;
      const name = trimmed.slice(0, idx).trim();
      if (name !== key) continue;
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith(\"'\") && value.endsWith(\"'\"))) {
        value = value.slice(1, -1);
      }
      process.stdout.write(value);
      process.exit(0);
    }
    process.exit(0);
  " "$key" "$ENV_LOCAL"
}

OPENROUTER_API_KEY="$(read_env_local OPENROUTER_API_KEY)"
CLOUDFLARE_API_TOKEN="$(read_env_local CLOUDFLARE_API_TOKEN)"
CLOUDFLARE_ACCOUNT_ID="$(read_env_local CLOUDFLARE_ACCOUNT_ID)"
OPENAI_API_KEY="$(read_env_local OPENAI_API_KEY)"
GOOGLE_API_KEY="$(read_env_local GOOGLE_API_KEY)"
GEMINI_API_KEY="$(read_env_local GEMINI_API_KEY)"
GROQ_API_KEY="$(read_env_local GROQ_API_KEY)"
POLLINATIONS_API_KEY="$(read_env_local POLLINATIONS_API_KEY)"

if [[ -n "$CLOUDFLARE_API_TOKEN" && -z "$CLOUDFLARE_ACCOUNT_ID" ]]; then
  say "Resolving Cloudflare account ID"
  node "$ROOT/scripts/resolve-cloudflare-account.mjs"
  CLOUDFLARE_ACCOUNT_ID="$(read_env_local CLOUDFLARE_ACCOUNT_ID)"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required." >&2
  exit 1
fi

if [[ ! -d "$FREELLM_DIR/.git" ]]; then
  say "Cloning FreeLLMAPI to $FREELLM_DIR"
  git clone --depth 1 "$FREELLM_REPO" "$FREELLM_DIR"
fi

say "Installing dependencies"
(cd "$FREELLM_DIR" && npm install --silent)

say "Building FreeLLMAPI"
(cd "$FREELLM_DIR" && npm run build --silent)

KEYS_JSON='[]'
append_key() {
  local platform="$1"
  local key="$2"
  local label="$3"
  if [[ -n "$key" ]]; then
    KEYS_JSON="$(node -e "
      const rows = JSON.parse(process.argv[1]);
      rows.push({ platform: process.argv[2], key: process.argv[3], label: process.argv[4], enabled: true });
      console.log(JSON.stringify(rows));
    " "$KEYS_JSON" "$platform" "$key" "$label")"
  fi
}

append_key openrouter "${OPENROUTER_API_KEY:-}" adforge-openrouter
if [[ -n "$CLOUDFLARE_API_TOKEN" && -n "$CLOUDFLARE_ACCOUNT_ID" ]]; then
  append_key cloudflare "${CLOUDFLARE_ACCOUNT_ID}:${CLOUDFLARE_API_TOKEN}" adforge-cloudflare
elif [[ -n "$CLOUDFLARE_API_TOKEN" ]]; then
  warn "CLOUDFLARE_ACCOUNT_ID missing — Cloudflare Workers AI image models will not work."
fi
append_key google "${GOOGLE_API_KEY:-${GEMINI_API_KEY:-}}" adforge-google
append_key groq "${GROQ_API_KEY:-}" adforge-groq
append_key pollinations "${POLLINATIONS_API_KEY:-}" adforge-pollinations

if [[ "$KEYS_JSON" == "[]" ]]; then
  warn "No provider keys found in .env.local — FreeLLMAPI will still run (Pollinations image/video is keyless)."
fi

ENCRYPTION_KEY="${FREELLM_ENCRYPTION_KEY:-$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")}"
CONFIG_JSON="$(node -e "
  console.log(JSON.stringify({
    keys: JSON.parse(process.argv[1]),
    routing: { strategy: 'balanced' },
  }));
" "$KEYS_JSON")"

cat > "$FREELLM_DIR/.env" <<EOF
ENCRYPTION_KEY=${ENCRYPTION_KEY}
PORT=${PORT}
NODE_ENV=production
FREEAPI_CONFIG_JSON=${CONFIG_JSON}
EOF

say "Starting FreeLLMAPI on http://localhost:${PORT}"
(cd "$FREELLM_DIR" && node server/dist/index.js) &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${PORT}/api/ping" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$i" -eq 60 ]]; then
    echo "FreeLLMAPI did not become ready within 60s." >&2
    exit 1
  fi
done

say "Bootstrapping dashboard account (if needed)"
SETUP_STATUS="$(curl -sf "http://127.0.0.1:${PORT}/api/auth/status" || echo '{}')"
NEEDS_SETUP="$(node -e "const s=JSON.parse(process.argv[1]||'{}'); console.log(s.needsSetup?'yes':'no');" "$SETUP_STATUS")"

if [[ "$NEEDS_SETUP" == "yes" ]]; then
  curl -sf -X POST "http://127.0.0.1:${PORT}/api/auth/setup" \
    -H 'Content-Type: application/json' \
    -d '{"email":"adforge@local.dev","password":"adforge-local-dev"}' >/dev/null
fi

say "Reading unified API key"
UNIFIED_KEY="$(cd "$FREELLM_DIR" && node - <<NODE
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dbPath = path.join('server', 'data', 'freeapi.db');
if (!fs.existsSync(dbPath)) {
  console.error('Could not find', dbPath);
  process.exit(1);
}
const db = new Database(dbPath, { readonly: true });
const row = db.prepare("SELECT value FROM settings WHERE key = 'unified_api_key'").get();
if (!row?.value) process.exit(1);
console.log(row.value);
NODE
)"

if [[ -z "$UNIFIED_KEY" ]]; then
  echo "Failed to read unified API key from FreeLLMAPI database." >&2
  exit 1
fi

touch "$ENV_LOCAL"
if grep -q '^FREELLM_API_KEY=' "$ENV_LOCAL"; then
  sed -i.bak "s|^FREELLM_API_KEY=.*|FREELLM_API_KEY=${UNIFIED_KEY}|" "$ENV_LOCAL"
else
  printf '\n# FreeLLMAPI — free image & video generation\nFREELLM_API_KEY=%s\nFREELLM_API_BASE_URL=http://localhost:%s/v1\nFREELLM_IMAGE_MODEL=auto\nFREELLM_VIDEO_MODEL=auto\n' "$UNIFIED_KEY" "$PORT" >> "$ENV_LOCAL"
fi

say "Wrote FREELLM_API_KEY to .env.local"

say "Registering custom image providers (OpenAI, OpenRouter, Pollinations)"
node "$ROOT/scripts/register-freellm-media.mjs" || warn "Custom media registration failed — add providers in FreeLLMAPI dashboard."

if [[ "${1:-}" == "--daemon" ]]; then
  disown "$SERVER_PID" 2>/dev/null || true
  say "FreeLLMAPI running in background (PID ${SERVER_PID}) at http://localhost:${PORT}"
  exit 0
fi

say "FreeLLMAPI running (PID ${SERVER_PID}) — press Ctrl+C to stop"
wait "$SERVER_PID"
