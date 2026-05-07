-- TGT auto-startup: run both file-poll listeners on Reaper launch.
-- gig-command-listener watches /tmp/gig-commands/ for project rename/save commands
-- from the APK orchestrator. song-marker-listener watches /tmp/song-markers/ for
-- per-song marker drops triggered by the drummer prompter advance.
local function run(p)
  local ok, err = pcall(dofile, p)
  if not ok then reaper.ShowConsoleMsg("[__startup] " .. p .. " failed: " .. tostring(err) .. "\n") end
end
local home = os.getenv("HOME") or ""
run(home .. "/.config/REAPER/Scripts/TGT/gig-command-listener.lua")
run(home .. "/.config/REAPER/Scripts/TGT/song-marker-listener.lua")
