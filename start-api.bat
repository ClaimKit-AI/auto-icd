@echo off
echo.
echo ========================================
echo   ICD API Server - Production Ready
echo ========================================
echo.
echo Starting server with CORS enabled...
echo.

cd apps\api
node start-server.js

echo.
echo Server stopped. Press any key to exit...
pause > nul