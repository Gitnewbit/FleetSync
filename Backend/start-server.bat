@echo off
title FleetSync Pro — API Server
color 0B

echo.
echo  =====================================================
echo   FleetSync Pro — API Server
echo  =====================================================
echo.

:: Check node_modules
if not exist node_modules (
    echo  [!] Dependencies not installed. Running install first...
    call install.bat
)

:: Check .env
if not exist .env (
    echo  [!] .env not found. Running install to create it...
    call install.bat
)

echo  Starting server...
echo  API:  http://localhost:5000
echo  Health check: http://localhost:5000/api/health
echo.
echo  Press Ctrl+C to stop.
echo.

node server.js
pause
