#!/usr/bin/env python3
"""F1: a fake `adb` shim for the E2E harness.

pull-videos.py shells out to `adb` for three things:
    1. `adb devices`
    2. `adb -s <serial> shell getprop ro.product.model`
    3. `adb -s <serial> shell '<find/stat shell snippet>'`  (lists mp4s+mtimes)
    4. `adb -s <serial> pull <remote> <local>`

This shim implements all four against a tmp-dir-backed "phone" filesystem so
the real pull-videos.py can run end-to-end without any phones present.

Invocation: pull-videos.py is told `--adb <path-to-this-script>` and the
shim reads `FAKE_ADB_ROOT` from the environment to find each device's tree:

    $FAKE_ADB_ROOT/
        devices.json           # [{"serial": "...", "model": "..."}, ...]
        <serial>/
            <REMOTE_DIR>/       # e.g. orchestrator_recordings
                <mp4 files>     # real files with synthetic content
"""
from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path


def main() -> int:
    root = os.environ.get("FAKE_ADB_ROOT")
    if not root:
        sys.stderr.write("fake_adb: FAKE_ADB_ROOT env var not set\n")
        return 2
    root_p = Path(root)
    devices_file = root_p / "devices.json"
    if not devices_file.exists():
        sys.stderr.write(f"fake_adb: missing {devices_file}\n")
        return 2
    devices = json.loads(devices_file.read_text())

    args = sys.argv[1:]
    # Strip the optional "-s <serial>" prefix and remember the serial.
    serial: str | None = None
    if len(args) >= 2 and args[0] == "-s":
        serial = args[1]
        args = args[2:]

    if not args:
        return 0

    sub = args[0]

    # --- adb devices ---
    if sub == "devices":
        sys.stdout.write("List of devices attached\n")
        for d in devices:
            sys.stdout.write(f"{d['serial']}\tdevice\n")
        return 0

    # --- adb shell ... ---
    if sub == "shell":
        if serial is None:
            sys.stderr.write("fake_adb: shell needs -s <serial>\n")
            return 2
        shell_cmd = " ".join(args[1:])

        # getprop ro.product.model
        if "getprop" in shell_cmd and "ro.product.model" in shell_cmd:
            model = next((d.get("model", serial) for d in devices if d["serial"] == serial), serial)
            sys.stdout.write(f"{model}\n")
            return 0

        # The mp4-listing snippet from list_remote_mp4s — looks like:
        #   if [ -d "<dir>" ]; then ... for f in "<dir>"/*.mp4; do ... echo "$mt $sz $f"; done; fi
        # We don't actually parse the shell; instead we detect the remote dir
        # path from the snippet and emit our own listing.
        for remote_dir_marker in ("orchestrator_recordings", "peer_recordings"):
            if remote_dir_marker in shell_cmd:
                # Extract the literal path between the first pair of `"..."`
                # — the snippet quotes it twice (once in the `[ -d ... ]` test).
                start = shell_cmd.find('"')
                end = shell_cmd.find('"', start + 1)
                if start == -1 or end == -1:
                    return 0
                remote_dir = shell_cmd[start + 1:end]
                device_tree = root_p / serial
                # The remote_dir on the phone maps onto our fake tree by
                # taking just the trailing component (`orchestrator_recordings`
                # or `peer_recordings`) — keeps the fake tree shallow.
                tail = Path(remote_dir).name
                local_dir = device_tree / tail
                if not local_dir.is_dir():
                    return 0
                # Emit `<mtime> <size> <full remote path>` per real script's parser.
                for f in sorted(local_dir.iterdir()):
                    if f.is_file() and f.suffix.lower() == ".mp4":
                        mt = int(f.stat().st_mtime)
                        sz = f.stat().st_size
                        sys.stdout.write(f"{mt} {sz} {remote_dir}/{f.name}\n")
                return 0

        # Unknown shell command — silent success (matches adb's behaviour on
        # an `if-then-fi` that finds nothing).
        return 0

    # --- adb pull <remote> <local> ---
    if sub == "pull":
        if serial is None or len(args) < 3:
            sys.stderr.write("fake_adb: pull needs -s <serial> + remote + local\n")
            return 2
        remote = args[1]
        local = args[2]
        # Map remote path to fake tree: <root>/<serial>/<tail-component>/<filename>
        # but the snippet emits `remote_dir/filename.mp4` where remote_dir is the
        # full /sdcard/... path. The shim's tree is flat under <serial>/<tail>/.
        remote_p = Path(remote)
        src = root_p / serial / remote_p.parent.name / remote_p.name
        if not src.is_file():
            sys.stderr.write(f"fake_adb: source not found: {src}\n")
            return 1
        Path(local).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, local)
        return 0

    sys.stderr.write(f"fake_adb: unknown command {sub}\n")
    return 2


if __name__ == "__main__":
    sys.exit(main())
