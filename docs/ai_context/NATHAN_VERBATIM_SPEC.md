# Nathan's Verbatim Design Instructions

> **What this is**: Nathan's EXACT words extracted from conversation transcripts (.jsonl files).
> Every quote below is copy-pasted from a real user message. NO AI interpretation.
> If a detail isn't here, it wasn't said — don't invent it.
>
> **Why this exists**: FEATURE_SPEC_MASTER.md was compiled by an AI session that
> "went rogue" and produced AI-interpreted summaries. This document is the antidote.
>
> **How to use**: Search this file FIRST for any UI element before implementing.
> The mockup (`mockups/v4-mirror-target.html`) is the visual target, but these quotes
> provide the intent and follow-up detail the mockup can't capture.
>
> Compiled: 2026-03-10 from 433 .jsonl transcript files.
> Verified: 2026-03-10 — Nathan yes/no'd every item with clarifications noted inline.

---

## CONFIRMED CLARIFICATIONS (2026-03-10)
> 1. **Calendar dots take up room** — no dots needed. Venue text is the indicator.
> 2. **Current webapp is the benchmark** for calendar cell styling (not "dark inset rectangle" from old native era).
> 3. **Two day views exist, need consolidating to 1** — the first one is better.
> 4. **Nothing gets parked** — mentioned features get reminded later for further speccing, NOT shelved.
> 5. **Dep gig diagonal split** — ready to spec now.
> 6. **Live/Practice/View are FULLSCREEN modes** — NO side drawer visible. User must exit the mode. Only the bottom sheet drawer exists in these modes, hidden until opened.

---

## 1. CALENDAR

### Venue names on calendar cells
> "please look at the last 2 screenshots taken on my phone, and the last one taken on my pc. are we able to better fill the screen with the calendar? possibly even making room for the venue names to appear on the calander grids, (even if it has to cut the name short) one screenshot is timetree app that we are currently using, i hate it but it does kind of fill the screen and display gig venues at a glance.. apart from that our app is much better"

### One word per line (THE key follow-up)
> "ah it looks great now, it looks like we could fit each word on a line (cutting off the end of each word if needed)
> Gin
> &
> Juic.
>
> New
> Forre
>
> for eg"

### PC doesn't need truncation
> "pc wont theed that, they fit perfect"

### Final word on PC calendar
> "scratch that do what you need too. pc will look how it looks its fine"

### Dark inset rectangle cells
> "Dark inset rectangle calendar cells in native 2?"

### Calendar as landing screen
> "calendar being everyones main landing screen"

### Timetree replacement standard
> "ok its working, lets do a fit for purpose and usability audit on both apps i will be using gig books the boys will be using webapp. i have more plans for new features to both apps but i want what we've got to be perfect first.. this needs to be good enough replacement for using timetree"

### Dep gig diagonal split colors (READY TO SPEC — confirmed 2026-03-10)
> "thinking about that the band is unavailable for a gig when one member is away but each other member may be available for a dep gig. we need another colour (i think it would be cool to diagonally split the red member away grid with another colour (yellow maybe for now) for days other members have a stand in gig with another band (this needs further planning i think)"
> **Nathan confirmed ready to spec now — nothing gets parked.**

### Android back button
> "my android back button just closes the app everytime i press it.. can we make it just navigate back 1 step like the apps back button? and clollapse drawers etc, if im looking at a day view the app closes when i prass my built in back button, it should just close the day view and show calander again"

### Day detail swipe navigation
> "when we tap a date that has a gig, practice or away it bring up a cool drawer with the details. i realy like that but it would be cool if swiping left and right cycles to the prev or next gig, practice or away date"

### Visually identical apps — calendar must match
> "please do a surgical 'does everything work' audit.. and also 'do they look like the same app'? what are the visual differences? they need to be visually identical, same headings same colours same glows same visual style completely"

---

## 2. NAVIGATION / DRAWER

### Collapsible drawer for both apps
> "will the side menu be like a collapsable drawer on the webapp? i quite like that idea and it looks like that layout allows for more options rather than tabs, so lets do it for both apps so they look fairly similar also"

### Web drawer items (S19 sprint prompt, Nathan's words)
> "Web: Replace button-based main-actions with collapsible sidebar/drawer. Items: Dashboard, Calendar, Gig List, Invoices, Quotes, Clients, Away Dates, Media, Enquiries, Website, Settings, Profile. Hamburger on mobile, collapsible sidebar on desktop."

### Native drawer (S19 sprint prompt, Nathan's words)
> "Native: Replace (tabs)/_layout.tsx tab navigation with drawer navigation. Same nav items as web. Neumorphic drawer styling."

### App guide in sidebar
> "Can we build an animated interactive first time use slideshow / animated tutorial style instructions that explain the app and all its features and how to use them. Place it in the sidebar below website please, users should be able to run it whenever they need too"

### Android back button should collapse drawers
> "my android back button just closes the app everytime i press it.. can we make it just navigate back 1 step like the apps back button? and clollapse drawers etc"

---

## 3. PLAYER — LAYOUT & BOTTOM SHEET DRAWER

### Mixer in drawer, NOT permanently visible
> "ok, the mixer isnt in a drawer, transport bottom of screen, im not fussed on the 4 dots, i like screen flash with edge glow."
> *(then corrected):*
> "ok its better, we dont need full screen wave form, it would look better if iwas as tall as the mixer is now, in plkace of the mixer, and the mixer goes in the drawer plz, not perminantly visible"

### Drawer drags up from bottom, shrinks visuals
> "ok, the drawer yes thats better, the drawer should drag up from the bottom shrinking the size of the visuals area and moving the transport up so the drawer is displayed below the transport"

### Visuals center when drawer opens
> "ok their great, i may add some more later, but im happy with those for now. altho when the drawer is open the centre of the visuals needs to move up (and shrink down) so that it fills the visual screen and is properly centred"

### Display toggles in drawer
> "again superb.. how to we select what cards are in view and what their displaying? the drawer sounds the logical option so keep everything nice and clean? what do you think?"

### Player preferences live in drawer (D-118)
> "Player Preferences Toggle which features are visible in the player. Saved per-user. = lives in the drawer, double check i did mention it"

### 2-storey transport
> "we need a, b and clear in the full screen view (with drawer collapsed) i think we need a 2 storey transport, with controls at bottom and speed and section controls on the top layer."

### Stop behavior
> "if i press stop when no loop is selected, does the track stop and start again from the begining?
> if loop is selected and i press stop, does it stop at the begining of the lopp so pressing play will start from the begining of loop?"

---

## 4. PLAYER — MODES

### Songs, setlists, live mode, practice mode (full definition)
> "songs = tange covers, tange originals, personal songs each member knows
> setlists = tange setlists. other bands set lists that any member knows (for standing in)
>
> live mode = 1. play entire library of songs start to finish with prev / next buttons, and swipe in full list to select next song.
> 2. play a filtered full list of songs (tange covers, tange originals, personal songs sorted by members or all)
> 3. play full setlist from start to finish (choose from available set lists)
> with or without audible click and flash visuals set from the songs bpm (from set track analysis + user prefered speed of playback app must check with user that they havent forgot to speed it back up after practicing the song or if they want to play it at their adjusted speed if different to the analysys bpm rate)
> without any backing tracks
>
> practice mode = 1. play entire library of songs start to finish with prev / next buttons, and swipe in full list to select next song.
> 2. play a filtered full list of songs (tange covers, tange originals, personal songs sorted by members or all)
> 3. play full setlist from start to finish (choose from available set lists)
> with or without audible click and flash visuals set from the songs bpm
> with the backing tracks"

### View mode
> "sorry one last thing.. we need just a simple view mode with the same media styling as our live and practice mode with each users video best take playing in the visuals screeen stem mixer in the drawer like other views"
> "remember to consider everything thats been discussed already.. video is local"

### Web gets Live + Practice modes too
> "ok cool it sounds good, how will this affect both tange apps? can we add the live and practice mode to the webapp the same way (built to its limits / restrictions) but basically making them 2 of the same apps again (native still wont have pdf) but apart from that virtually identical?"

### Stage prompter for standing in
> "yeah b sounds better at first glance but when you mention remove the click and flash (with the other members rarely using it anyway) it becomes more of a back up handy stage prompter for them to play other bands songs live when standing in for them (lyrics / chords etc)"

### Between-songs and set complete
> "just 1 set per gig. we're not going to be that thorough.. player needs to just wait til next song is selected."
> "yes a complete screen with options 'restart' 'go home' etc"

### Queue
> "S37 Web player UI (React component, Live + Practice modes, queue overlay, set complete, prefs toggles, wake lock, waveform) Blocked on S36"

---

## 5. PLAYER — VISUALS & EFFECTS

### Beat glow / edge flash (initial idea)
> "also can we have a look what it would look like if: if we have visuals on, and other cards in view notes or drum notation. every card visible has edge flash, the transport has edge flash or possible the whole screen has the edge flash that spills niceley behind everything so even tho only the edges a flashing the whole screen glows nicely, do you get what i mean?"

### Edge glow — revert to card glow, but keep BOTH options for testing
> "design = perfect, edge glow = lets revert back to the visual card glowing. is that all we changed?"
> "oh no, i thought this might happen, it doesnt look as good as it did before we changed it to full screen edge glow. t needs to be exactly like it was before we changed it"
> "no!!! we broke the live mode by making it full screen edge glow. i want to revert the live mode back to card edge glow like the practice mock up. WE DONT WANT FULL SCREEN EDGE GLOW"
> **BUT THEN:**
> "PERFECT. plz save these designs so we cant loose or break them.. i still want to try full screen edge glow on the actual mobile device after ive tested the card edge glow, but i want to be able to smoothly switch between them both at testing stage without breaking anything"
> **VERDICT: Card edge glow is default. Full-screen edge glow preserved as toggle option for device testing.**

### Screen flash preference (early)
> "ok, the mixer isnt in a drawer, transport bottom of screen, im not fussed on the 4 dots, i like screen flash with edge glow."

### Chords, lyrics, notes, drum notation
> "ooh that looks suberb!! we have chords, lrycs, both off. does off move that card out of the way, leaving just full screen visuals? similarly, if visuals are turned off, does that card move, leaving full screen chords / lyrics / both card?
> along with chords and lyrics, can we add notes and drum notation?
> these chords / notation / lyrics prompts do not need to be synced to the music in any way for live or practice realy, user will type what they want to see for each and they will just be static visual references, does this make sense?"

---

## 6. RECORDING

### Recording UI in player style
> "i feel like recording in progress could look like live and preview mode also, with input and selfie options tucked in the drawer. live input level filling the visual screen in our visual style (unified app styling) when video is off
> when video is on the visual should be like a stamp over the video preview not full screen but still nice and prominent, placed cleverly so it looks realy pro and cool"

### Recording settings in drawer
> "1. user sets requirements via mixer drawer?
> 2. yes
> 3. user defined via drawer?
> 4.yes plz
> 5. perfect"

---

## 7. LIBRARY — STRUCTURE

### One screen, two tabs
> "sounds perfect.. i think it would look better all on one screen 2 main tabs for songs and setlist, filters for each. is that what you were thinking? or something else?"

### Categories
> "songs needs a catagory : The Green Tangerine / Personal
> subcatagories: tgt = covers / original
> personal = users own uploaded covers / users own uploaded original (personal to whatever user uploaded it) every other users uploaded cover / every other users uploaded original if its been shared with other members (user might not want all other users involved so choose to only share with 1 or 2 other members)
>
> does this make sense? all users can use the practice tool on webapp so with their own mp3s they should have the same abilites as me for adding songs and managing the practice tracks attatched. we need to protect them somehow from other users accidentaly mismanaging other users tracks"

### Dropdowns over pills
> "sub catagories to cover all options if theres 2 subcatagories for every user thats fine.. i think drop downs might work better (less scruffy)?"

### Consolidate songs + setlists
> "remove prompter from webapp
> consolodate the set lists and songs list into one screen so we toggle between the full song list and set lists built from the master song list..
> new app feeds from these lists. songs should be able to be played from any set list or from the master list"

### Library stays local (cache management)
> "yes users need a way to manage how much of the library stays local to their device and options to clear select ammounts of local cache when space is an issue"

### Re-order setlists
> "yes re- order from the list?"

### Both apps mirror — library must match
> "show me how every single relevant screen would look if we continued from that mix up as mirror apps.."

---

## 8. SETTINGS

### Metronome settings hidden from non-Nathan members
> "no other member needs to know about the metronome settings part of the songs so dont show that to them when their editing songs, we could probably use chord information and lyrics adding in. have we missed anything?"

### Review links in settings
> "in stead of 'me' or 'lp' etc for reviewer names, could we use our logo with the transparent background, with a nice edge glow also, we want to be able to backup each one of reviews, tapping a review should offer to link to the original review on facebook in a seperate window(dont navigate away from our app so tell users its an external link do they want to open), so we should be able to add the original review link in the settings page (their all facebook at the moment, but they may come from other sources over time)"

---

## 9. STAGE PROMPTER

### Web-only, shows lyrics
> "yes a stage prompter would be perfect for the webapp, it could show lyrics as well yes.."

### Song list sidebar
> "Song list sidebar (collapsible) for quick jump"

---

## 10. CAPTURE → IMPORT PIPELINE

### All 3 apps connected
> "yes, all 3 apps are connected.. capture feeds webapp with practice material i want to add an import feature or a way for tgt timetree thats running on same machine as the capture server can pull song from that server directly, using the meta data gathered from that app to properly catalogue the song in its correct place (tange cover / original / personal/ other bands set list etc) so the capture app needs the same meta fields for clean import. it doesnt appear to be functioning properly either atm but it appears it was built out of scope of these other 2 live apps.."

---

## 11. RESPONSIVE DESIGN

### Screen size range
> "they both look great, it looks like we're going to need a proper layout to acount for all the different screen sizes that will be using the app and viewing the website.. we need to asccount for the oldest iphone that timetree would have supported right up to the top spec iphones and i may use either app on my samsung s23 ultra. tabs / windows desktop upto 1920"

---

## 12. INVOICING

### Invoice from day view
> "sounds great, so 'Prefill venue from gig if navigating from a gig' would that mean we can invoice from the day view 'gig' screen?"

### Categories as dropdowns
> "invoices : group the catagories (all, draft, sent, paid) into a drup down list the same as the sorting list plz
> quotes : group the catagories (all, draft, sent, paid) into a drup down list the same as the sorting list plz"

---

## 13. HARDWARE CONTEXT (for audio design)

### EAD-10 for practice, XR18 for live
> Nathan uses Yamaha EAD-10 for home practice, Behringer XR18 mixer for live gigs. Never used simultaneously. The audio engine must support USB audio interfaces via device enumeration.

---

## 14. THE MIRROR APPS RULE

### Both apps must be identical
> "please do a surgical 'does everything work' audit.. and also 'do they look like the same app'? what are the visual differences? they need to be visually identical, same headings same colours same glows same visual style completely"

### Nathan's frustration about this being ignored
> "you are literally going to have to retrace your steps, look at the drawer, look at every instruction i gave reguarting it. what should it look like? what should be in it? i refuse to tell you again honestly this is exhausting.. then you do the same for every single thing on the app what did i say about it consider i ment both apps you got the 'both apps' bit wrong not me"

---

## 15. OVERALL VISION

### GigBooks origin
> "i dont know, i was kind of building click track as the research app to intigrate into this. and then improve click track for spacific sticking and hand foot co ordination practice.. gig books would be my full live and management tool. i could rebrand if i changed to a different band, but i'll never not need a band manager and click and setlist in one"

### Rec'n'Share as reference
> "did we consider how rec n share and possibly other apps lock the click tracks to the songs? we need to cover all the angles they cover. but purpose built to my band :)"

### Unified theme
> "this sounds like a plan, and a reason for a bit of a design overhaul to both apps to accomodate all the changes.. maybe a more unified theme and look making it basically one app 'Tangerine Timetree'"
