#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.adforge.ad-library-worker"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/AdForge"
DEPLOY="$HOME/Library/Application Support/AdForge/ad-library-worker"
NODE_BIN="$(command -v node)"
QUIET="${1:-}"

mkdir -p \
  "$HOME/Library/LaunchAgents" \
  "$LOG_DIR" \
  "$DEPLOY/scripts" \
  "$DEPLOY/node_modules" \
  "$DEPLOY/.cache"

# LaunchAgents cannot read ~/Documents on recent macOS versions. Deploy the
# small worker runtime to Application Support so it is independent of Cursor,
# Terminal, and the location of the source checkout.
cp "$ROOT/scripts/ad-library-worker.mjs" "$DEPLOY/scripts/"
cp "$ROOT/scripts/playwright-browser.mjs" "$DEPLOY/scripts/"
cp "$ROOT/scripts/fetch-ad-library-web.cjs" "$DEPLOY/scripts/"
cp "$ROOT/scripts/run-ad-library-worker.sh" "$DEPLOY/scripts/"
ditto "$ROOT/node_modules/playwright" "$DEPLOY/node_modules/playwright"
ditto "$ROOT/node_modules/playwright-core" "$DEPLOY/node_modules/playwright-core"

if [[ ! -d "$DEPLOY/.cache/playwright/chromium-1234" ]]; then
  ditto "$ROOT/.cache/playwright" "$DEPLOY/.cache/playwright"
fi

(
  cd "$DEPLOY"
  PLAYWRIGHT_BROWSERS_PATH="$DEPLOY/.cache/playwright" \
    /usr/bin/env node -e \
    "require('fs').writeFileSync('scripts/chromium-path.txt', require('playwright').chromium.executablePath())"
)
chmod +x "$DEPLOY/scripts/run-ad-library-worker.sh"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$DEPLOY/scripts/ad-library-worker.mjs</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>$HOME</string>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    <key>PLAYWRIGHT_BROWSERS_PATH</key>
    <string>$DEPLOY/.cache/playwright</string>
  </dict>
  <key>WorkingDirectory</key>
  <string>$DEPLOY</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/ad-library-worker.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/ad-library-worker.error.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$UID/$LABEL" >/dev/null 2>&1 || true
: > "$LOG_DIR/ad-library-worker.log"
: > "$LOG_DIR/ad-library-worker.error.log"
if ! launchctl bootstrap "gui/$UID" "$PLIST"; then
  # launchd can briefly retain a just-booted-out label and return I/O error.
  sleep 2
  launchctl bootstrap "gui/$UID" "$PLIST"
fi
launchctl kickstart -k "gui/$UID/$LABEL"

if [[ "$QUIET" != "--quiet" ]]; then
  echo "AdForge Ad Library worker installed and started."
  echo "Logs: $LOG_DIR/ad-library-worker.log"
fi
