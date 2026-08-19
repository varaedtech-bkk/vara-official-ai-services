#!/usr/bin/env bash
# Start or reload the VARA assistant under PM2.
#
#   cd /root/vara-official-ai-services
#   bash deploy/pm2.sh
set -euo pipefail

APP_NAME="vara-assistant"
APP_DIR="${APP_DIR:-/root/vara-official-ai-services}"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 is not installed. On the VPS run: npm install -g pm2" >&2
  exit 1
fi

if [[ ! -f "$APP_DIR/package.json" ]]; then
  echo "Repo not found at $APP_DIR" >&2
  exit 1
fi

if [[ ! -x "$APP_DIR/node_modules/next/dist/bin/next" && ! -f "$APP_DIR/node_modules/next/dist/bin/next" ]]; then
  echo "Next.js is not installed. In $APP_DIR run: npm ci && npm run build" >&2
  exit 1
fi

if [[ ! -d "$APP_DIR/.next" ]]; then
  echo "No production build. In $APP_DIR run: npm run build" >&2
  exit 1
fi

export APP_DIR
cd "$APP_DIR"

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  echo "Reloading $APP_NAME…"
  pm2 reload ecosystem.config.js --update-env
else
  echo "Starting $APP_NAME on 0.0.0.0:8080…"
  pm2 start ecosystem.config.js
fi

pm2 save

echo
pm2 status "$APP_NAME"
echo
echo "Health check:"
curl -sS -o /dev/null -w "  GET /api/config → %{http_code}\n" "http://127.0.0.1:8080/api/config" || true
echo
echo "Logs: pm2 logs $APP_NAME --lines 30"
echo "After first install, run: pm2 startup   # then run the command it prints"
