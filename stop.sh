#!/usr/bin/env bash
# Nightwatch - stop the server (graceful SIGTERM, then SIGKILL fallback).
set -uo pipefail
cd "$(dirname "$0")"

PIDFILE="./nightwatch-web.pid"
PID=""
[ -f "$PIDFILE" ] && PID="$(cat "$PIDFILE" 2>/dev/null || true)"

# fallback: find the listener on the port (in case the pid file is missing/stale)
if [ -z "$PID" ] || ! kill -0 "$PID" 2>/dev/null; then
  PID="$( (lsof -t -iTCP:"${PORT:-80}" -sTCP:LISTEN 2>/dev/null || fuser "${PORT:-80}/tcp" 2>/dev/null) | head -n1 | tr -d '[:space:]' )"
fi

if [ -z "$PID" ] || ! kill -0 "$PID" 2>/dev/null; then
  echo "Not running (no live Nightwatch process found)."
  rm -f "$PIDFILE"
  exit 0
fi

echo "Stopping Nightwatch (PID $PID)..."
kill "$PID" 2>/dev/null || true
for _ in $(seq 1 25); do kill -0 "$PID" 2>/dev/null || break; sleep 0.2; done
if kill -0 "$PID" 2>/dev/null; then
  echo "    still alive after ~5s; sending SIGKILL"
  kill -9 "$PID" 2>/dev/null || true
  sleep 0.3
fi
rm -f "$PIDFILE"
echo "    stopped."