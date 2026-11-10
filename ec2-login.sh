#!/usr/bin/env bash
# Nightwatch — EC2 login (Linux/macOS)
#
#   ./ec2-login.sh                              # interactive shell on the server
#   ./ec2-login.sh "sudo systemctl status nightwatch"   # run one command
#
# Where the SSH key comes from (first match wins):
#   1. $EC2_SSH_KEY
#   2. ~/.ssh/nightwatch-ec2.pem
#   3. C:\projects\keys\NightwatchAvationEC2.pem  (Windows default, via /mnt/c)
set -euo pipefail

HOST="ubuntu@nightwatchaviation.com"

if [ -n "${EC2_SSH_KEY:-}" ]; then
  KEY="$EC2_SSH_KEY"
elif [ -f "$HOME/.ssh/nightwatch-ec2.pem" ]; then
  KEY="$HOME/.ssh/nightwatch-ec2.pem"
elif [ -f "/mnt/c/projects/keys/NightwatchAvationEC2.pem" ]; then
  KEY="/mnt/c/projects/keys/NightwatchAvationEC2.pem"
else
  echo "No EC2 SSH key found. Copy NightwatchAvationEC2.pem to ~/.ssh/nightwatch-ec2.pem" >&2
  echo "or set EC2_SSH_KEY=/path/to/key.pem" >&2
  exit 1
fi
[ -f "$KEY" ] || { echo "SSH key not found: $KEY" >&2; exit 1; }

# private keys must be 0600 or ssh refuses them
chmod 600 "$KEY" 2>/dev/null || true

if [ "$#" -gt 0 ]; then
  exec ssh -i "$KEY" "$HOST" "$@"
fi
echo "Nightwatch EC2  ($HOST)  — type 'exit' to return." >&2
exec ssh -i "$KEY" "$HOST"
