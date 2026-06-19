-- TGT post-prod FX chain installer (v3 — per-channel + bus + MIX BUS + master)
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
--
-- ── v3 (S222): MIX BUS topology + capture-aware polish ───────────────────────
-- TOPOLOGY: the 4 performance buses (TD-4 / VOX / EAD / DRUMS) now feed a MIX BUS
--   (DC1A3 glue -> TDR Kotelnikov mix-comp) before a SLIM master. MUSIC BUS stays
--   DIRECT to master (pre-mastered; glue there would pump against the vox).
--   Kotelnikov MOVED off the master onto the MIX BUS — mirrors the take-mode
--   BALANCE BUS. A serial master+mixbus Kotelnikov would over-squash, so MAIN
--   actively removes a stale master Kotelnikov (idempotent) before re-adding the
--   master chain. The MIX BUS *track* lives in the TEMPLATE — this script does NOT
--   create the track, but (S222b) it DOES idempotently wire the 4 buses INTO MIX BUS
--   (post-fader/unity sends + master send off) when the track exists, so a `run the lua`
--   fully wires FX *and* routing. Missing-track case still warns (see MAIN).
-- CAPTURE-AWARE (gig = live capture; goal is to ENHANCE the real live feel, never
--   over-process into a sterile studio sound — when in doubt, lighter):
--   * 05 Adam Guitar = SM58 on a mic'd amp -> signal is ALREADY amplified. NO amp-sim.
--       Tame the MIC, not the tone: HPF ~90-100Hz (proximity boom), optional
--       -2..3dB bell @4-6kHz (SM58 presence peak, only if it bites), light comp ~2:1.
--   * 06 Neil Bass = DI -> clean, un-amped, no live grit of its own. The chain must
--       SUPPLY body + grind: HPF ~40Hz, cab-style LPF ~5-6kHz, ReaXcomp to control
--       low-vs-mid, and PUSH IVGI2 for amp-like harmonics/saturation.
--   * 12-14 Toms now carry TDR Nova (dynamic resonance taming) — open tom mics ring
--       more live; parity with the snare/OH Nova. Set a dynamic band on the tom's
--       ring freq (~250-500Hz), not a high-shelf de-ess.

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

  -- Guitar (standalone) — SM58-mic'd amp (ALREADY amplified -> NO amp-sim).
  -- Tame the mic, not the tone. See v3 capture notes in the header.
  ["05 Adam Guitar"] = {
    {"ReaEQ"}, {"ReaComp"}, {"ReaEQ"},                    -- HPF ~90-100Hz + presence-peak tame, light comp, tone
  },

  -- Bass (standalone) — DI (no live amp tone): supply body + grind. Push IVGI2.
  -- See v3 capture notes in the header.
  ["06 Neil Bass"] = {
    {"ReaEQ"}, {"ReaComp"}, {"ReaXComp"},                 -- HPF ~40Hz + cab LPF ~5-6kHz, peak comp, multiband
    {"IVGI2", "IVGI", "Klanghelm IVGI"},                  -- amp-like harmonics/grit (a DI has none) -- PUSH this
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

  -- Toms — tight gate (cymbal bleed!) + comp + dynamic ring tame (Nova, S222)
  ["12 Tom 1"] = { {"ReaEQ"}, {"ReaGate"}, {"ReaComp"}, {"TDR Nova"} },
  ["13 Tom 2"] = { {"ReaEQ"}, {"ReaGate"}, {"ReaComp"}, {"TDR Nova"} },
  ["14 Tom 3"] = { {"ReaEQ"}, {"ReaGate"}, {"ReaComp"}, {"TDR Nova"} },

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

  -- Acoustic kit bus: glue + transient punch
  ["DRUMS BUS"] = {
    {"DC1A", "DC1A3", "DC1A 3", "Klanghelm DC1A"},        -- glue
    {"Flash", "Flash (Wavesfactory)"},                    -- transient PUNCH (S222): a proper transient
                                                          -- shaper (ATTACK/SUSTAIN), mirrors the take-mode
                                                          -- DRUMS BUS. Confirmed loadable on the Acer rig
                                                          -- (Reaper VST cache 2026-06-16; also proven live
                                                          -- by the take-mode covers). FALLBACK: if Flash
                                                          -- ever won't load, use parallel {"ReaComp"} (Wet
                                                          -- ~30%) for the punch slot instead.
                                                          -- (Slot history: {"TENSjr"} pre-S210 was wrong --
                                                          -- TENSjr is a spring REVERB; {"ReaComp"} S210; Flash S222.)
  },

  -- MIX BUS (S222): the mirror of take-mode's BALANCE BUS. The 4 performance buses
  -- (TD-4 / VOX / EAD / DRUMS) feed this; it sums + glues before the slim master.
  -- This track lives in the TEMPLATE (whole-gig-template-v1.RPP) and is NOT created
  -- by this script -- a from-scratch build must add a track named exactly "MIX BUS",
  -- turn master/parent send OFF on those 4 buses + add a post-fader send into MIX BUS,
  -- and turn MIX BUS master send ON (MUSIC BUS stays direct). See the guard in MAIN.
  ["MIX BUS"] = {
    {"DC1A", "DC1A3", "DC1A 3", "Klanghelm DC1A"},        -- gentle glue (aim ~1-2dB GR)
    {"TDR Kotelnikov", "Kotelnikov"},                     -- transparent mix-bus comp
    -- OPTIONAL colour: the template bakes an IVGI2 here BYPASSED -- a dial to reach
    -- for, off by default to retain the live feel. Deliberately NOT in this table so a
    -- from-scratch run doesn't add it ACTIVE; add + bypass by hand if you want it.
    -- {"IVGI2", "IVGI", "Klanghelm IVGI"},
  },
}

-- ============================================================================
-- MASTER CHAIN — mix-stage tone + mastering compression + true-peak limiting
-- ============================================================================
local MASTER_CHAIN = {
  {"SPAN", "Voxengo SPAN"},                               -- pre-meter
  {"TDR VOS SlickEQ", "VOS SlickEQ", "SlickEQ"},          -- broad tone + saturation
  {"TDR Nova"},                                           -- dynamic EQ for problem zones
  -- TDR Kotelnikov REMOVED here (S222): moved to the MIX BUS as the mix-bus comp.
  -- A serial master+mixbus Kotelnikov would over-squash. MAIN actively removes a
  -- stale master Kotelnikov first (idempotent) if an old baked project still has one.
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

-- S222: actively REMOVE every FX on `tr` whose display name matches ANY candidate.
-- Idempotent: deletes the stale plugin if present, no-op (removed=0) once it's gone.
-- Used to pull a stale TDR Kotelnikov off the master (it moved to the MIX BUS in v3).
-- Iterate HIGH->LOW so deleting one FX doesn't shift the indices still to be checked.
local function remove_fx_matching(tr, candidates, label)
  local removed = 0
  for i = reaper.TrackFX_GetCount(tr) - 1, 0, -1 do
    local _, fxname = reaper.TrackFX_GetFXName(tr, i, "")
    local lname = fxname:lower()
    for _, cand in ipairs(candidates) do
      if lname:find(cand:lower(), 1, true) then
        reaper.TrackFX_Delete(tr, i)
        removed = removed + 1
        break
      end
    end
  end
  reaper.ShowConsoleMsg(string.format("  %-25s  removed=%d\n", label, removed))
  return removed
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

-- S222b: does `src` already have a category-0 send whose DESTINATION track is named `destname`?
-- Destination-aware on purpose: TD-4/EAD/DRUMS BUS ALSO feed STEM-PREP DRUM SUM (a solo-only tap),
-- so we must NOT use the "remove all sends" idiom (gig-command-listener take_route_to_bus) here --
-- that would kill the tap. We only ever ADD a MIX BUS send if one is missing.
local function bus_has_send_to(src, destname)
  for j = 0, reaper.GetTrackNumSends(src, 0) - 1 do
    local dest = reaper.GetTrackSendInfo_Value(src, 0, j, "P_DESTTRACK")
    if dest and reaper.ValidatePtr2(0, dest, "MediaTrack*") then
      local _, nm = reaper.GetTrackName(dest)
      if nm == destname then return true end
    end
  end
  return false
end

-- S222b: idempotently route the 4 performance buses INTO MIX BUS (post-fader, unity) and take them
-- off the master. Mirrors the routing baked into whole-gig-template-v1.RPP, so "run the lua" fully
-- wires FX *and* routing -- closing the orphaned-bus class of bug for from-scratch / recovered projects.
-- Re-running adds nothing (send already present -> skip; B_MAINSEND already 0/1 -> no-op).
local function wire_mixbus_routing(mixbus)
  reaper.ShowConsoleMsg("\n--- MIX BUS ROUTING (S222b) ---\n")
  for _, nm in ipairs({"TD-4 BUS", "VOX BUS", "EAD BUS", "DRUMS BUS"}) do
    local src = nil
    for i = 0, reaper.CountTracks(0) - 1 do
      local tr = reaper.GetTrack(0, i)
      if track_name(tr) == nm then src = tr; break end
    end
    if not src then
      reaper.ShowConsoleMsg(string.format("  %-22s  (track not found -- skipped)\n", nm))
    else
      local present = bus_has_send_to(src, "MIX BUS")
      if not present then
        local s = reaper.CreateTrackSend(src, mixbus)
        reaper.SetTrackSendInfo_Value(src, 0, s, "I_SENDMODE", 0)   -- 0 = post-fader (post-pan)
        reaper.SetTrackSendInfo_Value(src, 0, s, "D_VOL", 1.0)      -- unity (0 dB)
      end
      reaper.SetMediaTrackInfo_Value(src, "B_MAINSEND", 0)          -- master/parent send OFF (idempotent)
      reaper.ShowConsoleMsg(string.format("  %-22s  send->MIX BUS=%-15s master-send=OFF\n",
        nm, present and "already-present" or "ADDED"))
    end
  end
  reaper.SetMediaTrackInfo_Value(mixbus, "B_MAINSEND", 1)           -- MIX BUS -> master ON (idempotent)
  reaper.ShowConsoleMsg("  MIX BUS                 master-send=ON\n")
end

-- ============================================================================
-- MAIN
-- ============================================================================
reaper.Undo_BeginBlock()
reaper.ClearConsole()
reaper.ShowConsoleMsg("=== TGT post-prod FX chain installer (v3 — MIX BUS topology, S222) ===\n")
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
local mixbus_track = nil
for i = 0, n - 1 do
  local tr = reaper.GetTrack(0, i)
  local name = track_name(tr)
  if name == "MIX BUS" then mixbus_track = tr end
  local chain = BUS_CHAINS[name]
  if chain and not seen_buses[name] then
    seen_buses[name] = true
    add_chain(tr, chain, name)
  end
end

-- S222/S222b MIX BUS: the v3 topology routes TD-4/VOX/EAD/DRUMS THROUGH a MIX BUS before
-- the master. The MIX BUS *track* lives in the template, NOT in this script. If it exists,
-- idempotently wire the 4 buses into it (S222b -- so the lua fully wires routing too, not
-- just FX). If it's missing (e.g. a from-scratch build), warn loudly instead of silent-skip.
if mixbus_track then
  wire_mixbus_routing(mixbus_track)
else
  reaper.ShowConsoleMsg("\n  *** WARNING: no track named 'MIX BUS' found. ***\n")
  reaper.ShowConsoleMsg("  v3 routes the TD-4/VOX/EAD/DRUMS buses THROUGH a MIX BUS before master.\n")
  reaper.ShowConsoleMsg("  This script does NOT create the track (structure lives in whole-gig-template-v1.RPP).\n")
  reaper.ShowConsoleMsg("  From scratch: add a track named exactly 'MIX BUS', then re-run -- the script\n")
  reaper.ShowConsoleMsg("  will wire the 4 buses into it (master send off on them, on for MIX BUS).\n")
  reaper.ShowConsoleMsg("  (MUSIC BUS stays direct to master.)\n")
end

reaper.ShowConsoleMsg("\n--- MASTER ---\n")
local master = reaper.GetMasterTrack(0)
remove_fx_matching(master, {"TDR Kotelnikov", "Kotelnikov"}, "MASTER (de-Kotelnikov)")  -- S222: moved to MIX BUS
add_chain(master, MASTER_CHAIN, "MASTER")

reaper.ShowConsoleMsg("\nDone.\n")
reaper.ShowConsoleMsg("\nNext steps:\n")
reaper.ShowConsoleMsg("  1. Ctrl+S to save FX chains into the project\n")
reaper.ShowConsoleMsg("  2. Dial in per-channel params (see header of this script)\n")
reaper.ShowConsoleMsg("  3. On VOX BUS, set Valhalla Supermassive Mix knob to ~20%\n")
reaper.ShowConsoleMsg("  4. On EAD BUS, set ReaComp Wet to ~30% (parallel comp)\n")
reaper.ShowConsoleMsg("  5. JAMES VOX (Ch 3): the 2nd comp (MJUCjr) is the LEVELER for\n")
reaper.ShowConsoleMsg("     his distance/volume issue. Set MJUCjr 'comp' to ~30%, recovery slow.\n")
reaper.ShowConsoleMsg("     ReaComp before it: thr -18dB, ratio 3:1 (~3-5dB GR).\n")
reaper.ShowConsoleMsg("  6. MIX BUS (S222): DC1A3 gentle glue (~1-2dB GR) -> Kotelnikov mix-comp\n")
reaper.ShowConsoleMsg("     (transparent, low ratio). IVGI2 is baked BYPASSED -- enable only if you\n")
reaper.ShowConsoleMsg("     want a touch of console colour.\n")
reaper.ShowConsoleMsg("  7. DRUMS BUS Flash (S222): dial ATTACK up for kit punch; SUSTAIN to taste.\n")
reaper.ShowConsoleMsg("  8. Toms 12-14 Nova (S222): set a dynamic band on the ring freq (~250-500Hz).\n")

reaper.Undo_EndBlock("Insert TGT post-prod FX chains v3 (S222)", -1)
reaper.UpdateArrange()
reaper.TrackList_AdjustWindows(false)
