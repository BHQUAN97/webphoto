@echo off
REM ============================================
REM PHOTO STORAGE — START ALL DEV SERVICES (Windows)
REM ============================================

echo ==========================================
echo   Photo Storage — Dev Mode (Windows)
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
echo ==========================================
echo   All services started!
echo   Frontend:  http://localhost:3000
echo   Backend:   http://localhost:4000
echo ==========================================
pause
