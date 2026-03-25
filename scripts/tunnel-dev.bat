@echo off
REM ============================================
REM Cloudflare Named Tunnel — bhquan.site
REM Tunnel ID: cdefa36f-12d5-4304-8c81-e3d196f4bb23
REM ============================================

echo ==========================================
echo   Cloudflare Tunnel - bhquan.site
echo ==========================================
echo.
echo   bhquan.site       -^> localhost:3000
echo   api.bhquan.site   -^> localhost:4000
echo   ws.bhquan.site    -^> localhost:4001
echo.
echo   Nhan Ctrl+C de dung tunnel.
echo.

set TUNNEL_TOKEN=eyJhIjoiNGQ0ZTBjZGU5ZGZjY2JhMjk0NmY1MjkzYzFlOTAwOTkiLCJ0IjoiY2RlZmEzNmYtMTJkNS00MzA0LThjODEtZTNkMTk2ZjRiYjIzIiwicyI6IlpEQm1PVFZtWW1JdFptSTBOaTAwTTJRMkxXSmlaVE10TldZNU5qTXlNelkwWVRGaCJ9

"%ProgramFiles(x86)%\cloudflared\cloudflared.exe" tunnel run --token %TUNNEL_TOKEN%
