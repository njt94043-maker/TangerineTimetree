-- TGT post-prod FX chain installer (v2 — per-channel + bus + master)
--
-- STATUS (S192 audit, batch A / G7):
--   ROLE: bootstrapper for FRESH post-prod RPPs that do NOT come from the
--         S145 `whole-gig-template-v1.RPP` template (i.e. `build-postprod-rpp.py`
--         WITHOUT `--from-template`). Builds the same chains the template
--         already carries baked-in.
--   IS THIS WHAT BUILT THE TEMPLATE? Effectively yes — the live template was
--         extracted (via `scripts/strip-rpp-items.py`) from a 2026-05-03
--         hand-mixed gig RPP whose FX chains match this script's intent
--         (per-channel HPF/gate/comp + bus glue + master mastering chain incl.
--         James 3-stage MJUCjr). Re-running this script on a project opened
--         from the template is a no-op for any already-present plugin (idempotent
--         via a per-plugin occurrence-count guard; C1 fix S210, was a buggy -1 that
--         always duplicated on re-run).
--   STILL NEEDED? YES — kept for two real cases:
--         1. Building a post-prod project FROM SCRATCH (no template), e.g. a
--            one-off recording outside the rig's 18ch channel map. The script
--            wires the standard chains in one Action-menu run.
--         2. RECOVERING a project where FX chains were stripped/lost or where
--            channels were renamed and chains need re-applying by NAME match.
--         The preferred S145 path is `build-postprod-rpp.py --from-template`
--         (`IMPORT-PLAYBOOK.md` Step 3) — that bypasses this script entirely.
--   NOT STALE — keep. Update both sides if the template's chains diverge.
--
-- Walks the open project, matches tracks by NAME, inserts:
--   - PER-CHANNEL chains (HPF/gate/comp surgical work) per the locked plan
--   - BUS chains (glue + colour)
--   - MASTER mastering chain
--
-- Idempotent (C1 fix, S210): add_chain counts how many of each plugin are already on the
-- track and force-adds only the shortfall, so re-running adds nothing while a first run still
-- builds chains that repeat a plugin (ReaEQ pre + post). The old code force-added every slot
-- (instantiate=-1, no guard) so each re-run duplicated the whole chain.
-- New plugins on re-run land at end of chain — drag-reorder if needed.
--
-- Plugins not found are reported in the console.
--
-- Recommended starting parameter values per channel (dial these in after this
-- script runs — see proj-tgt--reaper-postprod-plan.md / research notes):
--   * Vocals      HPF 80-110Hz, gate -45dB w/ 50-100ms hold, comp 3:1 ~ -18dB
--   * Kick        HPF 35Hz, gate -30dB w/ 80ms hold, comp 4:1 ~ -14dB
--   * Snare       HPF 100Hz, gate -32dB w/ 60ms hold, comp 4:1 ~ -16dB
--   * Toms        HPF 50-70Hz, gate -38dB w/ 250-350ms hold, comp 3:1 ~ -12dB
--   * Overheads   HPF 150Hz, comp 2:1 ~ -18dB ~ 2dB GR
--   * Bass        HPF 40Hz, comp 4:1 ~ -14dB ~ 4-6dB GR
--   * Guitar      HPF 90Hz LPF 8kHz, comp 2:1 ~ -16dB
--   * TD-4 L/R    HPF 35Hz; tame 80Hz (-2dB shelf), 300-400Hz (-2-4dB bell), 2-3kHz
--                 (-1-3dB bell if biting); +1-2dB shelf @ 10kHz for air; comp 2:1
--                 ~ -16dB slow attack (Roland kits are headphone-voiced — boomy +
--                 brittle through a PA; aim for translation not surgery)
--
-- JAMES VOX LEVELING (Ch 3): serial 2-stage compression — fast ReaComp catches
-- peaks, slow MJUCjr after handles the macro dynamic range from him moving away
-- from the mic on loud parts (distance variation = inverse-square level swing
-- of 6-12dB which a single fast comp can't tame).

-- ============================================================================
-- PER-CHANNEL CHAINS — keyed by exact track NAME
-- ============================================================================
local CHANNEL_CHAINS = {
  -- Roland TD-4 (1-2): stereo-summed e-kit. HPF + tone-shape + glue comp.
  -- Roland kits are headphone-voiced → boomy + brittle on a PA; chain aims
  -- to tame sub, scoop mud, shave bite, add air. Stays light — not surgical.
  ["01 TD-4 L"] = { {"ReaEQ"}, {"ReaComp"}, {"ReaEQ"} },
  ["02 TD-4 R"] = { {"ReaEQ"}, {"ReaComp"}, {"ReaEQ"} },

  -- Lead vocal — 2-stage compression for distance variation, then de-ess + tone
  ["03 James Vox"] = {
    {"ReaEQ"},                                            -- HPF + mud cut
    {"ReaGate"},                                          -- between-song bleed
    {"ReaComp"},                                          -- fast comp: catch peaks
    {"MJUCjr"},                                           -- SLOW vari-mu LEVELER (volume inconsistency)
    {"TDR Nova"},                                         -- dynamic de-ess
    {"ReaEQ"},                                            -- post-comp tone shape
  },
  ["04 Adam BV"] = {
    {"ReaEQ"}, {"ReaGate"}, {"ReaComp"},
    {"TDR Nova"}, {"ReaEQ"},
  },

  -- Guitar (standalone)
  ["05 Adam Guitar"] = {
    {"ReaEQ"}, {"ReaComp"}, {"ReaEQ"},                    -- HPF/LPF, comp, tone
  },

  -- Bass (standalone) — surgical low-end + multiband for low/high split
  ["06 Neil Bass"] = {
    {"ReaEQ"}, {"ReaComp"}, {"ReaXComp"},                 -- HPF, peak comp, multiband
    {"IVGI2", "IVGI", "Klanghelm IVGI"},                  -- harmonic content
  },

  -- 07 Spare: no FX
  -- 17-18 Music (backing tracks / practice / venue break): no FX — pre-mastered.
  --   Per-song mute decision happens at mixdown, not auto-muted at install time.

  -- Yamaha EAD — pre-blended, light touch only
  ["08 EAD L"] = { {"ReaEQ"}, {"ReaComp"} },
  ["09 EAD R"] = { {"ReaEQ"}, {"ReaComp"} },

  -- Acoustic kick — gate + comp + tone EQ
  ["10 Kick"] = {
    {"ReaEQ"}, {"ReaGate"}, {"ReaComp"}, {"ReaEQ"},
  },

  -- Snare — gate + comp + dynamic ring tame
  ["11 Snare"] = {
    {"ReaEQ"}, {"ReaGate"}, {"ReaComp"}, {"TDR Nova"},
  },

  -- Toms — tight gate (cymbal bleed!) + comp
  ["12 Tom 1"] = { {"ReaEQ"}, {"ReaGate"}, {"ReaComp"} },
  ["13 Tom 2"] = { {"ReaEQ"}, {"ReaGate"}, {"ReaComp"} },
  ["14 Tom 3"] = { {"ReaEQ"}, {"ReaGate"}, {"ReaComp"} },

  -- Overheads — HPF (kick is on Ch 10) + light comp + dynamic cymbal tame
  ["15 OH L"] = { {"ReaEQ"}, {"ReaComp"}, {"TDR Nova"} },
  ["16 OH R"] = { {"ReaEQ"}, {"ReaComp"}, {"TDR Nova"} },
}

-- ============================================================================
-- BUS CHAINS — keyed by bus parent track NAME
-- ============================================================================
local BUS_CHAINS = {
  -- TD-4 BUS (1-2): pre-summed inside the Roland module; bus-level glue only.
  ["TD-4 BUS"] = {
    {"DC1A", "DC1A3", "DC1A 3", "Klanghelm DC1A"},        -- light glue (~1-2dB GR)
  },

  -- MUSIC BUS (17-18): pre-mastered, no processing (adding comp pumps against vox)
  -- ["MUSIC BUS"] = {},

  ["VOX BUS"] = {
    {"DC1A", "DC1A3", "DC1A 3", "Klanghelm DC1A"},        -- glue
    {"Valhalla Supermassive", "ValhallaSupermassive"},    -- reverb (insert; set Mix to ~20%)
    {"MJUCjr"},                                           -- final vari-mu warmth
  },

  -- EAD bus: parallel comp for weight under acoustic kick
  ["EAD BUS"] = {
    {"ReaComp"},                                          -- parallel — set Wet to ~30%
  },

  -- Acoustic kit bus: glue + parallel-comp punch
  ["DRUMS BUS"] = {
    {"DC1A", "DC1A3", "DC1A 3", "Klanghelm DC1A"},        -- glue
    {"ReaComp"},                                          -- parallel comp for kit PUNCH (set Wet ~30%).
                                                          -- TENSjr fix (S210): was {"TENSjr"} labelled
                                                          -- "tape saturation" -- but TENSjr is a Klanghelm
                                                          -- spring REVERB, not punch. The slot's intended
                                                          -- job is transient/punch, so use stock ReaComp.
  },
}

-- ============================================================================
-- MASTER CHAIN — mix-stage tone + mastering compression + true-peak limiting
-- ============================================================================
local MASTER_CHAIN = {
  {"SPAN", "Voxengo SPAN"},                               -- pre-meter
  {"TDR VOS SlickEQ", "VOS SlickEQ", "SlickEQ"},          -- broad tone + saturation
  {"TDR Nova"},                                           -- dynamic EQ for problem zones
  {"TDR Kotelnikov", "Kotelnikov"},                       -- transparent mastering comp
  {"LoudMax"},                                            -- true-peak ceiling -1.0dBTP
  {"Youlean Loudness Meter 2", "Youlean"},                -- LUFS verification
}

-- ============================================================================
-- HELPERS
-- ============================================================================
local function track_name(tr)
  local _, name = reaper.GetSetMediaTrackInfo_String(tr, "P_NAME", "", false)
  return name
end

-- How many FX already on `tr` match ANY of `candidates` (display-name substring,
-- case-insensitive). REAPER's TrackFX_GetFXName returns e.g. "VST3: ReaComp (Cockos)",
-- so the bare plugin name is a reliable substring.
local function fx_count_matching(tr, candidates)
  local c = 0
  for i = 0, reaper.TrackFX_GetCount(tr) - 1 do
    local _, fxname = reaper.TrackFX_GetFXName(tr, i, "")
    if fxname ~= "" then
      local lname = fxname:lower()
      for _, cand in ipairs(candidates) do
        if lname:find(cand:lower(), 1, true) then c = c + 1; break end
      end
    end
  end
  return c
end

-- Force-add the first INSTALLED candidate. instantiate=-1 = always create a new instance
-- (the only TrackFX_AddByName behaviour we rely on; positive values are ambiguous).
local function force_add_first_match(tr, candidates)
  for _, name in ipairs(candidates) do
    local idx = reaper.TrackFX_AddByName(tr, name, false, -1)
    if idx >= 0 then return idx, name end
  end
  return -1, nil
end

-- C1 fix (S210): genuine idempotency that also survives chains which deliberately repeat a
-- plugin (several channels use ReaEQ twice: HPF pre + tone post). For each slot we track how
-- many of that plugin the chain has asked for so far (`want`) and compare to how many are
-- actually on the track; we force-add ONLY the shortfall. A re-run finds the counts already
-- satisfied and adds nothing. (The old code force-added EVERY slot with instantiate=-1 and no
-- count guard, so every re-run duplicated the whole chain. A naive flat instantiate=1 would
-- have fixed the dup but DROPPED the 2nd ReaEQ on first run -- worse.)
local function add_chain(tr, chain, label)
  local added, skipped, missing = 0, 0, {}
  local want = {}                                  -- candidates[1] -> occurrences requested so far
  for _, candidates in ipairs(chain) do
    local key = candidates[1]
    want[key] = (want[key] or 0) + 1
    if fx_count_matching(tr, candidates) >= want[key] then
      skipped = skipped + 1                         -- already have enough -> idempotent no-op
    else
      local idx, _ = force_add_first_match(tr, candidates)
      if idx >= 0 then added = added + 1 else table.insert(missing, candidates[1]) end
    end
  end
  local msg = string.format("  %-25s  added=%d  already-present=%d", label, added, skipped)
  if #missing > 0 then
    msg = msg .. string.format("  MISSING=[%s]", table.concat(missing, ", "))
  end
  reaper.ShowConsoleMsg(msg .. "\n")
end

-- ============================================================================
-- MAIN
-- ============================================================================
reaper.Undo_BeginBlock()
reaper.ClearConsole()
reaper.ShowConsoleMsg("=== TGT post-prod FX chain installer (v2) ===\n")
reaper.ShowConsoleMsg("(Ctrl+Z to undo any of this if it isn't what you wanted.)\n\n")

reaper.ShowConsoleMsg("--- PER-CHANNEL ---\n")
local n = reaper.CountTracks(0)
local seen_channels = 0
for i = 0, n - 1 do
  local tr = reaper.GetTrack(0, i)
  local name = track_name(tr)
  local chain = CHANNEL_CHAINS[name]
  if chain then
    seen_channels = seen_channels + 1
    add_chain(tr, chain, name)
  end
end
if seen_channels == 0 then
  reaper.ShowConsoleMsg("  (no channels matched — check that track names start with 'NN ...')\n")
end

reaper.ShowConsoleMsg("\n--- BUSES ---\n")
local seen_buses = {}
for i = 0, n - 1 do
  local tr = reaper.GetTrack(0, i)
  local name = track_name(tr)
  local chain = BUS_CHAINS[name]
  if chain and not seen_buses[name] then
    seen_buses[name] = true
    add_chain(tr, chain, name)
  end
end

reaper.ShowConsoleMsg("\n--- MASTER ---\n")
add_chain(reaper.GetMasterTrack(0), MASTER_CHAIN, "MASTER")

reaper.ShowConsoleMsg("\nDone.\n")
reaper.ShowConsoleMsg("\nNext steps:\n")
reaper.ShowConsoleMsg("  1. Ctrl+S to save FX chains into the project\n")
reaper.ShowConsoleMsg("  2. Dial in per-channel params (see header of this script)\n")
reaper.ShowConsoleMsg("  3. On VOX BUS, set Valhalla Supermassive Mix knob to ~20%\n")
reaper.ShowConsoleMsg("  4. On EAD BUS, set ReaComp Wet to ~30% (parallel comp)\n")
reaper.ShowConsoleMsg("  5. JAMES VOX (Ch 3): the 2nd comp (MJUCjr) is the LEVELER for\n")
reaper.ShowConsoleMsg("     his distance/volume issue. Set MJUCjr 'comp' to ~30%, recovery slow.\n")
reaper.ShowConsoleMsg("     ReaComp before it: thr -18dB, ratio 3:1 (~3-5dB GR).\n")

reaper.Undo_EndBlock("Insert TGT post-prod FX chains v2", -1)
reaper.UpdateArrange()
reaper.TrackList_AdjustWindows(false)
