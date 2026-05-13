-- TGT post-prod FX chain installer (v2 — per-channel + bus + master)
--
-- Walks the open project, matches tracks by NAME, inserts:
--   - PER-CHANNEL chains (HPF/gate/comp surgical work) per the locked plan
--   - BUS chains (glue + colour)
--   - MASTER mastering chain
--
-- Idempotent: TrackFX_AddByName with instantiate=-1 only adds a plugin if it's
-- not already on the track, so re-running is safe (won't create duplicates).
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

  -- Acoustic kit bus: glue + tape softening
  ["DRUMS BUS"] = {
    {"DC1A", "DC1A3", "DC1A 3", "Klanghelm DC1A"},        -- glue
    {"TENSjr", "TENS jr"},                                -- tape saturation
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

local function add_fx_first_match(tr, candidates)
  for _, name in ipairs(candidates) do
    local idx = reaper.TrackFX_AddByName(tr, name, false, -1)
    if idx >= 0 then return idx, name end
  end
  return -1, nil
end

local function add_chain(tr, chain, label)
  local added, skipped, missing = 0, 0, {}
  for _, candidates in ipairs(chain) do
    local before = reaper.TrackFX_GetCount(tr)
    local idx, _ = add_fx_first_match(tr, candidates)
    if idx >= 0 then
      local after = reaper.TrackFX_GetCount(tr)
      if after > before then
        added = added + 1
      else
        skipped = skipped + 1
      end
    else
      table.insert(missing, candidates[1])
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
