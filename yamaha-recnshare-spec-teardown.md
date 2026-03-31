# Yamaha Rec'n'Share — Full Feature Spec Teardown

**App:** Rec'n'Share by Yamaha Corporation  
**Price:** Free  
**Platforms:** iOS (13.0+), Android (7.0+) — limited Android device compatibility  
**Current Version:** iOS 3.3.2 / Android 3.4  
**Bundle ID:** `jp.co.yamaha.emi.rec_n_share`

---

## What It Actually Is

A companion app for Yamaha instruments that does three things: helps you **practice** songs, **record** performances (audio + video simultaneously), and **share** the results to social media. It connects to Yamaha hardware via USB to capture stereo digital audio directly from the instrument, while simultaneously recording video from the phone camera and playing backing tracks from your music library.

Think of it as a closed-loop practice-record-publish pipeline, locked to Yamaha hardware.

---

## Compatible Hardware

### Full Support (iOS + Android)
| Instrument | Type | Connection |
|---|---|---|
| EAD10 | Electronic Acoustic Drum Module | USB-B to HOST |
| DTX402 Series | Electronic Drum Kits | USB-B to HOST |
| DTX6 Series (DTX-PRO module) | Electronic Drum Kits | USB-B to HOST |
| DTX8 Series | Electronic Drum Kits | USB-B to HOST |
| DTX10 Series | Electronic Drum Kits | USB-B to HOST |

### iOS Only
| Instrument | Type |
|---|---|
| THR-II | Guitar Amp |
| THR30IIA | Acoustic Guitar Amp |
| AG01 | Live Streaming Mixer |
| AG03MK2 | Live Streaming Mixer |

### Confirmed Working (User Reports)
- Yamaha CK-61 (stage keyboard) — worked via standard USB cable on Pixel 7

### Connection Requirements
- **iOS:** Lightning to USB Type-B cable, OR USB-A to USB-B + Apple Camera Connection Kit
- **Android:** USB-C to USB-B cable (newer phones) OR USB Micro-B to USB-B (older phones)
- Module must be OFF when connecting cable, then powered ON before launching app

---

## Feature 1: Music Library & Playback Engine

### What It Does
Imports songs from your device's local music library and plays them back as backing tracks for practice and recording.

### How It Works
- Accesses device media library (requires permission grant on first use)
- Loads audio files, displays waveform visualization
- Plays back through headphones, mixed with instrument audio
- Three real-time mix sliders: **Tempo**, **Click Volume**, **Music Volume**

### Limitations
- **DRM-protected files cannot be used** — this means Apple Music / Spotify downloads won't work, only purchased/owned MP3s or local files
- iCloud-stored music is NOT supported (major pain point in reviews) — files must be downloaded locally
- Max song length: **15 minutes** (expanded in v3.3)

---

## Feature 2: Music Analysis Engine (Tempo Detection + Click)

### What It Does
Analyses imported songs to detect tempo, then generates a click track you can play along to.

### How It Works
1. Song imported → app runs tempo analysis algorithm
2. Generates tempo map across the song's duration
3. Creates metronome click synced to detected tempo
4. Displays BPM value with waveform overlay
5. Provides configurable count-in (1–8 beats, default 4-beat count-in)

### Controls
- **Tempo slider:** Speed up or slow down any song — pitch is preserved (time-stretch algorithm)
- **Click On/Off:** Mute/unmute the generated click
- **Click Down/Upbeat toggle:** Switches click between landing on downbeats or upbeats
- **Analysis Tempo Rate:** If auto-detection gets the BPM wrong, you can re-analyse or manually adjust via the Audio Analysis page (tool icon next to tempo slider)

### Key Technical Detail
The tempo change is pitch-independent. You can slow a 136 BPM song to 80 BPM and it stays in the original key. This is standard time-stretching (likely a phase vocoder or WSOLA implementation), but it's the killer practice feature.

### Limitations
- Tempo detection is not always accurate — users report it frequently gets confused by songs with tempo changes, rubato, or complex rhythmic structures
- No way to manually tap-set the BPM and override the algorithm (major missing feature)
- Click is basic — no accent patterns, no customisable subdivisions

---

## Feature 3: A-B Repeat (Loop Sections)

### What It Does
Lets you loop a specific section of a song for repeated practice.

### How It Works
1. While song is playing, tap AB button → sets loop start point
2. Tap AB again → sets loop end point
3. Song loops that section continuously
4. Tap AB a third time → exits loop mode

### Use Cases
- Learning a tricky fill or passage
- Drilling a specific section at reduced tempo
- Combining with tempo change for slow-motion practice of difficult parts

### Limitations
- Selection is only possible during playback (can't scrub to a point and set markers while paused)
- No saved loop points — you set them fresh each time
- No multiple loop regions

---

## Feature 4: AI Audio Track Separation (Stem Splitting)

### What It Does
Uses AI to split a mixed song into individual instrument stems, allowing you to adjust the volume of each independently.

### How It Works
1. Select a song
2. Choose up to **3 tracks** to separate from a pool of 6 available stems:
   - Vocals
   - Drums
   - Bass
   - Brass
   - Piano
   - Guitar
3. AI processes the song (takes some time depending on length)
4. Returns separated tracks with individual volume controls
5. Mix volumes per-stem — e.g., mute drums to play along as the drummer, boost bass to learn the bass line

### Version History
- **v3.0 (Feb 2023):** Initial release — vocals, drums, bass separation only
- **v3.3 (Dec 2024):** Expanded to 6 stems — added brass, piano, guitar

### Technical Details
- Described as "AI-based" — likely uses a neural network model similar to Demucs, Spleeter, or a proprietary Yamaha implementation
- Processing happens on-device (no cloud dependency mentioned)
- Imperfect separation — Yamaha themselves note "some elements that cannot be fully separated may remain on each track"
- Only 3 stems selectable at a time from the 6 available

### Limitations
- **Usage limits when NOT connected to a compatible instrument** — exact limit unclear, but the feature is throttled without hardware connected. This is a soft lock to encourage hardware sales.
- 3-stem limit per separation pass (can't get all 6 at once)
- Quality depends heavily on the source mix — dense, compressed modern mixes will separate worse than cleanly mixed tracks
- No export of individual stems (separation is for in-app practice/recording only)

---

## Feature 5: Multi-Source Recording

### What It Does
Simultaneously captures three audio/video streams in one recording:
1. **Video** from the phone's camera
2. **Stereo digital audio** from the connected Yamaha instrument (via USB)
3. **Stereo backing track** audio from the music library song

### How It Works
1. From the Practice page, tap "Start Recording"
2. App requests camera + microphone permissions (first time)
3. Pre-record timer counts down (configurable: 3, 5, 10, 15, or 20 seconds)
4. Records all three streams simultaneously
5. On stop: options to Play Back, Delete, or Save to Rec'n'Share library

### Recording Modes
- **With backing track:** Full band recording — your instrument + the song
- **Without backing track:** Solo performance recording — instrument audio + video only
- **Audio only:** Can record without video (no camera access needed)

### Technical Details
- Audio from instrument is **stereo digital** via USB — not captured through the phone mic. This is the key quality differentiator vs. just filming yourself.
- For the EAD10 specifically, the sensor captures the bass drum via trigger + the full kit via two integrated mics, then processes through the module's effects before sending to the app
- Video quality has a "high quality" setting toggle
- Files are saved as **separate audio, video, and metadata files** internally (confirmed by Android users). Must be exported/merged into a single file for sharing.

### Limitations
- **Audio/video sync issues** — the #1 complaint in reviews. The app frequently desyncs audio and video, especially on longer recordings
- **Video quality degradation** — multiple users report significantly worse video quality than native camera, even with high-quality mode enabled. Noise, compression artefacts.
- **Connection drops mid-recording** — the app loses connection to the instrument during recording, causing audio cutouts or static
- **Android OS compatibility** — Android 12 had known issues, Android 13 requires manual settings adjustment. Yamaha acknowledged this and was waiting on Google for a fix.
- No multi-camera support
- No external audio input (mic only through the Yamaha hardware)

---

## Feature 6: Post-Recording Editor

### What It Does
Basic non-destructive editing of recorded performances.

### Editing Tools
1. **Trim:** Adjust start and end points of the recording — cut dead air before/after performance
2. **Volume Balance:** Adjust the mix ratio between your instrument audio and the backing track audio
3. **Time Adjustment:** Correct timing offset between the phone's device audio and the instrument audio (added in a later update to address sync complaints)
4. **Audio/Video Sync Correction:** Adjust discrepancies between video and audio within a certain range

### Key Properties
- **Non-destructive editing** — original recording is preserved, edits can be undone
- No effects processing, no EQ, no compression
- No multi-take compositing
- No visual editing (can't add text, filters, etc.)

---

## Feature 7: Export & Sharing

### What It Does
Exports finished recordings as shareable files and provides direct upload to social platforms.

### Export Targets
- YouTube
- Facebook
- Instagram
- Dropbox
- Email
- Text Message (iMessage / SMS)
- General share sheet (any app that accepts video)

### How Export Works
1. Open "Recorded Songs" library from bottom of Practice screen
2. Select recording
3. Tap upload/share icon
4. Choose destination
5. App merges the separate audio/video/metadata files into a single export file
6. Uploads or shares

### Limitations
- Export merge process takes time and uses significant storage (file exists as both separate components AND merged export)
- Copyright restrictions on shared content — Yamaha notes uploads must be "your own original songs, sound sources, or those licensed from right holders"
- No batch export
- No direct save to camera roll option has been inconsistent (some users report it disappearing)

---

## Feature 8: In-App Help & Connection Guides

### What It Does
Built-in support system for connection troubleshooting.

### Components
- Online connection manuals (iOS and Android specific)
- In-app help function
- Product connection information that updates online
- Separate PDF guides for iPhone/iPad connection and Android connection

---

## Version History (Key Milestones)

| Version | Date | Key Changes |
|---|---|---|
| 1.x | ~2017 | Initial release, iOS only, EAD10 support |
| 2.0 | ~2019 | Android support added, DTX402 compatibility |
| 2.x | 2020-2022 | Help function, connection error handling, crash fixes, Chinese language |
| 3.0 | Late 2022 | **Audio Track Separation** (vocals, drums, bass), UI refresh |
| 3.0.1 | Feb 2023 | Track separation bug fixes |
| 3.1.0 | May 2023 | Improved tempo change, better export, improved video quality |
| 3.2.x | Mid 2023 | iOS 17/18 freeze fix |
| 3.3/3.4 | Dec 2024 | Track separation expanded (brass, piano, guitar), 15-min song limit, Time Adjustment feature |
| 3.3.2 | Jun 2025 | Minor bug fixes |

---

## Known Pain Points (From User Reviews)

These are consistent across hundreds of reviews on both App Store and Google Play:

1. **Connection reliability** — the app constantly drops connection to instruments, crashes on connect, requires full phone restart to re-establish
2. **Audio/video desync** — recordings frequently have misaligned audio and video, sometimes drifting over time
3. **Video quality** — significantly worse than native phone camera, even in high-quality mode
4. **Audio static/cutouts** — random static or complete audio drops during recording
5. **Infrequent updates** — long gaps between meaningful updates, bugs persist for years
6. **Android compatibility** — narrow range of supported devices, OS version conflicts
7. **DRM/iCloud limitations** — most people's music is streaming or cloud-stored, making the music library feature useless
8. **No manual click/tempo override** — if auto-detection is wrong, options are limited

---

## Architecture Summary (Inferred)

```
┌──────────────────────────────────────────────┐
│                 Rec'n'Share App               │
├──────────────┬───────────────┬───────────────┤
│  PRACTICE    │   RECORD      │   LIBRARY     │
│  ENGINE      │   ENGINE      │   & EXPORT    │
├──────────────┼───────────────┼───────────────┤
│ Music Import │ Camera Capture│ Recording DB  │
│ Tempo Detect │ USB Audio In  │ Trim/Balance  │
│ Time-Stretch │ Mix Engine    │ A/V Sync Fix  │
│ Click Gen    │ Backing Track │ Merge Export  │
│ A-B Repeat   │ Pre-roll Timer│ Share Sheet   │
│ Stem Split   │ Sync Engine   │ SNS Upload    │
├──────────────┴───────────────┴───────────────┤
│              USB AUDIO BRIDGE                 │
│        (Yamaha instrument ↔ Phone)            │
│     Stereo digital audio via USB Host         │
├──────────────────────────────────────────────┤
│           DEVICE HARDWARE ACCESS              │
│    Camera · Microphone · Media Library        │
└──────────────────────────────────────────────┘
```

---

## What's Interesting For You (As a Drummer Building Apps)

A few things jump out given your TGT Recorder concept and your work with backing tracks:

1. **The core concept is solid but the execution is famously poor.** The idea of simultaneous multi-source capture (instrument USB audio + camera + backing track) is exactly what gigging/practicing musicians want. Yamaha just can't seem to keep the sync tight or the connection stable.

2. **The stem separation is the modern killer feature** — being able to mute the drums on any song and play along is exactly what drum deputies need for learning setlists fast. But it's locked behind Yamaha hardware and limited to 3 stems at a time.

3. **The time-stretch practice tool (slow down songs without pitch change)** is genuinely useful and something any practice app should have. Combined with A-B looping, it covers the core practice workflow.

4. **File handling is clunky** — saving as separate audio/video/metadata files then requiring a merge step for export is poor UX. A well-designed alternative would handle this transparently.

5. **The DRM/streaming music problem is unsolved** — since most people's music is on Spotify/Apple Music, requiring locally-owned DRM-free files cuts out the majority of use cases. This is a legal/licensing issue more than a technical one.

6. **The hardware lock-in is both a strength and a weakness** — USB digital audio is objectively better quality than phone mic recording, but tying the app's core features to specific Yamaha products limits the addressable market dramatically.
