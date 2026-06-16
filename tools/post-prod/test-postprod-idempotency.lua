-- ============================================================================
-- test-postprod-idempotency.lua  --  S210 LIVE idempotency proof for
--                                    setup-postprod-fx.lua  (sibling file)
-- ============================================================================
-- Closes the deferred S210 test: proves the count-guard in setup-postprod-fx.lua
-- is idempotent -- run it twice and run 2 must add NOTHING, while the 6 channels
-- whose chain uses ReaEQ TWICE (HPF pre + tone post) keep EXACTLY 2 ReaEQ each.
--
-- WHAT IT DOES (zero setup -- it builds its own scratch project):
--   1. Opens a NEW PROJECT TAB so it never touches whatever project is open.
--   2. Builds the 18 named gig channels + the 4 named buses (master is automatic).
--   3. Runs setup-postprod-fx.lua  (RUN 1), snapshots every track's total FX
--      count + its ReaEQ count.
--   4. Runs it AGAIN (RUN 2), snapshots again.
--   5. Writes a side-by-side report to S210-idempotency-report.txt next to this
--      script AND to the REAPER console. PASS = no track's count rose on run 2,
--      and every ReaEQ-twice channel shows exactly 2 ReaEQ on BOTH runs.
--
-- HOW TO RUN (follow the Reaper instance protocol):
--   * Confirm no gig/recording is active; close the always-on listener instance.
--   * Actions > Show action list > Load... > pick this file > Run.
--   * Read the report, then close the scratch project tab WITHOUT saving.
--
-- NOTE: on a stock Acer most third-party plugins (MJUCjr, TDR Nova, DC1A, Valhalla,
--   SPAN, SlickEQ, Kotelnikov, IVGI, Youlean, LoudMax) are NOT installed, so they
--   report MISSING and never instantiate -- harmless here: the idempotency proof
--   rides on the STOCK plugins (ReaEQ/ReaComp/ReaGate/ReaXComp), and the critical
--   ReaEQ-twice channels use ReaEQ (stock). Install the full FX set for a full-chain
--   run; the PASS/FAIL logic holds either way (a missing plugin is idempotent too).
-- ============================================================================

-- 18 gig channels -- EXACT names that setup-postprod-fx.lua matches by P_NAME.
local CHANNELS = {
  "01 TD-4 L","02 TD-4 R","03 James Vox","04 Adam BV","05 Adam Guitar",
  "06 Neil Bass","07 Spare","08 EAD L","09 EAD R","10 Kick","11 Snare",
  "12 Tom 1","13 Tom 2","14 Tom 3","15 OH L","16 OH R","17 Music L","18 Music R",
}
local BUSES = { "TD-4 BUS","VOX BUS","EAD BUS","DRUMS BUS" }

-- channels whose chain deliberately uses ReaEQ TWICE (must hold exactly 2)
local TWICE = {
  ["01 TD-4 L"]=true, ["02 TD-4 R"]=true, ["03 James Vox"]=true,
  ["04 Adam BV"]=true, ["05 Adam Guitar"]=true, ["10 Kick"]=true,
}

-- resolve the sibling setup-postprod-fx.lua from this script's own path
local _, thisPath = reaper.get_action_context()
local dir = (thisPath or ""):match("^(.*)[/\\]")
local POSTPROD = (dir and (dir .. "/setup-postprod-fx.lua")) or ""
if not reaper.file_exists(POSTPROD) then
  POSTPROD = "C:/apps/TGT/tools/post-prod/setup-postprod-fx.lua"   -- known location fallback
  dir = "C:/apps/TGT/tools/post-prod"
end
local REPORT = (dir or ".") .. "/S210-idempotency-report.txt"

if not reaper.file_exists(POSTPROD) then
  reaper.ShowMessageBox("Can't find setup-postprod-fx.lua next to this script:\n" .. POSTPROD,
    "S210 idempotency proof", 0)
  return
end

local function track_name(tr)
  local _, nm = reaper.GetSetMediaTrackInfo_String(tr, "P_NAME", "", false)
  return nm
end

local function make_track(name)
  local idx = reaper.CountTracks(0)
  reaper.InsertTrackAtIndex(idx, false)
  local tr = reaper.GetTrack(0, idx)
  reaper.GetSetMediaTrackInfo_String(tr, "P_NAME", name, true)
end

local function counts(tr)
  local total = reaper.TrackFX_GetCount(tr)
  local eq = 0
  for i = 0, total - 1 do
    local _, fxname = reaper.TrackFX_GetFXName(tr, i, "")
    if fxname:lower():find("reaeq", 1, true) then eq = eq + 1 end
  end
  return total, eq
end

local function snapshot()
  local snap = {}
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    local t, e = counts(tr)
    snap[track_name(tr)] = { total = t, eq = e }
  end
  local mt, me = counts(reaper.GetMasterTrack(0))
  snap["MASTER"] = { total = mt, eq = me }
  return snap
end

-- ---- build the scratch project in a fresh, isolated tab --------------------
reaper.Main_OnCommand(40859, 0)              -- New project (tab)
for _, n in ipairs(CHANNELS) do make_track(n) end
for _, n in ipairs(BUSES)    do make_track(n) end

-- tee the installer's console output so we keep BOTH runs' added=/present= lines
-- (the installer calls ClearConsole each run, which wipes the GUI but not this buffer)
local console = {}
local orig_show = reaper.ShowConsoleMsg
reaper.ShowConsoleMsg = function(s) console[#console+1] = tostring(s) end

reaper.ShowConsoleMsg("\n########## RUN 1 ##########\n")
dofile(POSTPROD)
local run1 = snapshot()
reaper.ShowConsoleMsg("\n########## RUN 2 ##########\n")
dofile(POSTPROD)
local run2 = snapshot()

reaper.ShowConsoleMsg = orig_show            -- restore the real console fn

-- ---- build the report ------------------------------------------------------
local lines = {}
local function out(s) lines[#lines+1] = s end

out("=== S210 setup-postprod-fx.lua idempotency proof ===")
out("script under test: " .. POSTPROD)
out("")
out(string.format("%-16s | run1 fx/eq | run2 fx/eq | verdict", "track"))
out(string.rep("-", 64))

local order = {}
for _, n in ipairs(CHANNELS) do order[#order+1] = n end
for _, n in ipairs(BUSES)    do order[#order+1] = n end
order[#order+1] = "MASTER"

local all_ok = true
for _, n in ipairs(order) do
  local a, b = run1[n], run2[n]
  if a and b then
    local rose = (b.total > a.total) or (b.eq > a.eq)
    local twice_ok = (not TWICE[n]) or (a.eq == 2 and b.eq == 2)
    local ok = (not rose) and twice_ok
    if not ok then all_ok = false end
    local flag = ok and "OK" or "*** FAIL ***"
    if TWICE[n] then flag = flag .. " [ReaEQ x2]" end
    out(string.format("%-16s |   %2d / %d  |   %2d / %d  | %s",
      n, a.total, a.eq, b.total, b.eq, flag))
  end
end
out(string.rep("-", 64))
out(all_ok and ">>> PASS: run 2 added nothing; ReaEQ-twice channels hold exactly 2."
            or  ">>> FAIL: see flagged rows above.")
out("")
out("--- installer console (both runs, verbatim) ---")
out(table.concat(console, ""))

local text = table.concat(lines, "\n")
reaper.ShowConsoleMsg("\n" .. text .. "\n")
local fh = io.open(REPORT, "w")
if fh then fh:write(text); fh:close()
  reaper.ShowConsoleMsg("\n[report written to " .. REPORT .. "]\n")
else
  reaper.ShowConsoleMsg("\n[could not write report file to " .. REPORT .. "]\n")
end

reaper.ShowMessageBox(
  (all_ok and "PASS" or "FAIL") .. " -- full numbers in the console + S210-idempotency-report.txt.\n\n" ..
  "Now close this scratch project tab WITHOUT saving.",
  "S210 idempotency proof", 0)
