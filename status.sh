#!/usr/bin/env bash
# Nightwatch — is the server running?
set -uo pipefail
cd "$(dirname "$0")"

PIDFILE="./nightwatch-web.pid"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  echo "RUNNING (PID $(cat "$PIDFILE"))"
  curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null && echo
else
  echo "not running"
  exit 1
fi