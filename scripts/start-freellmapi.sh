#!/usr/bin/env bash
# Start FreeLLMAPI if installed and not already listening on FREELLM_PORT.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FREELLM_DIR="${FREELLMAPI_DIR:-$HOME/freellmapi}"
PORT="${FREELLM_PORT:-3001}"
LOG="${FREELLM_LOG:-/tmp/freellmapi.log}"

if curl -sf "http://127.0.0.1:${PORT}/api/ping" >/dev/null 2>&1; then
  echo "[freellmapi] already running on http://localhost:${PORT}"
  exit 0
fi

if [[ ! -f "$FREELLM_DIR/server/dist/index.js" ]]; then
  echo "[freellmapi] not installed — run: npm run install:freellmapi"
  exit 0
fi

if [[ ! -f "$FREELLM_DIR/.env" ]]; then
  node "$ROOT/scripts/configure-freellmapi-env.mjs"
fi

echo "[freellmapi] starting on http://localhost:${PORT}"
(cd "$FREELLM_DIR" && nohup node server/dist/index.js >>"$LOG" 2>&1 &)

for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PORT}/api/ping" >/dev/null 2>&1; then
    node "$ROOT/scripts/register-freellm-media.mjs" >/dev/null 2>&1 || true
    echo "[freellmapi] ready on http://localhost:${PORT}"
    exit 0
  fi
  sleep 1
done

echo "[freellmapi] WARNING: did not become ready within 30s (see $LOG)" >&2
exit 1
