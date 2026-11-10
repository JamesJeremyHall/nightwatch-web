#!/usr/bin/env bash
# Nightwatch — one-time setup. Run after cloning.
#
#     git clone <repo> && cd nightwatch-web
#     ./setup.sh
#
set -uo pipefail
cd "$(dirname "$0")"

echo "==> Nightwatch setup"

# 1. Node.js (needs >= 22.5 for the built-in node:sqlite)
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: 'node' not found on PATH. Install Node.js >= 22.5 (https://nodejs.org), then re-run ./setup.sh" >&2
  exit 1
fi
echo "    node $(node -v)  /  npm $(npm -v 2>/dev/null || echo '?')"

# 2. Dependencies (just express — the SQLite driver is built into Node)
echo "==> Installing dependencies..."
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

# 3. Smoke test: boot on :3000, check /api/health, then stop
echo "==> Smoke test (boot :3000, hit /api/health, stop)..."
PORT=3000 HOST=127.0.0.1 node server.js >/tmp/nightwatch-setup-out.log 2>/tmp/nightwatch-setup-err.log &
NW=$!
sleep 1
if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  echo "    server answered on port 3000 — OK"
else
  echo "    (no healthy response on :3000 — see: tail -n 20 /tmp/nightwatch-setup-err.log)" >&2
fi
kill "$NW" 2>/dev/null; wait "$NW" 2>/dev/null || true

echo
echo "==> Setup complete."
echo "    Start  : ./start.sh   (or: npm start)"
echo "    Stop   : ./stop.sh"
echo "    Status : ./status.sh"