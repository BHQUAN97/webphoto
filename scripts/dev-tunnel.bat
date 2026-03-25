@echo off
REM ============================================
REM PHOTO STORAGE — DEV + CLOUDFLARE TUNNEL
REM Start all services + expose via bhquan.site
REM ============================================

echo ==========================================
echo   Photo Storage — Dev + Tunnel Mode
echo ==========================================

echo.
echo 1. Starting MySQL + Redis (Docker)...
cd /d "%~dp0\.."
docker-compose up -d mysql redis 2>nul

echo.
echo 2. Starting Backend API (port 4000)...
cd /d "%~dp0\..\photo-storage\server"
start "API Server" cmd /c "npm run dev"

echo.
echo 3. Starting Worker...
start "Worker" cmd /c "npx tsx src/workers/start.ts"

echo.
echo 4. Starting Frontend (port 3000)...
cd /d "%~dp0\..\photo-storage"
start "Frontend" cmd /c "npm run dev"

echo.
echo 5. Starting Cloudflare Tunnel...
set TUNNEL_TOKEN=eyJhIjoiNGQ0ZTBjZGU5ZGZjY2JhMjk0NmY1MjkzYzFlOTAwOTkiLCJ0IjoiY2RlZmEzNmYtMTJkNS00MzA0LThjODEtZTNkMTk2ZjRiYjIzIiwicyI6IlpEQm1PVFZtWW1JdFptSTBOaTAwTTJRMkxXSmlaVE10TldZNU5qTXlNelkwWVRGaCJ9
start "Cloudflare Tunnel" cmd /c ""%ProgramFiles(x86)%\cloudflared\cloudflared.exe" tunnel run --token %TUNNEL_TOKEN%"

echo.
echo ==========================================
echo   All services started!
echo.
echo   Local:
echo     Frontend:  http://localhost:3000
echo     Backend:   http://localhost:4000
echo     Socket:    http://localhost:4001
echo.
echo   Public (via Cloudflare Tunnel):
echo     Frontend:  https://bhquan.site
echo     API:       https://api.bhquan.site
echo     WebSocket: https://ws.bhquan.site
echo ==========================================
pause
