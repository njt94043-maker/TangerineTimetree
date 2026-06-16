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

local TAKE_GAP_SEC = 4.0    -- S205: wiggle room (s) between takes so nothing overwrites
local TAKE_EPS     = 0.001
local TAKE_BACKING = { ["Bass"]=true, ["Vocals"]=true, ["Other"]=true, ["Drums (ref)"]=true, ["Click"]=true }
-- S213: the backing STEMS the APK may ride (mute + monitor level). Click is excluded
-- (guide pulse). Mirrors the MS host's MixTracks allow-list; both layers enforce it.
local TAKE_MIX_ALLOWED = { ["Bass"]=true, ["Vocals"]=true, ["Other"]=true, ["Drums (ref)"]=true }
local take_phase   = 0      -- save-on-stop watcher: 0 idle, 1 record-requested, 2 recording-seen

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
  local arm = text:match('"arm"%s*:%s*"([^"]*)"') or ""
  local track_id = text:match('"track_id"%s*:%s*"([^"]*)"') or ""
  -- S213 take-mix: mix_track is a string; mute/vol_db are bare JSON numbers (MS may emit
  -- vol_db as -8 or -8.0 -- match both integer- and decimal-form). mute/vol_db stay nil
  -- when absent so a partial message only touches the field it carries.
  local mix_track = text:match('"mix_track"%s*:%s*"([^"]*)"') or ""
  local mute      = text:match('"mute"%s*:%s*(%-?%d+)')
  local vol_db    = text:match('"vol_db"%s*:%s*(%-?%d+%.?%d*)')
  return action, name, track_path, title, arm, track_id, mix_track, mute, vol_db
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

-- ===== Take-mode (S203 Slice 2; S204 wi-3) =====
-- Additive: builds a per-song cover project from a track_path. Imports the 4
-- Demucs stems onto named backing tracks plus the pre-rendered 48k click WAV
-- onto the "Click" track. Items load on TIME timebase (template TIMELOCKMODE 0 +
-- per-item C_BEATATTACHMODE 0) so nothing stretches; the rendered click replaces
-- the old native-metronome + tempo-map path and stays locked to the recording.
-- Drum-mic record tracks stay disarmed (arming = Slice 4).

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
  local click = dir .. "/" .. base .. ".click.wav"
  return stems_dir, beats, click
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
  reaper.SetMediaItemInfo_Value(item, "C_BEATATTACHMODE", 0)  -- 0 = time; never stretch with tempo
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

-- A (S207): a cover is "empty" only if NO track has any media item — a stale/failed build.
-- A cover with imported stems OR recorded takes has items and must NEVER be clobbered.
local function cover_is_empty()
  for i = 0, reaper.CountTracks(0) - 1 do
    if reaper.CountTrackMediaItems(reaper.GetTrack(0, i)) > 0 then return false end
  end
  return true
end

-- S208: cover dir keyed on IDENTITY, not bare title. base = sanitised title (or filename
-- stem if title is empty); suffix = first 8 chars of the track id, stripped to alphanumerics
-- (the id is a GUID like "550e8400-e29b-..." -> "550e8400"). Same-title versions get distinct
-- dirs; the same track always resolves to the same dir (idempotent reopen). No id -> title-only
-- (back-compat with any producer that doesn't send track_id).
local function cover_dir_name(title, track_path, track_id)
  local base = sanitise(title ~= "" and title or strip_ext(basename(track_path)))
  if track_id ~= nil and track_id ~= "" then
    local id8 = (track_id:gsub("[^%w]", "")):sub(1, 8)
    if id8 ~= "" then return base .. "__" .. id8 end
  end
  return base
end

local function take_load(track_path, title, track_id)
  if track_path == "" then reaper.ShowConsoleMsg("[take] no track_path\n"); return end
  if not reaper.file_exists(TAKE_TEMPLATE) then
    reaper.ShowConsoleMsg("[take] ERROR template missing: " .. TAKE_TEMPLATE .. " -- aborting\n"); return end
  local clean = cover_dir_name(title, track_path, track_id)
  local proj_dir = COVERS_DIR .. "/" .. clean
  local target   = proj_dir .. "/" .. clean .. ".rpp"

  -- Re-select an existing song -> reopen IF it's a real cover; rebuild if it's a stale empty one.
  if reaper.file_exists(target) then
    reaper.Main_openProject("noprompt:" .. target)
    if not cover_is_empty() then
      reaper.Main_OnCommand(40047, 0)  -- S207 C: build any missing peaks (reopened cover shows waveforms)
      reaper.ShowConsoleMsg("[take] reopened existing " .. target .. "\n")
      return
    end
    -- S207 A: existing cover has zero items (the Ego Brain stale-empty class) -> rebuild from template.
    reaper.ShowConsoleMsg("[take] existing cover is EMPTY -> rebuilding " .. target .. "\n")
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

  local stems_dir, _, click_path = resolve_song_paths(track_path)
  reaper.Undo_BeginBlock()
  import_stem("Bass",        stems_dir .. "/bass.wav")
  import_stem("Vocals",      stems_dir .. "/vocals.wav")
  import_stem("Other",       stems_dir .. "/other.wav")
  import_stem("Drums (ref)", stems_dir .. "/drums.wav")
  local dtr = find_track_by_name("Drums (ref)")
  if dtr then reaper.SetMediaTrackInfo_Value(dtr, "B_MUTE", 1) end  -- re-assert mute

  -- S204 wi-3: import the pre-rendered 48k click instead of building a tempo map
  -- + native metronome. With items on TIME timebase the click WAV already encodes
  -- the beats and plays locked to the stems. build_tempo_map / ensure_metronome_on
  -- / read_beats stay defined (may return for a visual grid) but are not called here.
  import_stem("Click", click_path)   -- graceful: logs + skips if the WAV is missing
  reaper.Undo_EndBlock("TGT take-load", -1)

  reaper.Main_OnCommand(40047, 0)   -- S207 C: build any missing peaks so imported stems render waveforms, not grey boxes
  reaper.Main_OnCommand(40026, 0)   -- Save
  local click_state = reaper.file_exists(click_path) and "found" or "MISSING"
  reaper.ShowConsoleMsg(string.format(
    "[take] built %s | stems=%s | click=%s\n",
    target, stems_dir, click_state))
end

-- ===== Take-mode backing mix (S213): ride a backing stem from the APK =====
-- Additive runtime control. Flips B_MUTE and/or sets D_VOL on ONE allow-listed backing
-- stem of the OPEN cover, addressed by exact name (Click excluded -- it's the guide pulse).
-- NEVER touches arm/record state, so the dry drum-mic capture contract is untouched (this
-- is purely what Nathan HEARS). Absolute values from the APK; the file-drop carries the full
-- state of the one track that changed, so it's idempotent + robust to a dropped message. It
-- saves, so the per-song ride persists across reopen (take_load does not re-assert mute on a
-- reopened cover). Build-time default stays: a NEW cover loads with Drums (ref) muted (:351).
local function take_mix(mix_track, mute, vol_db)
  if not TAKE_MIX_ALLOWED[mix_track] then
    reaper.ShowConsoleMsg("[take] mix: track not allowed: " .. tostring(mix_track) .. "\n"); return end
  local tr = find_track_by_name(mix_track)
  if not tr then
    reaper.ShowConsoleMsg("[take] mix: track not found: " .. mix_track .. " (load a cover first)\n"); return end
  if mute ~= nil then
    reaper.SetMediaTrackInfo_Value(tr, "B_MUTE", (tonumber(mute) ~= 0) and 1 or 0)
  end
  local db = tonumber(vol_db)
  if db then
    if db < -40 then db = -40 elseif db > 6 then db = 6 end
    reaper.SetMediaTrackInfo_Value(tr, "D_VOL", 10 ^ (db / 20))
  end
  reaper.Main_OnCommand(40026, 0)  -- save: the ride persists with the cover (reopen restores it)
  reaper.ShowConsoleMsg(string.format("[take] mix %s mute=%s vol_db=%s\n",
    mix_track, tostring(mute), tostring(vol_db)))
end

-- ===== Take-mode Slice 3 (S205): take mechanic =====
-- "record a take": jump past the last take + gap, copy the stem block forward,
-- arm the requested drum mics (BY NAME-prefix, template-order-independent), record
-- at the new block start, and save when recording stops. Reuses the take project +
-- TIME-timebase items from Slice 2; does NOT use the gig 40043 jump-to-end bundle.

local function take_track_name(tr)
  local _, nm = reaper.GetSetMediaTrackInfo_String(tr, "P_NAME", "", false)
  return nm
end

local function take_item_end(it)
  return reaper.GetMediaItemInfo_Value(it, "D_POSITION")
       + reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
end

local function take_rightmost_item(tr)
  local best, bestpos = nil, -1
  for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
    local it = reaper.GetTrackMediaItem(tr, j)
    local p  = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
    if p > bestpos then bestpos = p; best = it end
  end
  return best
end

-- Clone an item onto its own track at newpos, referencing the SAME source file
-- (no copy), pinned to TIME timebase. Mirrors import_stem's item construction.
local function take_clone_item(it, tr, newpos)
  local take = reaper.GetActiveTake(it) or reaper.GetMediaItemTake(it, 0)
  if not take then return end
  local src  = reaper.GetMediaItemTake_Source(take)
  local fn   = reaper.GetMediaSourceFileName(src, "")
  local len  = reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
  local _, nm = reaper.GetSetMediaItemTakeInfo_String(take, "P_NAME", "", false)
  local nit  = reaper.AddMediaItemToTrack(tr)
  local ntk  = reaper.AddTakeToMediaItem(nit)
  local nsrc = reaper.PCM_Source_CreateFromFile(fn)
  reaper.SetMediaItemTake_Source(ntk, nsrc)
  reaper.SetMediaItemInfo_Value(nit, "D_POSITION", newpos)
  reaper.SetMediaItemInfo_Value(nit, "D_LENGTH", len)
  reaper.SetMediaItemInfo_Value(nit, "C_BEATATTACHMODE", 0)  -- time, never stretch
  reaper.GetSetMediaItemTakeInfo_String(ntk, "P_NAME", nm or "", true)
  reaper.UpdateItemInProject(nit)
end

-- arm csv "10,11,15,16" -> set of channel numbers; default = full acoustic kit
local function take_parse_arm(csv)
  local s = {}
  if csv and csv ~= "" then
    for num in csv:gmatch("%d+") do s[tonumber(num)] = true end
  else
    for _, n in ipairs({10,11,12,13,14,15,16}) do s[n] = true end
  end
  return s
end

-- Arm by NAME-prefix: "10 Kick"->10 matched against the requested set. Backing
-- tracks (no numeric prefix) are FORCED disarmed. (Finding #2.)
local function take_arm(arm_set)
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    local nm = take_track_name(tr)
    if TAKE_BACKING[nm] then
      reaper.SetMediaTrackInfo_Value(tr, "I_RECARM", 0)
    else
      local chan = tonumber(nm:match("^(%d+)"))
      if chan then
        reaper.SetMediaTrackInfo_Value(tr, "I_RECARM", arm_set[chan] and 1 or 0)
      end
    end
  end
end

local function take_record(arm_csv)
  -- Gather the latest stem block from the backing tracks.
  local latest = {}            -- { {tr=, it=}, ... }
  local block_start, block_end = nil, 0.0
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    if TAKE_BACKING[take_track_name(tr)] then
      local it = take_rightmost_item(tr)
      if it then
        latest[#latest+1] = { tr = tr, it = it }
        local p = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
        local e = take_item_end(it)
        if block_start == nil or p < block_start then block_start = p end
        if e > block_end then block_end = e end
      end
    end
  end
  if #latest == 0 then
    reaper.ShowConsoleMsg("[take] no stems loaded -- open a song (take-load) first; aborting record\n")
    return
  end

  -- Rightmost end across the drum-mic (non-backing) record tracks.
  local max_drum_end = 0.0
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    if not TAKE_BACKING[take_track_name(tr)] then
      for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
        local e = take_item_end(reaper.GetTrackMediaItem(tr, j))
        if e > max_drum_end then max_drum_end = e end
      end
    end
  end

  reaper.Undo_BeginBlock()
  local record_at
  if max_drum_end <= block_start + TAKE_EPS then
    record_at = block_start                       -- first take: record against the existing block
  else
    record_at = math.max(block_end, max_drum_end) + TAKE_GAP_SEC
    for _, b in ipairs(latest) do                 -- copy the stem block forward
      local off = reaper.GetMediaItemInfo_Value(b.it, "D_POSITION") - block_start
      take_clone_item(b.it, b.tr, record_at + off)
    end
  end
  reaper.SetEditCurPos(record_at, true, false)
  take_arm(take_parse_arm(arm_csv))
  reaper.Undo_EndBlock("TGT take-record", -1)

  reaper.Main_OnCommand(40026, 0)                 -- Save the prep (copied stems + arm)
  reaper.Main_OnCommand(1013, 0)                  -- Transport: Record (at cursor)
  take_phase = 1
  reaper.ShowConsoleMsg(string.format(
    "[take] record-at %.3f | arm=%s\n", record_at, (arm_csv ~= "" and arm_csv) or "10-16(default)"))
end

local function process(action, name, track_path, title, arm, track_id, mix_track, mute, vol_db)
  if action == "start" then start_project(name)
  elseif action == "save" then save_project()
  elseif action == "stop" then stop_project()
  elseif action == "take-load" then take_load(track_path, title, track_id)
  elseif action == "take-record" then take_record(arm)
  elseif action == "take-mix" then take_mix(mix_track, mute, vol_db)
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
        local action, name, track_path, title, arm, track_id, mix_track, mute, vol_db = parse_command(content)
        if action then
          process(action, name, track_path, title, arm, track_id, mix_track, mute, vol_db)
        end
        os.remove(full)
      end
    end
    if take_phase ~= 0 then
      local st = reaper.GetPlayState()                 -- bit 4 (=4) set while recording
      if take_phase == 1 and (st & 4) == 4 then
        take_phase = 2
      elseif take_phase == 2 and (st & 4) == 0 then
        reaper.Main_OnCommand(40026, 0)                -- save the finished take
        reaper.ShowConsoleMsg("[take] recording stopped -> saved\n")
        take_phase = 0
      end
    end
  end
  reaper.defer(loop)
end

loop()
