#!/usr/bin/env bash
# Nightwatch — start the server (detached). Idempotent: safe to run repeatedly.
#
#     ./start.sh             # binds 0.0.0.0:3000  ->  http://localhost:3000/
#     PORT=4000 ./start.sh   # different port
#
set -uo pipefail
cd "$(dirname "$0")"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3000}"
PIDFILE="./nightwatch-web.pid"
OUTLOG="./nightwatch-web.out.log"
ERRLOG="./nightwatch-web.err.log"

# already running?
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  echo "Already running (PID $(cat "$PIDFILE"))."
  echo "  Stop with ./stop.sh   |   restart with ./restart.sh"
  exit 0
fi
rm -f "$PIDFILE"

echo "Starting Nightwatch  ->  http://${HOST}:${PORT}   (logs: ${OUTLOG} / ${ERRLOG})"
HOST="$HOST" PORT="$PORT" nohup node server.js >>"$OUTLOG" 2>>"$ERRLOG" &
NW=$!
echo "$NW" > "$PIDFILE"

# wait for it to come up
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    echo "    up.   PID $NW"
    exit 0
  fi
  kill -0 "$NW" 2>/dev/null || break
  sleep 0.3
done

echo "    FAILED to come up. Last log lines:" >&2
tail -n 25 "$ERRLOG" 2>/dev/null || true
exit 1