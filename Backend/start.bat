@echo off
title FleetSync Pro — API Server :5000
color 0B
if not exist node_modules ( call install.bat )
if not exist .env ( copy .env.example .env >nul )
echo  FleetSync Pro API running on http://localhost:5000
echo  Press Ctrl+C to stop.
echo.
node server.js
pause
