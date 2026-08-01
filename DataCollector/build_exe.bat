@echo off
setlocal
title FleetSync Pro — Build Windows EXE
color 0A

echo.
echo  ================================================
echo   FleetSync Pro — Build EXE
echo  ================================================
echo.

:: ─── Check Python ───────────────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python 3 not found.
    echo  Install from: https://www.python.org/downloads/
    echo  Make sure to tick "Add Python to PATH" during install.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do echo  Found: %%v
echo.

:: ─── Install dependencies ───────────────────────────────────────────────────
echo  [1/3] Installing Python dependencies...
pip install pyinstaller pysnmp requests schedule --quiet
if errorlevel 1 (
    echo  [ERROR] pip install failed. Try running as Administrator.
    pause & exit /b 1
)
echo  [OK]
echo.

:: ─── Build EXE ──────────────────────────────────────────────────────────────
echo  [2/3] Building EXE with PyInstaller...
pyinstaller --onefile --console ^
    --name "FleetSync_Collector" ^
    --distpath "." ^
    --workpath "build_tmp" ^
    --specpath "build_tmp" ^
    fleetsync_collector.py

if errorlevel 1 (
    echo  [ERROR] PyInstaller failed.
    echo  Try: pip install --upgrade pyinstaller
    pause & exit /b 1
)

:: ─── Cleanup temp files ──────────────────────────────────────────────────────
echo  [3/3] Cleaning up...
if exist build_tmp rmdir /s /q build_tmp
echo  [OK]
echo.

:: ─── Done ───────────────────────────────────────────────────────────────────
echo  ================================================
echo   BUILD COMPLETE
echo  ================================================
echo.
echo   FleetSync_Collector.exe is ready in this folder.
echo.
echo   TO USE ON CLIENT PC:
echo   1. Copy FleetSync_Collector.exe to C:\FleetSync\
echo   2. Copy fleetsync_config.json   to C:\FleetSync\
echo   3. Double-click FleetSync_Collector.exe
echo      (or run: FleetSync_Collector.exe --setup for wizard)
echo.
echo   Data appears on your dashboard within 1-2 minutes.
echo.
pause
endlocal
