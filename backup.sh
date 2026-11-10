#!/usr/bin/env bash
# Nightly backup for the Nightwatch shared-pins DB (triggered by nightwatch-backup.timer).
# Uses SQLite's online backup API (sqlite3 .backup) — safe while the server is live.
# Output: <repo>/backups/<YYYYMMDD>.db — date taken in America/New_York (owner's timezone),
# so a 23:45 ET backup on a UTC box is still named after that night's date.
set -euo pipefail
cd /opt/nightwatch-web
mkdir -p backups
FILE="backups/$(TZ=America/New_York date +%Y%m%d).db"
sqlite3 nightwatch-web.db ".backup '$FILE'"
echo "backed up nightwatch-web.db -> $FILE ($(stat -c%s "$FILE") bytes)"
