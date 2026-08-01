@echo off
title FleetSync Pro — Backend Install
color 0A
echo.
echo  Installing backend dependencies...
echo.
node --version >nul 2>&1
if errorlevel 1 ( echo Node.js not found. Get it from https://nodejs.org & pause & exit /b 1 )
if not exist .env ( copy .env.example .env >nul && echo Created .env — set JWT_SECRET before going live. )
call npm install
echo.
echo  Done. Run start.bat to launch the API server.
echo.
pause
