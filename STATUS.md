# TGT (The Green Tangerine) — Status

**Version:** 1.0.0 (monorepo) / Android 1.0.0 / Web 0.0.0 / Capture local
**Status:** Live
**Platform:** Android (Kotlin/Compose) + Web PWA (React/Vite) + Capture (FastAPI/React)
**Last updated:** 2026-03-30

## What Works
- Android: Calendar, songs, setlists, live mode, practice mode with C++ Oboe audio engine
- Web: Full band management PWA at thegreentangerine.com (Vercel) with dark neumorphic UI
- Web: Invoice, receipt, quote, formal invoice PDF generation (28 templates, print-ready)
- Web: Audio stems playback, mixer, beat-synced visuals via Web Audio API
- Web: Gig Day unified view with accordion gig cards and pipeline tracker
- Capture: WASAPI loopback and Chrome extension audio capture, BPM/key analysis, MP3 encoding
- Cloud Run: beat-analysis service (madmom beats + Demucs stems)
- Supabase: 26 tables, 4 storage buckets, shared across all sub-apps
- Shared types, queries, config, and PDF templates via shared/ directory

## Known Issues
- Drift correction needs re-enabling with ~93ms latency compensation
- Web missing set-complete modal (Android has it)
- Web missing waveform strip with loop region (Android has it)

## Next
- Drift correction re-enable with resyncToPosition
- UX tweaks from Nathan's testing of deployed Gig Day view
- Evaluate FFT necessity for visualizations
- Web waveform strip and set-complete modal parity with Android
