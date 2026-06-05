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
--   start  -> open the TGT recording template (noprompt: discards the
--             auto-resumed prior session silently) then save-as to
--             ~/Reaper/Gigs/<name>/<name>.rpp. Guarantees a fresh, known
--             channel layout each gig regardless of what Reaper booted into.
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
  -- S200 fix-up (Windows Acer rig): record onto C: — the recorder's local working
  -- drive (backed up separately). NOT the D: post-prod/backup tree (D: is
  -- backup-only; live gigs must land on C:).
  if reaper.GetOS():match("Win") then
    return "C:/Gigs"
  else
    local home = os.getenv("HOME") or os.getenv("USERPROFILE") or ""
    return home .. "/Reaper/Gigs"
  end
end

local function template_path()
  -- S200: resolve inside Reaper's resource dir (%APPDATA%/REAPER/ProjectTemplates
  -- on Windows). The old hardcoded ~/.config/REAPER path was Linux-only and
  -- aborted every gig-start on Windows.
  return reaper.GetResourcePath() .. "/ProjectTemplates/tgt-gig-and-practice.RPP"
end

local function covers_dir_path()
  if reaper.GetOS():match("Win") then return "C:/Covers" else
    local home = os.getenv("HOME") or os.getenv("USERPROFILE") or ""
    return home .. "/Reaper/Covers" end
end
local function take_template_path()
  return reaper.GetResourcePath() .. "/ProjectTemplates/tgt-take-mode.RPP"
end

local POLL_DIR = poll_dir_path()
local GIGS_DIR = gigs_dir_path()
local TEMPLATE = template_path()
local COVERS_DIR    = covers_dir_path()
local TAKE_TEMPLATE = take_template_path()

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
  local track_path = text:match('"track_path"%s*:%s*"([^"]*)"') or ""
  local title = text:match('"title"%s*:%s*"([^"]*)"') or ""
  return action, name, track_path, title
end

local function sanitise(name)
  -- Whitespace runs collapse to a single dash; anything else outside
  -- [a-zA-Z0-9._-] becomes underscore. Strip leading/trailing dash/underscore.
  -- Result: shell-friendly filenames (no spaces, no quoting needed downstream).
  local cleaned = name:gsub("%s+", "-")
  cleaned = cleaned:gsub("[^%w%-_%.]", "_")
  cleaned = cleaned:gsub("^[-_]+", ""):gsub("[-_]+$", "")
  if cleaned == "" then cleaned = "untitled-gig" end
  return cleaned
end

local function start_project(name)
  local clean = sanitise(name)
  -- F2 (S133 A1): without this guard a missing template silently saves an empty
  -- project as the gig — undetectable from the drum throne, ruins the recording.
  if not reaper.file_exists(TEMPLATE) then
    reaper.ShowConsoleMsg(string.format("[gig-cmd] ERROR template missing: %s -- aborting start\n", TEMPLATE))
    return
  end
  local proj_dir = GIGS_DIR .. "/" .. clean
  ensure_dir(proj_dir)
  local target = proj_dir .. "/" .. clean .. ".rpp"
  -- F3 (S133 A1): same gig name same week would silently overwrite the prior
  -- recording. Auto-suffix to <name>-2.rpp / <name>-3.rpp on collision so the
  -- worst-case data-loss path becomes "two RPPs in the dir" instead of "lost gig".
  if reaper.file_exists(target) then
    local suffix = 2
    local candidate
    repeat
      candidate = proj_dir .. "/" .. clean .. "-" .. suffix .. ".rpp"
      suffix = suffix + 1
    until not reaper.file_exists(candidate) or suffix > 99
    if suffix > 99 then
      reaper.ShowConsoleMsg(string.format("[gig-cmd] ERROR collision exhausted at %s-99.rpp -- aborting start\n", clean))
      return
    end
    reaper.ShowConsoleMsg(string.format("[gig-cmd] collision -- using %s\n", candidate))
    target = candidate
  end
  -- S144 fix — copy-then-open instead of open-then-save-as. The previous
  -- pattern left Reaper's relative-path base on the template's directory,
  -- so `RECORD_PATH "Media"` resolved to ~/.config/REAPER/ProjectTemplates/Media/
  -- (across every gig — they'd overwrite). Filesystem-cp + open of the gig
  -- copy makes Reaper see it at its real location from the start, matching
  -- the autostart pattern that already worked. Channel WAVs land at
  -- <gig-dir>/Media/ as designed.
  local src = io.open(TEMPLATE, "rb")
  if not src then
    reaper.ShowConsoleMsg(string.format("[gig-cmd] ERROR cannot read template %s\n", TEMPLATE))
    return
  end
  local content = src:read("*a")
  src:close()
  local dst = io.open(target, "wb")
  if not dst then
    reaper.ShowConsoleMsg(string.format("[gig-cmd] ERROR cannot write %s\n", target))
    return
  end
  dst:write(content)
  dst:close()
  -- "noprompt:" prefix discards the currently-loaded project silently —
  -- so the auto-resumed prior gig doesn't taint the new one.
  reaper.Main_openProject("noprompt:" .. target)
  reaper.ShowConsoleMsg(string.format("[gig-cmd] start -> %s (cp from %s)\n", target, TEMPLATE))
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

-- ===== Take-mode (S203, Slice 2) =====
-- Additive: builds a per-song cover project from a track_path. Imports the 4
-- Demucs stems onto named backing tracks, builds a per-beat tempo map from the
-- song's beatmap so the native metronome locks to the recording, enables the
-- click. Drum-mic record tracks stay disarmed (arming = Slice 3/4).

local function dirname(p)  return p:match("^(.*)[/\\][^/\\]*$") or "" end
local function basename(p) return p:match("[^/\\]+$") or p end
local function strip_ext(n) return (n:gsub("%.[^.]+$","")) end

local function resolve_song_paths(track_path)
  local dir  = dirname(track_path)
  local base = strip_ext(basename(track_path))
  local stems_dir = dir .. "/" .. base .. "_stems"
  if not reaper.file_exists(stems_dir .. "/drums.wav") then
    local alt = dir .. "/" .. base .. " stems"
    if reaper.file_exists(alt .. "/drums.wav") then stems_dir = alt end
  end
  local beats = dir .. "/" .. base .. ".beats.json"
  if not reaper.file_exists(beats) then
    local alt = track_path .. ".beats.json"
    if reaper.file_exists(alt) then beats = alt end
  end
  return stems_dir, beats
end

local function read_beats(path)
  local fh = io.open(path, "r"); if not fh then return nil end
  local txt = fh:read("*a"); fh:close()
  local arr = txt:match('"beats"%s*:%s*%[(.-)%]'); if not arr then return nil end
  local beats = {}
  for num in arr:gmatch("[%-%d%.eE]+") do
    local v = tonumber(num); if v then beats[#beats+1] = v end
  end
  local bpb = tonumber(txt:match('"beats_per_bar"%s*:%s*([%-%d]+)'))
           or tonumber(txt:match('"beatsPerBar"%s*:%s*([%-%d]+)')) or 4
  if bpb < 1 then bpb = 4 end
  return beats, bpb
end

local function find_track_by_name(name)
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    local _, nm = reaper.GetSetMediaTrackInfo_String(tr, "P_NAME", "", false)
    if nm == name then return tr end
  end
  return nil
end

local function import_stem(track_name, file)
  if not reaper.file_exists(file) then
    reaper.ShowConsoleMsg("[take] missing stem: " .. file .. "\n"); return end
  local tr = find_track_by_name(track_name)
  if not tr then
    reaper.ShowConsoleMsg("[take] no track: " .. track_name .. "\n"); return end
  local item = reaper.AddMediaItemToTrack(tr)
  local take = reaper.AddTakeToMediaItem(item)
  local src  = reaper.PCM_Source_CreateFromFile(file)   -- references the original; no copy
  reaper.SetMediaItemTake_Source(take, src)
  local len = reaper.GetMediaSourceLength(src)
  reaper.SetMediaItemInfo_Value(item, "D_POSITION", 0.0)
  reaper.SetMediaItemInfo_Value(item, "D_LENGTH", len)
  reaper.GetSetMediaItemTakeInfo_String(take, "P_NAME", track_name, true)
  reaper.UpdateItemInProject(item)
end

local function build_tempo_map(beats, bpb)
  local n = #beats
  if n < 2 then return false end
  -- Lead-in: tempo from t=0 so the FIRST beat line lands exactly on beats[1].
  local first_bpm = 60.0 / beats[1]
  if first_bpm < 20  then first_bpm = 20  end
  if first_bpm > 400 then first_bpm = 400 end
  reaper.SetTempoTimeSigMarker(0, -1, 0.0, -1, -1, first_bpm, 0, 0, false)
  -- One pure (timepos) tempo point per beat. bpm = 60 / (gap to next beat).
  for i = 1, n do
    local dur = (i < n) and (beats[i+1] - beats[i]) or (beats[i] - beats[i-1])
    if dur <= 0.05 or dur >= 4 then dur = 0.5 end   -- guard bad detections
    local bpm = 60.0 / dur
    reaper.SetTempoTimeSigMarker(0, -1, beats[i], -1, -1, bpm, 0, 0, false)
  end
  reaper.UpdateTimeline()
  return true
end

local function ensure_metronome_on()
  if reaper.GetToggleCommandState(40364) ~= 1 then
    reaper.Main_OnCommand(40364, 0)   -- Options: Toggle metronome (idempotent enable)
  end
end

local function take_load(track_path, title)
  if track_path == "" then reaper.ShowConsoleMsg("[take] no track_path\n"); return end
  if not reaper.file_exists(TAKE_TEMPLATE) then
    reaper.ShowConsoleMsg("[take] ERROR template missing: " .. TAKE_TEMPLATE .. " -- aborting\n"); return end
  local clean = sanitise(title ~= "" and title or strip_ext(basename(track_path)))
  local proj_dir = COVERS_DIR .. "/" .. clean
  local target   = proj_dir .. "/" .. clean .. ".rpp"

  -- Re-select an existing song -> just open its project (add-take is Slice 3).
  if reaper.file_exists(target) then
    reaper.Main_openProject("noprompt:" .. target)
    reaper.ShowConsoleMsg("[take] reopened existing " .. target .. "\n")
    return
  end

  ensure_dir(proj_dir)
  -- copy-then-open (same pattern as start_project: keeps relative Media path correct)
  local src = io.open(TAKE_TEMPLATE, "rb"); if not src then
    reaper.ShowConsoleMsg("[take] cannot read template\n"); return end
  local content = src:read("*a"); src:close()
  local dst = io.open(target, "wb"); if not dst then
    reaper.ShowConsoleMsg("[take] cannot write " .. target .. "\n"); return end
  dst:write(content); dst:close()
  reaper.Main_openProject("noprompt:" .. target)

  local stems_dir, beats_path = resolve_song_paths(track_path)
  reaper.Undo_BeginBlock()
  import_stem("Bass",        stems_dir .. "/bass.wav")
  import_stem("Vocals",      stems_dir .. "/vocals.wav")
  import_stem("Other",       stems_dir .. "/other.wav")
  import_stem("Drums (ref)", stems_dir .. "/drums.wav")
  local dtr = find_track_by_name("Drums (ref)")
  if dtr then reaper.SetMediaTrackInfo_Value(dtr, "B_MUTE", 1) end  -- re-assert mute

  local beats, bpb = read_beats(beats_path)
  local ok = beats and build_tempo_map(beats, bpb) or false
  reaper.Undo_EndBlock("TGT take-load", -1)

  ensure_metronome_on()
  reaper.Main_OnCommand(40026, 0)   -- Save
  reaper.ShowConsoleMsg(string.format(
    "[take] built %s | stems=%s | beats=%s (%s)\n",
    target, stems_dir, beats_path, ok and (#beats .. " beats") or "NO BEATMAP"))
end

local function process(action, name, track_path, title)
  if action == "start" then start_project(name)
  elseif action == "save" then save_project()
  elseif action == "stop" then stop_project()
  elseif action == "take-load" then take_load(track_path, title)
  else reaper.ShowConsoleMsg(string.format("[gig-cmd] unknown action: %s\n", tostring(action))) end
end

ensure_dir(POLL_DIR)
ensure_dir(GIGS_DIR)
ensure_dir(COVERS_DIR)
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
        local action, name, track_path, title = parse_command(content)
        if action then
          process(action, name, track_path, title)
        end
        os.remove(full)
      end
    end
  end
  reaper.defer(loop)
end

loop()
