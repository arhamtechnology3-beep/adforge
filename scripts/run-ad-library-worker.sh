#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$ROOT/.cache/playwright}"

if [[ -f "$ROOT/scripts/chromium-path.txt" ]]; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE="$(tr -d '\n' < "$ROOT/scripts/chromium-path.txt")"
fi

exec /usr/bin/env node "$ROOT/scripts/ad-library-worker.mjs"
