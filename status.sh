#!/usr/bin/env bash
# Nightwatch - show whether the server is running and hit /api/health.
cd "$(dirname "$0")"
PIDFILE="./nightwatch-web.pid"
PORT="${PORT:-80}"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  echo "Running  (PID $(cat "$PIDFILE"))"
  printf 'Health: '
  curl -fsS "http://127.0.0.1:${PORT}/api/health" 2>/dev/null || printf '(no response on :%s)\n' "$PORT"
  echo
else
  echo "Not running."
fi