@echo off
title TGT Audio Capture
echo.
echo   ========================================
echo     TGT Audio Capture — Starting...
echo   ========================================
echo.

:: Start backend (Python FastAPI)
echo   [1/2] Starting backend on port 9123...
cd /d "%~dp0backend"
start "TGT Capture Backend" cmd /k ".venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 9123 --reload"

:: Wait a moment for backend to initialize
timeout /t 2 /nobreak > nul

:: Start frontend (Vite dev server)
echo   [2/2] Starting UI on port 5174...
cd /d "%~dp0ui"
start "TGT Capture UI" cmd /k "npx vite --port 5174"

:: Wait for UI to be ready then open browser
timeout /t 3 /nobreak > nul
echo.
echo   Opening http://localhost:5174 ...
start http://localhost:5174

echo.
echo   Both servers running. Close this window — servers stay open.
echo   To stop: close the "TGT Capture Backend" and "TGT Capture UI" windows.
echo.
