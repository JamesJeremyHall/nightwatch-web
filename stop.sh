#!/usr/bin/env bash
# Nightwatch — stop the server (graceful: SIGTERM lets node drain connections).
set -uo pipefail
cd "$(dirname "$0")"

PIDFILE="./nightwatch-web.pid"
if [ ! -f "$PIDFILE" ]; then
  echo "Not running (no PID file)."
  exit 0
fi
PID="$(cat "$PIDFILE" 2>/dev/null)"
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  for _ in $(seq 1 20); do kill -0 "$PID" 2>/dev/null || break; sleep 0.2; done
  if kill -0 "$PID" 2>/dev/null; then
    echo "    still alive — force killing"
    kill -9 "$PID" 2>/dev/null || true
  fi
  echo "Stopped (PID $PID)."
else
  echo "Not running (stale PID file)."
fi
rm -f "$PIDFILE"