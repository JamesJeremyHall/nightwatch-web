@echo off
rem Nightwatch - one-click map launcher.
rem Starts the local server (in its own window) and opens the map in your browser.
start "Nightwatch Server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
timeout /t 1 /nobreak >nul
start "" "http://localhost:8000/map.html"