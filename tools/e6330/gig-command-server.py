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

Endpoint:
    POST /gig
    Content-Type: application/json
    Body: {"action": "start" | "save" | "stop", "project_name": "<gig name>"}

Responses:
    200 {"ok": true, "queued": "<filename>"}
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

LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 8666
QUEUE_DIR = Path("/tmp/gig-commands")
VALID_ACTIONS = {"start", "save", "stop"}


def ensure_queue_dir() -> None:
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)


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
        self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):  # noqa: N802
        if self.path != "/gig":
            self._json(404, {"ok": False, "error": "not found"})
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 8192:
            self._json(400, {"ok": False, "error": "missing or oversize body"})
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            self._json(400, {"ok": False, "error": f"bad json: {e}"})
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
