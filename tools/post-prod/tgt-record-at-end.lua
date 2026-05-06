-- TGT: Record at project end
-- Manual fallback for the APK orchestrator. Moves the edit cursor to the end
-- of the project, then arms record. Use when the APK is unavailable to
-- guarantee per-set takes don't overwrite previous takes (S119 lock).
--
-- The APK orchestrator no longer relies on this script — it sends an OSC
-- bundle of /action/40043 (cursor-to-end) + /action/1013 (record) which
-- Reaper processes atomically on a single tick. This script remains as a
-- belt-and-braces option Nathan can run from the Action List if the APK
-- is ever unavailable.
--
-- Deploy: scp this file to ~/.config/REAPER/Scripts/ on the E6330, then
-- import via Reaper Action List → "ReaScript: Load..." (one-off, ID is
-- preserved in reaper-kb.ini afterwards).
reaper.Main_OnCommand(40043, 0)  -- View: Move edit cursor to end of project
reaper.Main_OnCommand(1013, 0)   -- Transport: Record
