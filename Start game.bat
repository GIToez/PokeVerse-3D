@echo off
rem Starts PokeVerse-3D locally: game server (HTTP+WebSocket 5190) and Vite client (5300), then opens the browser.
cd /d "%~dp0"
if not exist node_modules call npm install
start "PokeVerse - Server (5190)" cmd /k node server.mjs
start "PokeVerse - Client (5300)" cmd /k npx vite
timeout /t 4 >nul
start "" http://localhost:5300/
