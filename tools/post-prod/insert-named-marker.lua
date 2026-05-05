-- TGT named song marker insert (manual, hotkey-driven)
--
-- Usage:
--   1. Actions > Load > pick this file
--   2. Right-click in action list > "Add to keymap" > assign a hotkey (e.g. M)
--   3. During playback or with edit cursor positioned, hit the hotkey
--   4. Type the song name in the prompt
--   5. Marker drops at play position (or edit cursor if stopped)
--
-- The marker is colored TGT orange so it's easy to spot vs Reaper's default
-- blue markers (which our auto-generated set-boundary markers use teal).
--
-- For LIVE GIG drummer-prompter integration, see song-marker-listener.lua —
-- that variant polls a directory for marker requests so the APK prompter
-- can drop markers automatically when songs are selected.

local retval, name = reaper.GetUserInputs("Insert song marker", 1, "Song name (or blank for default):,extrawidth=200", "")
if not retval then return end
if name == "" then name = "Song" end

local pos
if reaper.GetPlayState() & 1 == 1 then       -- playing or recording
  pos = reaper.GetPlayPosition()
else
  pos = reaper.GetCursorPosition()
end

reaper.Undo_BeginBlock()
-- AddProjectMarker2(proj, isrgn, pos, rgnend, name, wantidx, color)
-- Color format: 0x01_BBGGRR (TGT orange #f39c12 = BGR 0x129cf3, +0x01000000 for "use this color")
reaper.AddProjectMarker2(0, false, pos, 0, name, -1, 0x01129cf3)
reaper.UpdateArrange()
reaper.Undo_EndBlock("Insert song marker: " .. name, -1)
