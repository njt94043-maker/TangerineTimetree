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
local STATUS_INTERVAL_SEC = 0.25  -- S214: Reaper-mirror status sidecar gate (independent of the command poll)

local TAKE_GAP_SEC = 4.0    -- S205: wiggle room (s) between takes so nothing overwrites
local TAKE_EPS     = 0.001
local TAKE_CAP     = 8      -- S217: max clone-forward takes per cover; blocks the take_record ADD path
local TAKE_BACKING = { ["Bass"]=true, ["Vocals"]=true, ["Other"]=true, ["Drums (ref)"]=true, ["Click"]=true }
-- S213: the backing STEMS the APK may ride (mute + monitor level). Click is excluded
-- (guide pulse). Mirrors the MS host's MixTracks allow-list; both layers enforce it.
local TAKE_MIX_ALLOWED = { ["Bass"]=true, ["Vocals"]=true, ["Other"]=true, ["Drums (ref)"]=true }
local take_phase   = 0      -- save-on-stop watcher: 0 idle, 1 record-requested, 2 recording-seen
-- S217 take guardrails: forward declarations. The slab resolver + destructive ops are DEFINED
-- next to take_enumerate (the SAME canonical-track enumeration basis the S216 readback uses), but
-- they are REFERENCED earlier -- take_record's cap check needs take_slab_starts, and process()
-- dispatches take_delete / take_record_over. Declaring the locals up here makes those earlier
-- references bind to these locals (not stray globals) regardless of definition order.
local take_slab_starts, take_delete, take_record_over, take_set_master

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

-- S214: Reaper-mirror status sidecar -- a SIBLING of POLL_DIR (must be OUTSIDE it).
-- The listener parses + os.remove's every file inside POLL_DIR, so a status file
-- there would be eaten as a (bad) command every tick. POLL_DIR = C:/tmp/gig-commands
-- -> STATUS_FILE = C:/tmp/gig-status.json.
local STATUS_FILE = (POLL_DIR:match("^(.*)[/\\][^/\\]*$") or "C:/tmp") .. "/gig-status.json"

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
  -- S214 take-seek: pos_sec is a bare JSON number (MS emits "30" or "30.5" -- match
  -- both integer and decimal form). Stays nil when absent.
  local pos_sec   = text:match('"pos_sec"%s*:%s*(%-?%d+%.?%d*)')
  -- S217 take guardrails: take_index is a 1-based bare int (nil when absent), same style as pos_sec.
  local take_index = tonumber(text:match('"take_index"%s*:%s*(%-?%d+)'))
  return action, name, track_path, title, arm, track_id, mix_track, mute, vol_db, pos_sec, take_index
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

-- ===== Take-mode transport seek (S214): scrub the loaded cover from the APK =====
-- File-bridge seek (no OSC-seek config risk; reuses the proven take-mix file drop).
-- Moves the edit cursor + playback to pos_sec on the OPEN cover. Clamp >= 0. NEVER
-- touches arm/record state. Play/Pause/Stop/to-start are OSC actions (APK-side);
-- only the scrub rides the file bridge (a drag stream the bridge can't take).
local function take_seek(pos)
  local p = tonumber(pos)
  if not p then reaper.ShowConsoleMsg("[take] seek: no pos_sec\n"); return end
  if p < 0 then p = 0 end
  reaper.SetEditCurPos(p, true, true)   -- move view + seek playback
  reaper.ShowConsoleMsg(string.format("[take] seek -> %.3f\n", p))
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
  -- S217 1e: cap the ADD path. take_slab_starts() is {} on the first take (drum tracks empty -> no
  -- canonical track) -> 0 -> passes. re-do / record-over don't ADD and run via other actions, so
  -- this only blocks the operator hitting Record at the cap.
  if #take_slab_starts() >= TAKE_CAP then
    reaper.ShowConsoleMsg(string.format("[take] cap %d reached -- delete or record-over instead; aborting record\n", TAKE_CAP))
    return
  end
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

local function process(action, name, track_path, title, arm, track_id, mix_track, mute, vol_db, pos_sec, take_index)
  if action == "start" then start_project(name)
  elseif action == "save" then save_project()
  elseif action == "stop" then stop_project()
  elseif action == "take-load" then take_load(track_path, title, track_id)
  elseif action == "take-record" then take_record(arm)
  elseif action == "take-mix" then take_mix(mix_track, mute, vol_db)
  elseif action == "take-seek" then take_seek(pos_sec)
  elseif action == "take-delete" then take_delete(take_index)
  elseif action == "take-record-over" then take_record_over(take_index, arm)
  elseif action == "take-master" then take_set_master(take_index)
  else reaper.ShowConsoleMsg(string.format("[gig-cmd] unknown action: %s\n", tostring(action))) end
end

-- ===== Reaper-mirror status sidecar (S214) =====
-- The APK can't see Reaper directly; this writes Reaper's transport / record state to a
-- JSON sidecar (SIBLING of POLL_DIR) which the MS host serves at GET /take/status and the
-- APK polls (1 s) for the mirror status bar + transport readout. Atomic write (tmp -> rename
-- so a reader never sees a half-written file); on its own faster gate so it never disturbs
-- the command poll. The caller pcall-guards it so a status hiccup can't kill the listener.
local function status_json_escape(s)
  return (s:gsub('\\', '\\\\'):gsub('"', '\\"'))
end

-- S216 slice2: enumerate the clone-forward takes for the status sidecar. Each take is one media
-- item per armed drum-mic record track (laid forward by take_record). We read positions off ONE
-- canonical track -- the first armed, numeric-name-prefix, non-backing track that has >=1 item --
-- mirroring how take_arm identifies drum-mic tracks (nm:match("^(%d+)")). This keeps the work
-- O(items) on the 0.25s status gate rather than a full 18-track rescan. Multi-layer / arm-subset
-- is a later slice; for full-kit takes every armed drum track carries the same item count, so one
-- canonical track is authoritative.
local function take_canonical_track()
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    local nm = take_track_name(tr)
    if (not TAKE_BACKING[nm]) and tonumber(nm:match("^(%d+)"))
       and reaper.GetMediaTrackInfo_Value(tr, "I_RECARM") == 1
       and reaper.CountTrackMediaItems(tr) >= 1 then
      return tr
    end
  end
  return nil
end

-- ===== S217 take guardrails: slab resolver + destructive ops =====
-- THE SAFETY IDEA: bucket items by START position into a slab window. Sort the take starts
-- s_1 < s_2 < ... < s_N off the SAME canonical track take_enumerate uses (so a 1-based take_index
-- from the APK maps to the same slab everywhere). Slab K owns [s_K - EPS, s_{K+1} - EPS); the last
-- slab runs to +inf. An item is in slab K iff its D_POSITION falls in that window -- bucketed by
-- where it STARTS, never where it ends, so a record-over overrun can't wipe the next slab.

-- Sorted ascending take START positions off the canonical track. {} when no cover/takes.
-- (Assigned to the forward-declared local so take_record's cap check binds to it.)
function take_slab_starts()
  local tr = take_canonical_track(); if not tr then return {} end
  local starts = {}
  for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
    starts[#starts+1] = reaper.GetMediaItemInfo_Value(reaper.GetTrackMediaItem(tr, j), "D_POSITION")
  end
  table.sort(starts)
  return starts
end

-- [lo, hi) window for 1-based slab k given sorted starts; hi = math.huge for the last slab.
local function take_slab_window(starts, k)
  local lo = starts[k] - TAKE_EPS
  local hi = (k < #starts) and (starts[k+1] - TAKE_EPS) or math.huge
  return lo, hi
end

-- Delete every item on `tr` whose D_POSITION is in [lo,hi). COLLECT-THEN-DELETE (deleting shifts
-- indices, so never delete mid-enumeration). Returns the count removed.
local function take_delete_items_in_window(tr, lo, hi)
  local doomed = {}
  for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
    local it = reaper.GetTrackMediaItem(tr, j)
    local p = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
    if p >= lo and p < hi then doomed[#doomed+1] = it end
  end
  for _, it in ipairs(doomed) do reaper.DeleteTrackMediaItem(tr, it) end
  return #doomed
end

-- non-backing, numeric-name-prefix (mirrors take_arm's drum-mic identification).
local function take_is_drum_track(tr)
  local nm = take_track_name(tr)
  return (not TAKE_BACKING[nm]) and tonumber(nm:match("^(%d+)")) ~= nil
end

-- 1c. take-delete: remove a whole slab (items on ALL tracks -- drum items AND the slab's backing
-- clone). Adjacent slabs keep their absolute positions (a gap is fine; covers audition by tapping
-- pills, not scrubbing). REFUSES the only take so a stray curl/long-press can't strip the cover to
-- empty (the APK also hides delete at count 1). The next status poll re-enumerates + renumbers.
function take_delete(index)
  local starts = take_slab_starts()
  local n = #starts
  if n == 0 then reaper.ShowConsoleMsg("[take] no takes to delete\n"); return end
  if index == nil or index < 1 or index > n then
    reaper.ShowConsoleMsg(string.format("[take] delete: bad index %s (have %d take(s))\n", tostring(index), n)); return
  end
  if n == 1 then
    reaper.ShowConsoleMsg("[take] can't delete the only take -- re-record over it or re-load the cover\n"); return
  end
  local lo, hi = take_slab_window(starts, index)
  local del_key = string.format("%.3f", starts[index])   -- ②·3a: was this slab the ★ master?
  reaper.Undo_BeginBlock()
  local removed = 0
  for i = 0, reaper.CountTracks(0) - 1 do
    removed = removed + take_delete_items_in_window(reaper.GetTrack(0, i), lo, hi)
  end
  reaper.Undo_EndBlock("TGT take-delete", -1)
  -- ②·3a delete hygiene: if the deleted slab WAS the master, clear the stored key so a stale
  -- master_start can't linger in the .rpp. (enumerate already self-cleans the display; this keeps
  -- the persisted state tidy.) Done before the save below so the cleared key persists.
  local _, cur_master = reaper.GetProjExtState(0, "TGT_TAKE", "master_start")
  if cur_master == del_key then reaper.SetProjExtState(0, "TGT_TAKE", "master_start", "") end
  reaper.Main_OnCommand(40026, 0)  -- save
  reaper.ShowConsoleMsg(string.format("[take] deleted take %d (window %.3f..%s), removed %d items\n",
    index, lo, (hi == math.huge) and "inf" or string.format("%.3f", hi), removed))
end

-- 1d. take-record-over: replace ONE slab's drums in place. Deletes only that slab's DRUM items
-- (keeps its backing clone so click/stems stay aligned), positions at the slab start, arms, records.
-- Backs the face Re-do too (index = n). Because the delete is window-bounded, an overrun can't wipe
-- slab K+1, and the overrunning new item still STARTS in slab K so enumerate keeps counting it as K.
function take_record_over(index, arm_csv)
  local starts = take_slab_starts()
  local n = #starts
  if n == 0 then reaper.ShowConsoleMsg("[take] no takes to record over\n"); return end
  if index == nil then index = n end                                  -- re-do-last
  if index < 1 then index = 1 elseif index > n then index = n end     -- clamp stray callers
  local lo, hi = take_slab_window(starts, index)
  reaper.Undo_BeginBlock()
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    if take_is_drum_track(tr) then take_delete_items_in_window(tr, lo, hi) end   -- DRUM items only
  end
  reaper.Undo_EndBlock("TGT take-record-over prep", -1)
  local record_at = starts[index]
  reaper.SetEditCurPos(record_at, true, false)
  take_arm(take_parse_arm(arm_csv))
  reaper.Main_OnCommand(40026, 0)                 -- save the prep
  reaper.Main_OnCommand(1013, 0)                  -- Transport: Record (at cursor)
  take_phase = 1                                  -- the existing save-on-stop watcher finalizes
  reaper.ShowConsoleMsg(string.format("[take] record-over take %d @ %.3f | arm=%s\n",
    index, record_at, (arm_csv ~= "" and arm_csv) or "10-16(default)"))
end

-- ②·3a (S219): mark the KEPT take. Stored as the slab's START position in ProjExtState (section
-- "TGT_TAKE", key "master_start", formatted "%.3f") -- NOT a take index. Start-keying survives a
-- reopen (saved in the .rpp) AND a record-over (which re-records at the SAME start), where an index
-- would drift under a delete. Tapping the current master clears it (toggle); setting it on another
-- take moves the ★. Assigned to the forward-declared local so process() (defined earlier) binds to it.
function take_set_master(index)
  local starts = take_slab_starts()
  local n = #starts
  if n == 0 then reaper.ShowConsoleMsg("[take] no takes to master\n"); return end
  if index == nil or index < 1 or index > n then
    reaper.ShowConsoleMsg(string.format("[take] master: bad index %s (have %d)\n", tostring(index), n)); return end
  local key = string.format("%.3f", starts[index])
  local _, cur = reaper.GetProjExtState(0, "TGT_TAKE", "master_start")
  if cur == key then
    reaper.SetProjExtState(0, "TGT_TAKE", "master_start", "")        -- toggle off
    reaper.ShowConsoleMsg(string.format("[take] master cleared (was take %d)\n", index))
  else
    reaper.SetProjExtState(0, "TGT_TAKE", "master_start", key)       -- set / move
    reaper.ShowConsoleMsg(string.format("[take] master -> take %d (@%s)\n", index, key))
  end
  reaper.Main_OnCommand(40026, 0)                                    -- save: persists in the .rpp
end

-- Returns take_count, a JSON array fragment for "takes" (correctly-escaped, no libs -- same
-- hand-rolled style write_status uses), active_take, and master_take. active_take is 1-based: the
-- take whose [start,end) contains pos; else the nearest take by distance (so pos past the end -> the
-- last take). master_take (②·3a) is 1-based: the take whose START matches the stored master_start key,
-- else 0 (unset OR orphaned-by-delete). 0 / "" / 0 / 0 when no cover is loaded or the canonical track
-- has no items.
local function take_enumerate(pos)
  local tr = take_canonical_track()
  if not tr then return 0, "", 0, 0 end
  local items = {}
  for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
    local it = reaper.GetTrackMediaItem(tr, j)
    local s = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
    local e = s + reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
    items[#items + 1] = { s = s, e = e }
  end
  table.sort(items, function(a, b) return a.s < b.s end)
  local n = #items
  if n == 0 then return 0, "", 0, 0 end
  -- ②·3a: the ★ master is the slab whose START matches the stored master_start key, formatted the
  -- SAME %.3f way take_set_master wrote it. Read once; 0 when unset or the key matches no current take
  -- (a deleted master self-cleans here -> no ★).
  local _, master_key = reaper.GetProjExtState(0, "TGT_TAKE", "master_start")
  local master_take = 0
  local parts = {}
  local active, contained = 0, false
  local nearest, best_dist = 1, nil
  for i = 1, n do
    local s, e = items[i].s, items[i].e
    parts[i] = string.format('{"index":%d,"start_sec":%.3f,"end_sec":%.3f}', i, s, e)
    if (not contained) and pos >= s and pos < e then active = i; contained = true end
    if master_key ~= "" and string.format("%.3f", s) == master_key then master_take = i end
    local dist = (pos < s) and (s - pos) or ((pos >= e) and (pos - e) or 0)
    if best_dist == nil or dist < best_dist then best_dist = dist; nearest = i end
  end
  if not contained then active = nearest end
  return n, table.concat(parts, ","), active, master_take
end

local function write_status()
  local st        = reaper.GetPlayState()        -- &1 playing, &2 paused, &4 recording
  local recording = (st & 4) == 4
  local playing   = (st & 1) == 1
  local paused    = (st & 2) == 2
  local play_state
  if recording then play_state = "recording"
  elseif paused then play_state = "paused"
  elseif playing then play_state = "playing"
  else play_state = "stopped" end
  -- live head while rolling, edit cursor otherwise.
  local pos = (playing or recording) and reaper.GetPlayPosition() or reaper.GetCursorPosition()
  local len = reaper.GetProjectLength(0)
  local proj = reaper.GetProjectName(0, "") or ""
  -- ts_ms: not wallclock (Lua has no ms clock) -- a debug breadcrumb only. The MS uses the
  -- file MTIME for staleness, not this field.
  local ts_ms = math.floor(reaper.time_precise() * 1000)
  -- S216 slice2: enumerate the clone-forward takes (off the position already computed above).
  -- ②·3a (S219): take_enumerate now also returns master_take (the ★ take's 1-based index, 0 = none).
  local take_count, takes_json, active_take, master_take = take_enumerate(pos)
  local body = string.format(
    '{"ts_ms":%d,"play_state":"%s","recording":%s,"playing":%s,'
      .. '"position_sec":%.3f,"length_sec":%.3f,"project_name":"%s",'
      .. '"take_count":%d,"takes":[%s],"active_take":%d,"master_take":%d,"take_cap":%d}',
    ts_ms, play_state, tostring(recording), tostring(playing),
    pos, len, status_json_escape(proj),
    take_count, takes_json, active_take, master_take, TAKE_CAP)
  local tmp = STATUS_FILE .. ".tmp"
  local fh = io.open(tmp, "wb"); if not fh then return end
  fh:write(body); fh:close()
  os.remove(STATUS_FILE)            -- Windows os.rename won't overwrite an existing file
  os.rename(tmp, STATUS_FILE)
end

ensure_dir(POLL_DIR)
ensure_dir(GIGS_DIR)
ensure_dir(COVERS_DIR)
reaper.ShowConsoleMsg("[gig-cmd-listener] watching " .. POLL_DIR .. "\n")
reaper.ShowConsoleMsg("[gig-cmd-listener] gigs dir " .. GIGS_DIR .. "\n")
reaper.ShowConsoleMsg("[gig-cmd-listener] status sidecar " .. STATUS_FILE .. "\n")
reaper.ShowConsoleMsg("[gig-cmd-listener] poll interval " .. POLL_INTERVAL_SEC .. "s\n\n")

local last_poll = 0
local last_status = 0
local function loop()
  local now = reaper.time_precise()
  if now - last_poll >= POLL_INTERVAL_SEC then
    last_poll = now
    for _, fname in ipairs(list_files(POLL_DIR)) do
      local full = POLL_DIR .. "/" .. fname
      local content = read_file(full)
      if content then
        local action, name, track_path, title, arm, track_id, mix_track, mute, vol_db, pos_sec, take_index = parse_command(content)
        if action then
          process(action, name, track_path, title, arm, track_id, mix_track, mute, vol_db, pos_sec, take_index)
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
  -- S214: write the mirror status sidecar on its own, faster gate. pcall-guarded so a
  -- status hiccup can never break the defer loop (which would kill the command listener).
  if now - last_status >= STATUS_INTERVAL_SEC then
    last_status = now
    pcall(write_status)
  end
  reaper.defer(loop)
end

loop()
