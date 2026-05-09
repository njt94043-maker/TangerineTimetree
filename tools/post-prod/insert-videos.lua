-- TGT video insertion (S148)
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

-- ---------------------------------------------------------------------------
-- Locate the project's video/ subdir.
-- GetProjectPath returns either the full path including "Audio Files" subdir,
-- or just the project's home dir, depending on Reaper version. Strip a
-- trailing "Audio Files" component if present so we land at <project_root>/.
-- ---------------------------------------------------------------------------
local proj_path = reaper.GetProjectPath("")
if proj_path == "" then
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
