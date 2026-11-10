@echo off
rem Nightwatch — one-command SSH into the production EC2 (Windows).
rem
rem   ec2-login.bat                            # interactive shell on the server
rem   ec2-login.bat "sudo systemctl status nightwatch"   # run one command
rem
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ec2-login.ps1" %*
exit /b %ERRORLEVEL%
