#!/usr/bin/env bash
# Nightwatch - one-time setup. Run after cloning (especially on EC2).
#
#     git clone <repo> && cd nightwatch-web
#     ./setup.sh          # installs deps + enables port-80 binding + smoke test
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

# 2. Dependencies
echo "==> Installing dependencies..."
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

# 3. Let a normal user bind port 80 (cap_net_bind_service on the node binary)
echo "==> Allowing node to bind port 80 (may prompt for sudo)..."
allow_port80() {
  local nodebin
  nodebin="$(readlink -f "$(command -v node)" 2>/dev/null || command -v node)"
  if command -v getcap >/dev/null 2>&1 && getcap "$nodebin" 2>/dev/null | grep -q cap_net_bind_service; then
    echo "    node can already bind low ports - OK"; return 0
  fi
  if ! command -v setcap >/dev/null 2>&1; then
    if   command -v apt-get >/dev/null 2>&1; then sudo apt-get update -y && sudo apt-get install -y libcap2-bin
    elif command -v dnf     >/dev/null 2>&1; then sudo dnf install -y libcap
    elif command -v yum     >/dev/null 2>&1; then sudo yum install -y libcap
    elif command -v apk     >/dev/null 2>&1; then sudo apk add --no-cache libcap
    else echo "    (no known package manager found to install setcap)"; fi
  fi
  if command -v setcap >/dev/null 2>&1; then
    if sudo setcap 'cap_net_bind_service=+ep' "$nodebin"; then
      echo "    setcap OK on $nodebin"; return 0
    fi
  fi
  echo "    WARNING: port-80 binding not confirmed. If ./start.sh fails with EACCES, run:"
  echo "      sudo setcap 'cap_net_bind_service=+ep' $(command -v node)"
  return 1
}
allow_port80 || true

# 4. Smoke test: boot on :80, check /api/health, then stop
echo "==> Smoke test (boot :80, hit /api/health, stop)..."
PORT=80 HOST=127.0.0.1 node server.js >/tmp/nightwatch-setup-out.log 2>/tmp/nightwatch-setup-err.log &
NW=$!
sleep 1
if curl -fsS http://127.0.0.1:80/api/health >/dev/null 2>&1; then
  echo "    server answered on port 80 - OK"
else
  echo "    (no healthy response on :80 yet - if that is an EACCES, the port-80 step above did not take.)"
  echo "    see: tail -n 20 /tmp/nightwatch-setup-err.log"
fi
kill "$NW" 2>/dev/null; wait "$NW" 2>/dev/null || true

echo
echo "==> Setup complete."
echo "    Start   : ./start.sh"
echo "    Stop    : ./stop.sh"
echo "    Status  : ./status.sh"
echo "    Live URL: http://nightwatchaviation.com/"
echo "    Prereq  : DNS A record -> this instance's public IP, and the security group opens TCP 80."