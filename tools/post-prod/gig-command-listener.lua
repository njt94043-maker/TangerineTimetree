-- TGT gig-command listener (Reaper, defer loop)
--
-- Sibling of song-marker-listener.lua. Polls /tmp/gig-commands/ (Linux) or
-- C:/tmp/gig-commands/ (Windows) for JSON command files dropped by the
-- gig-command-server.py HTTP daemon (which receives them from the APK over
-- the S23 hotspot LAN).
--
-- Command file format (as written by the daemon):
--   { "action": "start" | "save" | "stop",
--     "project_name": "<sanitised gig name>",
--     "ts_ms": <int> }
--
-- Actions:
--   start  -> create ~/Reaper/Gigs/<name>/<name>.rpp via Main_SaveProjectEx,
--             so the project filename matches the gig from the moment Set 1
--             starts recording.
--   save   -> Main_OnCommand 40026 (File: Save project) — saves to whatever
--             path is currently set. If start ran first, that's the gig path.
--   stop   -> save (no auto-close — drummer might want to keep the project
--             open between sets and across the gig wrap-up).
--
-- Usage:
--   1. Actions > Load > pick this file
--   2. Run it (defer loop runs in the background)
--   3. Terminate via Action list right-click > Terminate ReaScript
--
-- This is independent of song-marker-listener.lua — both can run side by side
-- (different poll dirs).

local POLL_INTERVAL_SEC = 0.2

local function poll_dir_path()
  local os_name = reaper.GetOS()
  if os_name:match("Win") then
    return "C:/tmp/gig-commands"
  else
    return "/tmp/gig-commands"
  end
end

local function gigs_dir_path()
  local os_name = reaper.GetOS()
  local home = os.getenv("HOME") or os.getenv("USERPROFILE") or ""
  if os_name:match("Win") then
    return home .. "/Reaper/Gigs"
  else
    return home .. "/Reaper/Gigs"
  end
end

local POLL_DIR = poll_dir_path()
local GIGS_DIR = gigs_dir_path()

local function ensure_dir(path)
  reaper.RecursiveCreateDirectory(path, 0)
end

local function list_files(path)
  local files = {}
  local i = 0
  while true do
    local f = reaper.EnumerateFiles(path, i)
    if not f then break end
    if f:match("%.json$") then table.insert(files, f) end
    i = i + 1
    if i > 500 then break end
  end
  table.sort(files)  -- timestamped filenames sort chronologically
  return files
end

local function read_file(path)
  local fh = io.open(path, "r")
  if not fh then return nil end
  local content = fh:read("*a") or ""
  fh:close()
  return content
end

-- Tiny JSON reader — just enough for our 3-key payload. Avoids a dofile
-- dependency on dkjson / cjson. Safe because we control the producer.
local function parse_command(text)
  local action = text:match('"action"%s*:%s*"([^"]+)"')
  local name = text:match('"project_name"%s*:%s*"([^"]*)"') or ""
  return action, name
end

local function sanitise(name)
  -- Allow letters, digits, dash, underscore, space, dot. Replace others with _.
  local cleaned = name:gsub("[^%w%-_%. ]", "_")
  cleaned = cleaned:gsub("^%s+", ""):gsub("%s+$", "")
  if cleaned == "" then cleaned = "untitled-gig" end
  return cleaned
end

local function start_project(name)
  local clean = sanitise(name)
  local proj_dir = GIGS_DIR .. "/" .. clean
  ensure_dir(proj_dir)
  local target = proj_dir .. "/" .. clean .. ".rpp"
  -- options=0: save (not save-as-copy); silent (no dialog).
  reaper.Main_SaveProjectEx(0, target, 0)
  reaper.ShowConsoleMsg(string.format("[gig-cmd] start -> %s\n", target))
end

local function save_project()
  reaper.Main_OnCommand(40026, 0)  -- File: Save project
  reaper.ShowConsoleMsg("[gig-cmd] save\n")
end

local function stop_project()
  -- Save again on stop. Don't auto-close — drummer keeps the project open.
  reaper.Main_OnCommand(40026, 0)
  reaper.ShowConsoleMsg("[gig-cmd] stop (saved)\n")
end

local function process(action, name)
  if action == "start" then
    start_project(name)
  elseif action == "save" then
    save_project()
  elseif action == "stop" then
    stop_project()
  else
    reaper.ShowConsoleMsg(string.format("[gig-cmd] unknown action: %s\n", tostring(action)))
  end
end

ensure_dir(POLL_DIR)
ensure_dir(GIGS_DIR)
reaper.ShowConsoleMsg("[gig-cmd-listener] watching " .. POLL_DIR .. "\n")
reaper.ShowConsoleMsg("[gig-cmd-listener] gigs dir " .. GIGS_DIR .. "\n")
reaper.ShowConsoleMsg("[gig-cmd-listener] poll interval " .. POLL_INTERVAL_SEC .. "s\n\n")

local last_poll = 0
local function loop()
  local now = reaper.time_precise()
  if now - last_poll >= POLL_INTERVAL_SEC then
    last_poll = now
    for _, fname in ipairs(list_files(POLL_DIR)) do
      local full = POLL_DIR .. "/" .. fname
      local content = read_file(full)
      if content then
        local action, name = parse_command(content)
        if action then
          process(action, name)
        end
        os.remove(full)
      end
    end
  end
  reaper.defer(loop)
end

loop()
