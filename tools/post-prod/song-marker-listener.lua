-- TGT song-marker listener (background defer loop)
--
-- Polls a directory for marker-request files. When a file appears, reads its
-- name + content, drops a named marker at play cursor, deletes the file.
--
-- Designed for the APK drummer-prompter integration: when a song is selected
-- on the prompter, APK writes a small file to the polling dir; this script
-- (running in Reaper) picks it up and drops a named marker into the live
-- recording in real time. No OSC config needed.
--
-- Polling dir (Windows): C:/tmp/song-markers/
-- Polling dir (Linux/E6330):  /tmp/song-markers/
-- Auto-detects platform.
--
-- Usage:
--   1. Actions > Load > pick this file
--   2. Run it (it'll keep running in the background via defer loop)
--   3. To stop: Actions > Show action list > scroll to the running script,
--      right-click, "Terminate ReaScript"
--   4. Auto-creates the polling dir if missing
--
-- File format the APK should write:
--   Filename: anything ending in .txt (e.g. "001-take-five.txt")
--   Content:  the song name as plain UTF-8 text (e.g. "Take Five")
--   If content is empty, the filename (sans .txt) is used as the name.
--
-- APK integration sketch (future work, not wired yet):
--   - On song-tap, APK writes file to polling dir via Tailscale SSH or
--     a small HTTP file-drop endpoint. ANY mechanism that lands a .txt
--     file in the polling dir works.

local POLL_INTERVAL_SEC = 0.2

local function poll_dir_path()
  local os_name = reaper.GetOS()
  if os_name:match("Win") then
    return "C:/tmp/song-markers"
  else
    return "/tmp/song-markers"
  end
end

local POLL_DIR = poll_dir_path()

local function ensure_dir(path)
  reaper.RecursiveCreateDirectory(path, 0)
end

local function list_files(path)
  local files = {}
  local i = 0
  while true do
    local f = reaper.EnumerateFiles(path, i)
    if not f then break end
    if f:match("%.txt$") then table.insert(files, f) end
    i = i + 1
    if i > 500 then break end       -- defensive
  end
  return files
end

local function read_file(path)
  local fh = io.open(path, "r")
  if not fh then return nil end
  local content = fh:read("*a") or ""
  fh:close()
  content = content:gsub("[\r\n]+$", "")
  return content
end

local function add_song_marker(name)
  local pos
  if reaper.GetPlayState() & 1 == 1 then
    pos = reaper.GetPlayPosition()
  else
    pos = reaper.GetCursorPosition()
  end
  -- TGT orange (BGR 0x129cf3), with high-bit flag so Reaper uses this color
  reaper.AddProjectMarker2(0, false, pos, 0, name, -1, 0x01129cf3)
  reaper.UpdateArrange()
end

ensure_dir(POLL_DIR)
reaper.ShowConsoleMsg("[song-marker-listener] watching " .. POLL_DIR .. "\n")
reaper.ShowConsoleMsg("[song-marker-listener] poll interval: " .. POLL_INTERVAL_SEC .. "s\n")
reaper.ShowConsoleMsg("[song-marker-listener] terminate via Action list right-click > Terminate ReaScript\n\n")

local last_poll = 0
local function loop()
  local now = reaper.time_precise()
  if now - last_poll >= POLL_INTERVAL_SEC then
    last_poll = now
    for _, fname in ipairs(list_files(POLL_DIR)) do
      local full = POLL_DIR .. "/" .. fname
      local content = read_file(full)
      if content then
        local name = content
        if name == "" then
          name = fname:gsub("%.txt$", ""):gsub("^%d+%-", "")
        end
        add_song_marker(name)
        os.remove(full)
        reaper.ShowConsoleMsg(string.format("[song-marker-listener] %s -> '%s'\n", fname, name))
      end
    end
  end
  reaper.defer(loop)
end

loop()
