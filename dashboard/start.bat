@echo off
title FleetSync Pro — Dashboard :3000
color 0B
if not exist node_modules ( call install.bat )
echo  FleetSync Pro Dashboard → http://localhost:3000
echo  (Backend must be running on port 5000 first)
echo  Press Ctrl+C to stop.
echo.
npm start
pause
