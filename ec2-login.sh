#!/usr/bin/env bash
# Nightwatch — EC2 login (Linux/macOS)
#
#   ./ec2-login.sh                              # interactive shell, dropped into /opt/nightwatch-web
#   ./ec2-login.sh "sudo systemctl status nightwatch"   # run one command
#
# Where the SSH key comes from (first match wins):
#   1. $EC2_SSH_KEY
#   2. ~/.ssh/nightwatch-ec2.pem
#   3. C:\projects\keys\NightwatchAvationEC2.pem   (Windows default; WSL and Git Bash path forms)
set -euo pipefail

HOST="ubuntu@nightwatchaviation.com"

KEY=""
for candidate in \
  "${EC2_SSH_KEY:-}" \
  "$HOME/.ssh/nightwatch-ec2.pem" \
  "/c/projects/keys/NightwatchAvationEC2.pem" \
  "/mnt/c/projects/keys/NightwatchAvationEC2.pem" \
  "C:/projects/keys/NightwatchAvationEC2.pem"
do
  if [ -n "$candidate" ] && [ -f "$candidate" ]; then
    KEY="$candidate"
    break
  fi
done

if [ -z "$KEY" ]; then
  echo "No EC2 SSH key found. Looked in:" >&2
  echo "  - \$EC2_SSH_KEY (not set)" >&2
  echo "  - ~/.ssh/nightwatch-ec2.pem" >&2
  echo "  - C:/projects/keys/NightwatchAvationEC2.pem (also /mnt/c/... for WSL)" >&2
  echo "Copy NightwatchAvationEC2.pem to one of those spots, or run:" >&2
  echo "  EC2_SSH_KEY=/path/to/key.pem $0" >&2
  exit 1
fi
echo "Using SSH key: $KEY" >&2

# private keys must be 0600 or ssh refuses them
chmod 600 "$KEY" 2>/dev/null || true

if [ "$#" -gt 0 ]; then
  exec ssh -i "$KEY" "$HOST" "$@"
fi

# interactive: land in the app root, not the (empty) home dir
APP_DIR="/opt/nightwatch-web"
echo "Nightwatch EC2 ($HOST) — landing in $APP_DIR; type 'exit' to return." >&2
exec ssh -t -i "$KEY" "$HOST" "cd $APP_DIR && exec \$SHELL -l"
