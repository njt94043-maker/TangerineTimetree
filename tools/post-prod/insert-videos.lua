-- TGT video insertion (S148, F3 sentinel S155)
--
-- Adds VIDEO items to the open Reaper project for every mp4 in the project
-- directory's video/ subdir. Pairs with pull-videos.py (which adb-pulls phone
-- mp4s into <project_dir>/video/<device>/).
--
-- Usage:
--   1. Open the gig's whole-gig-postprod.RPP in Reaper
--   2. Actions > Show action list > Load > pick this file (one-time install)
--   3. Run the action — adds one new track per device with each mp4 as a
--      VIDEO item starting at position 0
--   4. Manually slide each track's item to align with the audio (S139 bookend
--      tone will automate this; not yet shipped — for now use a clap or
--      visual sync at video edit time)
--
-- Layout produced (appended below existing audio tracks):
--   Track N+1: "Video -- <Model A>"   item 0: <gig>_<sessId>_<ts>.mp4
--                                     item 1: ... (if multi-set on same device)
--   Track N+2: "Video -- <Model B>"   ...
--
-- Idempotent-ish: re-running adds NEW tracks each time (Reaper has no
-- "track named X" lookup that's race-free across name normalisation). Easy
-- to delete a duplicate track via right-click -> Remove tracks. If you want
-- to re-pull and re-insert, blow away the prior video tracks first.
--
-- Reaper API refs (used below):
--   reaper.GetProjectPath, reaper.EnumerateFiles, reaper.EnumerateSubdirectories
--   reaper.InsertTrackAtIndex, reaper.GetTrack, reaper.CountTracks
--   reaper.GetSetMediaTrackInfo_String  (for naming the track)
--   reaper.AddMediaItemToTrack, reaper.AddTakeToMediaItem
--   reaper.PCM_Source_CreateFromFile, reaper.SetMediaItemTake_Source
--   reaper.GetMediaSourceLength, reaper.SetMediaItemInfo_Value
--   reaper.GetSetMediaItemTakeInfo_String

local function log(msg)
  reaper.ShowConsoleMsg(msg .. "\n")
end

-- F3: write a sentinel JSON the MS host can poll. The MS host fires the GET
-- and Reaper's /_/<cmd> returns 200 instantly regardless of script outcome;
-- without this sentinel the auto-insert step appears to succeed even when the
-- lua silently bailed (no project open / no video dir / etc). Writes to the
-- project root only. If no project is open, write_sentinel returns nil and
-- the host's 8s poll correctly times out with a "no sentinel written" warning
-- — same UX as any other write failure (S182: dropped the stale D:/Gigs
-- fallback that pre-dated the S170 GigsRoot config + S162 Acer migration).
local function write_sentinel(path_hint, payload_tbl)
  local json_lines = { "{" }
  local first = true
  local function add(k, v_str)
    if not first then json_lines[#json_lines] = json_lines[#json_lines] .. "," end
    first = false
    table.insert(json_lines, '  "' .. k .. '": ' .. v_str)
  end
  add("timestamp", tostring(os.time()))
  add("status", '"' .. (payload_tbl.status or "unknown") .. '"')
  add("gig_path", '"' .. (payload_tbl.gig_path or ""):gsub('\\', '/'):gsub('"', '\\"') .. '"')
  -- F6: capture the actual RPP filename so the host can tell whether the
  -- user opened the FX-laden post-prod RPP or the raw rig set RPP — both
  -- live in the same gig dir so gig_path alone doesn't distinguish them.
  add("rpp_filename", '"' .. (payload_tbl.rpp_filename or ""):gsub('\\', '/'):gsub('"', '\\"') .. '"')
  add("is_postprod_rpp", (payload_tbl.is_postprod_rpp == true) and "true" or "false")
  add("inserted_count", tostring(payload_tbl.inserted_count or 0))
  add("track_count", tostring(payload_tbl.track_count or 0))
  add("message", '"' .. (payload_tbl.message or ""):gsub('\\', '\\\\'):gsub('"', '\\"') .. '"')
  table.insert(json_lines, "}")
  local body = table.concat(json_lines, "\n")

  -- Write to the gig-root only. No fallback — if path_hint is empty (no
  -- project open) or the write fails, return nil and the host's 8s poll
  -- handles the timeout cleanly. Previous D:/Gigs fallback was stale post
  -- S170 (GigsRoot configurable, default C:\Gigs on the Acer per S162).
  if path_hint and path_hint ~= "" then
    local p = path_hint .. "/.last-insert-result.json"
    local f = io.open(p, "w")
    if f then f:write(body); f:close(); return p end
  end
  return nil
end

-- ---------------------------------------------------------------------------
-- Locate the project's video/ subdir.
-- GetProjectPath returns either the full path including "Audio Files" subdir,
-- or just the project's home dir, depending on Reaper version. Strip a
-- trailing "Audio Files" component if present so we land at <project_root>/.
-- ---------------------------------------------------------------------------
local proj_path = reaper.GetProjectPath("")
-- F6: also capture the RPP filename. EnumProjects(-1, "") returns (project,
-- projfn) for the active project. projfn is the full path on disk, or "" if
-- the project has never been saved. We extract just the basename for the
-- sentinel (host can prefix with gig_path if it needs the full path).
local _proj, _projfn = reaper.EnumProjects(-1, "")
local rpp_filename = ""
if _projfn and _projfn ~= "" then
  rpp_filename = _projfn:match("[^/\\]+$") or _projfn
end
-- A "post-prod" RPP is recognised by the suffix `postprod` anywhere in the
-- filename (covers both `<gig>-whole-gig-postprod.RPP` and per-set
-- `set-XXXX-postprod.RPP` shapes that build-postprod-rpp.py produces).
-- Anything else (raw `set-XXXX.RPP`, `rig-source.rpp`, hand-named files) is
-- treated as "not a postprod RPP" and the host surfaces that as a warning.
local is_postprod_rpp = rpp_filename:lower():find("postprod", 1, true) ~= nil

if proj_path == "" then
  write_sentinel(nil, {
    status = "no_project",
    rpp_filename = rpp_filename,
    is_postprod_rpp = is_postprod_rpp,
    message = "No project open (or unsaved). Save the gig RPP first.",
  })
  reaper.ShowMessageBox(
    "No project open (or unsaved). Save the project first so the script knows " ..
    "where to find video/ files.",
    "TGT — insert videos", 0)
  return
end

-- Normalise: drop trailing "/Audio Files" (Reaper sometimes returns this on
-- projects that have a recording dir set).
proj_path = proj_path:gsub("[/\\][Aa]udio [Ff]iles$", "")
local video_root = proj_path .. "/video"

-- Quick existence check
do
  local probe = io.open(video_root .. "/.probe", "r")
  if probe then probe:close() end
end

-- Enumerate device subdirs
local device_dirs = {}
local i = 0
while true do
  local sub = reaper.EnumerateSubdirectories(video_root, i)
  if not sub then break end
  table.insert(device_dirs, sub)
  i = i + 1
end

if #device_dirs == 0 then
  write_sentinel(proj_path, {
    status = "empty_video_dir",
    gig_path = proj_path,
    rpp_filename = rpp_filename,
    is_postprod_rpp = is_postprod_rpp,
    message = "No device folders under " .. video_root ..
      ". Run pull-videos.py first.",
  })
  reaper.ShowMessageBox(
    "No device folders under " .. video_root .. "/.\n\n" ..
    "Run pull-videos.py first (or click 'Pull videos' in the MS PWA), then " ..
    "re-run this action.",
    "TGT -- insert videos", 0)
  return
end

-- ---------------------------------------------------------------------------
-- Build plan: list of {device, mp4_path}. Skips any non-.mp4 (DCIM may also
-- contain thumbnails or .lrc sidecars). Sorted by filename so multi-set days
-- land in chronological order on the same track.
-- ---------------------------------------------------------------------------
local plan = {}  -- { {device=..., mp4_paths={p1,p2,...}}, ... }

for _, device in ipairs(device_dirs) do
  local dev_dir = video_root .. "/" .. device
  local mp4s = {}
  local j = 0
  while true do
    local fn = reaper.EnumerateFiles(dev_dir, j)
    if not fn then break end
    if fn:lower():match("%.mp4$") then
      table.insert(mp4s, dev_dir .. "/" .. fn)
    end
    j = j + 1
  end
  table.sort(mp4s)
  if #mp4s > 0 then
    table.insert(plan, {device = device, mp4_paths = mp4s})
  end
end

if #plan == 0 then
  write_sentinel(proj_path, {
    status = "no_videos",
    gig_path = proj_path,
    rpp_filename = rpp_filename,
    is_postprod_rpp = is_postprod_rpp,
    message = "Device folders exist under " .. video_root ..
      " but no .mp4 files inside.",
  })
  reaper.ShowMessageBox(
    "Found device folders under " .. video_root ..
    " but no .mp4 files inside any of them.\n\n" ..
    "Confirm pull-videos.py succeeded (no 'no videos to pull' line in output).",
    "TGT -- insert videos", 0)
  return
end

-- ---------------------------------------------------------------------------
-- Execute: append a track per device, one item per mp4 on that track.
-- POSITION = 0 for now (manual alignment until S139 bookend tone). Items on
-- the same track are placed end-to-end so they don't overlap visually; user
-- can drag to align with set markers.
-- ---------------------------------------------------------------------------
reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)

local total_items = 0
for _, group in ipairs(plan) do
  local idx = reaper.CountTracks(0)  -- append at end
  reaper.InsertTrackAtIndex(idx, true)  -- true = with default env/fx
  local track = reaper.GetTrack(0, idx)
  reaper.GetSetMediaTrackInfo_String(track, "P_NAME",
    "Video -- " .. group.device, true)

  local cursor = 0.0
  for _, mp4 in ipairs(group.mp4_paths) do
    local source = reaper.PCM_Source_CreateFromFile(mp4)
    if source then
      local length = reaper.GetMediaSourceLength(source)  -- seconds
      local item = reaper.AddMediaItemToTrack(track)
      local take = reaper.AddTakeToMediaItem(item)
      reaper.SetMediaItemTake_Source(take, source)
      reaper.SetMediaItemInfo_Value(item, "D_POSITION", cursor)
      reaper.SetMediaItemInfo_Value(item, "D_LENGTH", length)
      -- Take name = filename for legibility in the timeline
      local fname = mp4:match("([^/\\]+)$") or mp4
      reaper.GetSetMediaItemTakeInfo_String(take, "P_NAME", fname, true)
      cursor = cursor + length
      total_items = total_items + 1
      log(string.format("  + %s/%s  (%.1f min)",
        group.device, fname, length / 60.0))
    else
      log("  ! could not open " .. mp4)
    end
  end
end

reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
reaper.Undo_EndBlock(
  string.format("TGT: insert %d video(s) across %d track(s)",
    total_items, #plan), -1)

log(string.format("\nDONE: inserted %d video item(s) across %d new track(s).",
  total_items, #plan))
log("Drag each track's items to align with audio (set-start clap or visual sync).")

write_sentinel(proj_path, {
  status = "ok",
  gig_path = proj_path,
  rpp_filename = rpp_filename,
  is_postprod_rpp = is_postprod_rpp,
  inserted_count = total_items,
  track_count = #plan,
  message = string.format("inserted %d video(s) across %d new track(s)",
    total_items, #plan),
})
