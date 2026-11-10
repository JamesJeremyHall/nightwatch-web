# Nightwatch — EC2 login (Windows)
#
#   .\ec2-login.ps1                          # interactive shell on the server
#   .\ec2-login.ps1 "sudo systemctl status nightwatch"   # run one command
#
# Where the SSH key comes from (first match wins):
#   1. $env:EC2_SSH_KEY
#   2. C:\projects\keys\NightwatchAvationEC2.pem   (default)
#   3. %USERPROFILE%\.ssh\nightwatch-ec2.pem
param([string[]]$Command)

$ErrorActionPreference = 'Stop'

$Key = if ($env:EC2_SSH_KEY) { $env:EC2_SSH_KEY }
      elseif (Test-Path 'C:\projects\keys\NightwatchAvationEC2.pem') { 'C:\projects\keys\NightwatchAvationEC2.pem' }
      elseif (Test-Path "$env:USERPROFILE\.ssh\nightwatch-ec2.pem") { "$env:USERPROFILE\.ssh\nightwatch-ec2.pem" }
      else {
        Write-Error "No EC2 SSH key found. Copy NightwatchAvationEC2.pem to C:\projects\keys\ or set $env:EC2_SSH_KEY."
        exit 1
      }
if (-not (Test-Path $Key)) { Write-Error "SSH key not found: $Key"; exit 1 }

$Host_ = 'ubuntu@nightwatchaviation.com'

if ($Command.Count -gt 0) {
  ssh -i $Key -o BatchMode=no $Host_ $Command
} else {
  Write-Host "Nightwatch EC2  ($Host_)  — Ctrl+D or 'exit' to return." -ForegroundColor DarkGray
  ssh -i $Key $Host_
}
exit $LASTEXITCODE
