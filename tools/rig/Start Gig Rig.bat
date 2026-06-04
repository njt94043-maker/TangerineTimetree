@echo off
REM Double-click to bring up the Tangerine gig rig.
REM Asserts the Reaper audio/OSC config (with Reaper CLOSED) then launches
REM Reaper + the Media Server host. Safe to double-click while a gig is live
REM (it detects the running rig and leaves it alone).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-gig-rig.ps1"
echo.
pause
