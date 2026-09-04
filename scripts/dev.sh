#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$PWD/.cache/playwright}"
mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"

if [[ -f scripts/chromium-path.txt ]]; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE="$(tr -d '\n' < scripts/chromium-path.txt)"
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  # Run independently from Cursor/npm. Only touch Application Support when the
  # service is absent; normal dev restarts leave the healthy daemon untouched.
  if ! curl -sf http://127.0.0.1:3021/health >/dev/null 2>&1; then
    bash scripts/install-ad-library-worker.sh --quiet
  fi
fi

for _ in {1..20}; do
  curl -sf http://127.0.0.1:3021/health >/dev/null 2>&1 && break
  sleep 0.25
done

if curl -sf http://127.0.0.1:3021/health >/dev/null 2>&1; then
  echo "[dev] Ad Library worker ready on http://127.0.0.1:3021"
else
  echo "[dev] WARNING: Ad Library worker failed to start. Check ~/Library/Logs/AdForge/"
fi

bash scripts/start-freellmapi.sh || true

ulimit -n 10240 2>/dev/null || true
export WATCHPACK_POLLING="${WATCHPACK_POLLING:-true}"
exec npx next dev "$@"
