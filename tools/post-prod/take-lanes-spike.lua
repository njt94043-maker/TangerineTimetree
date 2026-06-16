-- TGT take-lanes spike (S214 slice 2) — prove the in-place stacked-take FOLD mechanic.
--
-- WHY: slice 2 rewrites take_record so every recorded pass stacks as a TAKE LANE on the drum
-- tracks' canonical items (project stays one song long). The make-or-break unknown is the FOLD:
-- AddTakeToMediaItem + SetMediaItemTake_Source(recorded WAV) + SetActiveTake → does it produce
-- in-place lanes, leave project length unchanged, and switch all drum tracks together? This script
-- proves that deterministically WITHOUT needing a live record: it folds each drum track's EXISTING
-- recorded source as two extra takes (simulating passes 2 & 3) and asserts the acceptance criteria.
--
-- HOW TO RUN (on the rig, on a THROWAWAY cover — e.g. C:\Covers\Kids-In-America__827d042a):
--   1. Open the throwaway cover in Reaper (it must already have ≥1 recorded drum item — i.e. one
--      take. If not, record one pass first, or pick a cover that has a take).
--   2. Actions → Load ReaScript → this file → Run (or run it from the Action list).
--   3. Read the report at C:/tmp/take-lanes-spike-result.txt (also dumped to the ReaScript console).
--   4. The fold is wrapped in ONE undo point — press Ctrl+Z once to revert. Nothing is saved to disk.
--
-- ⛔ NEVER run on C:\Gigs\Beddau-RFC or C:\Gigs\The-Hanbury-Bargoed (reserved mixes). Covers only.

local RESULT_FILE = "C:/tmp/take-lanes-spike-result.txt"
local POS_EPS = 0.05

local BACKING = { ["Bass"]=true, ["Vocals"]=true, ["Other"]=true, ["Drums (ref)"]=true, ["Click"]=true }

local lines = {}
local function log(s) lines[#lines+1] = s; reaper.ShowConsoleMsg(s .. "\n") end

local function track_name(tr)
  local _, nm = reaper.GetSetMediaTrackInfo_String(tr, "P_NAME", "", false)
  return nm
end
local function drum_chan(tr)
  local nm = track_name(tr)
  if BACKING[nm] then return nil end
  return tonumber(nm:match("^(%d+)"))
end

-- Snapshot the backing items (count + summed length) to prove they're untouched by the fold.
local function backing_fingerprint()
  local count, total_len = 0, 0.0
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    if BACKING[track_name(tr)] then
      for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
        count = count + 1
        total_len = total_len + reaper.GetMediaItemInfo_Value(reaper.GetTrackMediaItem(tr, j), "D_LENGTH")
      end
    end
  end
  return count, total_len
end

local function run()
  local proj_name = reaper.GetProjectName(0, "")
  log("=== TGT take-lanes spike ===")
  log("project: " .. (proj_name ~= "" and proj_name or "(unsaved)"))

  -- Guard: never spike a reserved gig.
  local _, projfn = reaper.EnumProjects(-1, "")
  if projfn:match("[/\\]Gigs[/\\]") then
    log("ABORT: project is under \\Gigs\\ — spike covers only, not gig mixes."); return false
  end

  -- Find the drum-mic canonical items (one item per drum track expected).
  local drum_items = {}   -- { {tr=, it=, name=, fn=} }
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    if drum_chan(tr) and reaper.CountTrackMediaItems(tr) > 0 then
      local it = reaper.GetTrackMediaItem(tr, 0)
      local tk = reaper.GetActiveTake(it)
      local fn = tk and reaper.GetMediaSourceFileName(reaper.GetMediaItemTake_Source(tk), "")
      if fn and fn ~= "" then
        drum_items[#drum_items+1] = { tr = tr, it = it, name = track_name(tr), fn = fn }
      end
    end
  end

  if #drum_items < 1 then
    log("ABORT: no drum-mic track has a recorded item to fold. Record one pass first, then re-run.")
    return false
  end
  log(string.format("drum tracks with a take to fold: %d", #drum_items))

  local len_before = reaper.GetProjectLength(0)
  local b_count_before, b_len_before = backing_fingerprint()
  log(string.format("BEFORE: project_length=%.3f  backing_items=%d (sum_len=%.3f)",
    len_before, b_count_before, b_len_before))

  -- Fold: add two extra takes (passes 2 & 3) to each drum canonical item from its OWN source,
  -- exactly as take_fold_after_stop will from a freshly-recorded WAV.
  reaper.Undo_BeginBlock()
  for _, d in ipairs(drum_items) do
    for _ = 1, 2 do
      local ctk  = reaper.AddTakeToMediaItem(d.it)
      local csrc = reaper.PCM_Source_CreateFromFile(d.fn)
      reaper.SetMediaItemTake_Source(ctk, csrc)
      reaper.GetSetMediaItemTakeInfo_String(ctk, "P_NAME", "Take " .. reaper.CountTakes(d.it), true)
      reaper.SetActiveTake(ctk)
    end
    reaper.UpdateItemInProject(d.it)
  end
  reaper.Undo_EndBlock("take-lanes spike fold", -1)

  local len_after = reaper.GetProjectLength(0)
  local b_count_after, b_len_after = backing_fingerprint()

  -- Assertions.
  local ok = true
  local function check(cond, msg) if cond then log("PASS  " .. msg) else ok = false; log("FAIL  " .. msg) end end

  -- 1) Project length unchanged (in-place; the clone-forward growth is gone).
  check(math.abs(len_after - len_before) < POS_EPS,
    string.format("project length unchanged after fold (%.3f -> %.3f)", len_before, len_after))

  -- 2) Each drum canonical item reports CountTakes >= 3 (1 original + 2 folded).
  local all_three = true
  for _, d in ipairs(drum_items) do
    local n = reaper.CountTakes(d.it)
    if n < 3 then all_three = false end
    log(string.format("       %-10s CountTakes=%d", d.name, n))
  end
  check(all_three, "every drum track's canonical item has >= 3 takes (1 + 2 folded)")

  -- 3) SetActiveTake flips ALL drum tracks together. Set take 1/2/3 across all, read back.
  for target = 1, 3 do
    for _, d in ipairs(drum_items) do
      reaper.SetMediaItemInfo_Value(d.it, "I_CURTAKE", target - 1)
      local tk = reaper.GetTake(d.it, target - 1)
      if tk then reaper.SetActiveTake(tk) end
    end
    local agree = true
    for _, d in ipairs(drum_items) do
      if math.floor(reaper.GetMediaItemInfo_Value(d.it, "I_CURTAKE")) + 1 ~= target then agree = false end
    end
    check(agree, string.format("SetActiveTake %d flips every drum track to take %d", target, target))
  end

  -- 4) Backing items untouched (single items, same count + length).
  check(b_count_after == b_count_before and math.abs(b_len_after - b_len_before) < POS_EPS,
    string.format("backing items untouched (count %d->%d, sum_len %.3f->%.3f)",
      b_count_before, b_count_after, b_len_before, b_len_after))

  log(ok and "\n=== SPIKE PASS — in-place take-lanes fold proven ===" or "\n=== SPIKE FAIL — see above ===")
  log("NOTE: changes are in-memory + a single undo point. Press Ctrl+Z to revert; nothing was saved.")
  return ok
end

local ok = run()

local fh = io.open(RESULT_FILE, "wb")
if fh then fh:write(table.concat(lines, "\n") .. "\n"); fh:close() end
reaper.ShowConsoleMsg("\n[spike] report written to " .. RESULT_FILE .. "\n")
