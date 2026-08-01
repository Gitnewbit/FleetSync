@echo off
title FleetSync Pro — Dashboard Install
color 0A
echo.
echo  Installing React dashboard dependencies...
echo.
node --version >nul 2>&1
if errorlevel 1 ( echo Node.js not found. Get it from https://nodejs.org & pause & exit /b 1 )
call npm install --legacy-peer-deps
echo.
echo  Done. Run start.bat to open the dashboard.
echo.
pause
