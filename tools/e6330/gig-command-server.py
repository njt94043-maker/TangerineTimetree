#!/usr/bin/env python3
"""
TGT gig-command HTTP daemon (E6330).

Receives gig-state commands from the APK orchestrator over the S23 hotspot LAN
and drops them as JSON files into /tmp/gig-commands/ for the Reaper-side Lua
listener (gig-command-listener.lua) to pick up and process.

Why HTTP not OSC: Reaper's OSC bindings are wired to numeric Reaper actions,
not arbitrary Lua scripts that take string args (project name). The S128
song-marker-listener.lua established the file-poll pattern as the bridge — this
daemon is the network-receive side of that same pattern, extended to gig-level
state changes (start / save / stop) instead of just markers.

S146: GET /gigs added to enumerate ~/Reaper/Gigs/ for the Media Server PWA's
Gigs browser surface (B-D2 brain-dump item; brief at
specs/tgt/s145-postprod-import-flow-brief.md). Each entry reports the gig
date, RPP path, raw WAV count, total media size, and modified timestamp.
This is read-only and authless — same trust model as the rest of this daemon
(rig LAN trusted, port not exposed beyond hotspot).

Endpoints:
    POST /gig
    Content-Type: application/json
    Body: {"action": "start" | "save" | "stop", "project_name": "<gig name>"}

    POST /song-marker         (S128 follow-up; closes the gap where APK was
                               firing OSC /song_marker but the listener was
                               polling a file directory)
    Content-Type: application/json
    Body: {"title": "<song title>"}

    GET /gigs                 (S146 — enumeration for MS PWA Gigs browser)
    Response: {"ok": true, "gigs": [
        {"name": "2026-05-09",
         "rpp_path": "/home/tangerine/Reaper/Gigs/2026-05-09/2026-05-09.rpp",
         "media_count": 18,
         "size_bytes": 14200000000,
         "modified_at": 1778459930},
        ...
    ]}

    GET /healthz              (already present)
    Response: {"ok": true, "queue_dir": "/tmp/gig-commands"}

Responses:
    200 {"ok": true, "queued": "<filename>"}    (POST /gig, /song-marker)
    200 {"ok": true, "gigs": [...]}              (GET /gigs)
    400 on bad JSON / missing fields / unknown action
    500 on filesystem error

The server writes a unique timestamped file per command so the listener handles
them in arrival order. The APK is fire-and-forget — it does not wait for Reaper
to actually rename / save.

Install (E6330):
    sudo install -m 755 gig-command-server.py /opt/tgt/gig-command-server.py
    sudo install -m 644 gig-command-server.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable --now gig-command-server.service

Verify:
    curl -X POST http://localhost:8666/gig \
        -H 'Content-Type: application/json' \
        -d '{"action":"save","project_name":"test-gig"}'

Bind: 0.0.0.0:8666 — accessible from APK over the S23 hotspot via mDNS
(e6330.local) or the assigned hotspot IP. No auth: gig LAN is trusted, port
isn't exposed beyond the hotspot, and a wrong command at worst fires an extra
Reaper save (idempotent).
"""

import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional

LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 8666
QUEUE_DIR = Path("/tmp/gig-commands")
SONG_MARKER_DIR = Path("/tmp/song-markers")
VALID_ACTIONS = {"start", "save", "stop"}

# S146: where the listener saves gig RPPs (matches gig-command-listener.lua's
# gigs_dir_path()). Both must agree or GET /gigs returns nothing.
GIGS_DIR = Path(os.path.expanduser("~/Reaper/Gigs"))


def ensure_queue_dir() -> None:
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    SONG_MARKER_DIR.mkdir(parents=True, exist_ok=True)


class GigHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # noqa: N802 — stdlib hook name
        sys.stdout.write(f"[gig-cmd] {self.address_string()} - {fmt % args}\n")
        sys.stdout.flush()

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        if self.path == "/healthz":
            self._json(200, {"ok": True, "queue_dir": str(QUEUE_DIR)})
            return
        if self.path == "/gigs":
            self._handle_list_gigs()
            return
        self._json(404, {"ok": False, "error": "not found"})

    def _handle_list_gigs(self) -> None:
        """S146: enumerate ~/Reaper/Gigs/ for the MS PWA Gigs browser.

        Each gig is a top-level directory under GIGS_DIR. Inside a gig dir we
        expect either <name>.rpp (the auto-saved gig project, named after the
        directory by gig-command-listener.lua's start_project) OR a single
        gig.RPP file (the autostart-pattern fallback).

        Skips directories that look like backups, hidden, or have no RPP."""
        if not GIGS_DIR.exists():
            self._json(200, {"ok": True, "gigs": []})
            return

        gigs: list[dict] = []
        try:
            for entry in sorted(GIGS_DIR.iterdir()):
                if not entry.is_dir():
                    continue
                if entry.name.startswith(".") or entry.name.lower() == "backups":
                    continue

                # Find the RPP: prefer <dir-name>.rpp, then any *.rpp at depth 1
                preferred = entry / f"{entry.name}.rpp"
                if preferred.exists():
                    rpp_path = preferred
                else:
                    rpps = list(entry.glob("*.rpp")) + list(entry.glob("*.RPP"))
                    if not rpps:
                        continue
                    rpp_path = rpps[0]

                # Media: count .wav under entry/Media/ (or entry/ if no Media subdir)
                media_dir = entry / "Media"
                wav_root = media_dir if media_dir.exists() else entry
                media_count = 0
                size_bytes = 0
                try:
                    for wav in wav_root.rglob("*.wav"):
                        media_count += 1
                        try:
                            size_bytes += wav.stat().st_size
                        except OSError:
                            pass
                except OSError:
                    pass

                try:
                    modified_at = int(rpp_path.stat().st_mtime)
                except OSError:
                    modified_at = 0

                gigs.append({
                    "name": entry.name,
                    "rpp_path": str(rpp_path),
                    "media_count": media_count,
                    "size_bytes": size_bytes,
                    "modified_at": modified_at,
                })
        except OSError as e:
            self._json(500, {"ok": False, "error": f"scan failed: {e}"})
            return

        self._json(200, {"ok": True, "gigs": gigs, "gigs_dir": str(GIGS_DIR)})

    def _read_json_body(self) -> Optional[dict]:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 8192:
            self._json(400, {"ok": False, "error": "missing or oversize body"})
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            self._json(400, {"ok": False, "error": f"bad json: {e}"})
            return None

    def do_POST(self):  # noqa: N802
        if self.path == "/gig":
            self._handle_gig()
        elif self.path == "/song-marker":
            self._handle_song_marker()
        else:
            self._json(404, {"ok": False, "error": "not found"})

    def _handle_gig(self) -> None:
        payload = self._read_json_body()
        if payload is None:
            return

        action = payload.get("action")
        project_name = payload.get("project_name") or ""
        if action not in VALID_ACTIONS:
            self._json(400, {"ok": False, "error": f"unknown action: {action!r}"})
            return
        if action == "start" and not project_name.strip():
            self._json(400, {"ok": False, "error": "start requires non-empty project_name"})
            return

        ts = int(time.time() * 1000)
        filename = f"{ts}-{action}.json"
        target = QUEUE_DIR / filename
        try:
            target.write_text(
                json.dumps({"action": action, "project_name": project_name, "ts_ms": ts}),
                encoding="utf-8",
            )
        except OSError as e:
            self._json(500, {"ok": False, "error": f"write failed: {e}"})
            return

        self._json(200, {"ok": True, "queued": filename})

    def _handle_song_marker(self) -> None:
        payload = self._read_json_body()
        if payload is None:
            return

        title = (payload.get("title") or "").strip()
        if not title:
            self._json(400, {"ok": False, "error": "title required"})
            return

        ts = int(time.time() * 1000)
        # Filename prefix sorts chronologically; song-marker-listener.lua reads
        # the .txt content for the actual title.
        filename = f"{ts}-marker.txt"
        target = SONG_MARKER_DIR / filename
        try:
            target.write_text(title, encoding="utf-8")
        except OSError as e:
            self._json(500, {"ok": False, "error": f"write failed: {e}"})
            return

        self._json(200, {"ok": True, "queued": filename})


def main() -> int:
    ensure_queue_dir()
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), GigHandler)
    sys.stdout.write(f"[gig-cmd] listening on {LISTEN_HOST}:{LISTEN_PORT} -> {QUEUE_DIR}\n")
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        sys.stdout.write("[gig-cmd] shutting down\n")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
