@echo off
rem Starts PokeVerse-3D locally: game server (HTTP+WebSocket 5190) and Vite client (5300), then opens the browser.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed, or Windows can't find it.
  echo.
  echo  1. Install the LTS version from https://nodejs.org/
  echo     ^(or run:  winget install OpenJS.NodeJS.LTS^)
  echo  2. Close ALL Command Prompt / terminal windows so they pick up the new PATH.
  echo  3. Double-click "Start game.bat" again.
  echo.
  start "" https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules\ws (
  echo Installing packages ^(first run only^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo  npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

start "PokeVerse - Server (5190)" cmd /k node server.mjs
start "PokeVerse - Client (5300)" cmd /k npx vite
timeout /t 4 >nul
start "" http://localhost:5300/
