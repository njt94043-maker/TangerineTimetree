"""F1: E2E test harness for pull-videos.py per-gig scope.

Run with:
    cd C:/Apps/TGT/tools/post-prod
    python -m pytest tests/ -v

The decisive scenario (the bug Nathan hit on 2026-05-13): a phone holds mp4s
for TWO gigs, and pulling for one of them must not drag in the other's. That's
the regression we never want to ship again.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest


HERE = Path(__file__).parent
POSTPROD = HERE.parent
PULL_VIDEOS = POSTPROD / "pull-videos.py"
FAKE_ADB = HERE / ("fake_adb.bat" if os.name == "nt" else "fake_adb.py")


def _make_phone(root: Path, serial: str, model: str, files: list[tuple[str, str]]) -> None:
    """Plant a fake phone under <root>/<serial>/. `files` = [(remote_subdir, filename), ...]."""
    for subdir, name in files:
        p = root / serial / subdir
        p.mkdir(parents=True, exist_ok=True)
        # Synthetic content so adb-pull copies a small but distinct payload.
        (p / name).write_bytes(b"FAKE_MP4_" + name.encode())


def _devices_json(root: Path, devices: list[dict]) -> None:
    root.mkdir(parents=True, exist_ok=True)
    (root / "devices.json").write_text(json.dumps(devices))


def _run_pull(gig_dir: Path, fake_root: Path, **kwargs) -> subprocess.CompletedProcess:
    """Invoke pull-videos.py against the fake-adb shim."""
    cmd = [sys.executable, str(PULL_VIDEOS), str(gig_dir), "--adb", str(FAKE_ADB)]
    if kwargs.get("gig_name"):
        cmd += ["--gig-name", kwargs["gig_name"]]
    if kwargs.get("gig_date"):
        cmd += ["--gig-date", kwargs["gig_date"]]
    if kwargs.get("since"):
        cmd += ["--since", kwargs["since"]]
    env = os.environ.copy()
    env["FAKE_ADB_ROOT"] = str(fake_root)
    return subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=30)


def _pulled_files(gig_dir: Path) -> list[str]:
    video_dir = gig_dir / "video"
    if not video_dir.is_dir():
        return []
    return sorted([f.name for f in video_dir.rglob("*.mp4")])


# ---------------------------------------------------------------------------
# The S155 regression — pull is gig-scoped
# ---------------------------------------------------------------------------

def test_two_gigs_pull_scoped_to_one(tmp_path: Path):
    """Phone has mp4s from gig A AND gig B. Pulling for gig A lands ONLY
    gig A's mp4s. This is the bug Nathan hit on 2026-05-13."""
    fake_root = tmp_path / "phone-state"
    _devices_json(fake_root, [{"serial": "PHONE-S23", "model": "SM-S911B"}])
    _make_phone(fake_root, "PHONE-S23", "SM-S911B", [
        ("orchestrator_recordings", "jam3-20260513__orchestrator_set-A_1.mp4"),
        ("orchestrator_recordings", "jam3-20260513__orchestrator_set-A_2.mp4"),
        ("orchestrator_recordings", "Beddau-RFC-20260509__orchestrator_set-Z_1.mp4"),
    ])
    gig_dir = tmp_path / "gigs" / "jam3"
    gig_dir.mkdir(parents=True)

    r = _run_pull(gig_dir, fake_root, gig_name="jam3")
    assert r.returncode == 0, f"stdout={r.stdout!r} stderr={r.stderr!r}"

    files = _pulled_files(gig_dir)
    assert files == [
        "jam3-20260513__orchestrator_set-A_1.mp4",
        "jam3-20260513__orchestrator_set-A_2.mp4",
    ], f"unexpected files: {files}"


def test_no_filter_pulls_everything(tmp_path: Path):
    """No --gig-name = pull everything (the 'force' path from the MS host)."""
    fake_root = tmp_path / "phone-state"
    _devices_json(fake_root, [{"serial": "PHONE-S23", "model": "SM-S911B"}])
    _make_phone(fake_root, "PHONE-S23", "SM-S911B", [
        ("orchestrator_recordings", "jam3-20260513__orchestrator_set-A_1.mp4"),
        ("orchestrator_recordings", "Beddau-RFC-20260509__orchestrator_set-Z_1.mp4"),
    ])
    gig_dir = tmp_path / "gigs" / "jam3"
    gig_dir.mkdir(parents=True)

    r = _run_pull(gig_dir, fake_root)  # no gig_name
    assert r.returncode == 0
    assert _pulled_files(gig_dir) == [
        "Beddau-RFC-20260509__orchestrator_set-Z_1.mp4",
        "jam3-20260513__orchestrator_set-A_1.mp4",
    ]


# ---------------------------------------------------------------------------
# The F4 collision case — same name, different days
# ---------------------------------------------------------------------------

def test_same_name_different_days_collision_with_gig_date(tmp_path: Path):
    """Two gigs both named 'jam3' on different days. --gig-date narrows the
    pull to exact-date match so they don't contaminate each other."""
    fake_root = tmp_path / "phone-state"
    _devices_json(fake_root, [{"serial": "PHONE-S23", "model": "SM-S911B"}])
    _make_phone(fake_root, "PHONE-S23", "SM-S911B", [
        ("orchestrator_recordings", "jam3-20260513__orchestrator_set-A_1.mp4"),
        ("orchestrator_recordings", "jam3-20260601__orchestrator_set-B_1.mp4"),
    ])
    gig_dir = tmp_path / "gigs" / "jam3"
    gig_dir.mkdir(parents=True)

    r = _run_pull(gig_dir, fake_root, gig_name="jam3", gig_date="20260601")
    assert r.returncode == 0
    assert _pulled_files(gig_dir) == [
        "jam3-20260601__orchestrator_set-B_1.mp4",
    ]


def test_same_name_no_date_grabs_both_dates(tmp_path: Path):
    """Without --gig-date, --gig-name jam3 grabs both jam3-20260513 AND
    jam3-20260601 — documented behaviour (use --gig-date to disambiguate)."""
    fake_root = tmp_path / "phone-state"
    _devices_json(fake_root, [{"serial": "PHONE-S23", "model": "SM-S911B"}])
    _make_phone(fake_root, "PHONE-S23", "SM-S911B", [
        ("orchestrator_recordings", "jam3-20260513__orchestrator_set-A_1.mp4"),
        ("orchestrator_recordings", "jam3-20260601__orchestrator_set-B_1.mp4"),
    ])
    gig_dir = tmp_path / "gigs" / "jam3"
    gig_dir.mkdir(parents=True)

    r = _run_pull(gig_dir, fake_root, gig_name="jam3")
    assert r.returncode == 0
    assert _pulled_files(gig_dir) == [
        "jam3-20260513__orchestrator_set-A_1.mp4",
        "jam3-20260601__orchestrator_set-B_1.mp4",
    ]


# ---------------------------------------------------------------------------
# Legacy compatibility — pre-F4 S155 APKs without date suffix
# ---------------------------------------------------------------------------

def test_legacy_no_date_prefix_still_pullable(tmp_path: Path):
    """S155 APKs (v1.2.24) wrote 'jam3__...' without the date suffix that F4
    added. --gig-name jam3 should match BOTH 'jam3__...' AND 'jam3-DATE__...'
    so a freshly-updated MS host still pulls from a not-yet-updated APK."""
    fake_root = tmp_path / "phone-state"
    _devices_json(fake_root, [{"serial": "PHONE-S23", "model": "SM-S911B"}])
    _make_phone(fake_root, "PHONE-S23", "SM-S911B", [
        ("orchestrator_recordings", "jam3__orchestrator_set-LEGACY_1.mp4"),
        ("orchestrator_recordings", "jam3-20260513__orchestrator_set-A_1.mp4"),
    ])
    gig_dir = tmp_path / "gigs" / "jam3"
    gig_dir.mkdir(parents=True)

    r = _run_pull(gig_dir, fake_root, gig_name="jam3")
    assert r.returncode == 0
    assert _pulled_files(gig_dir) == [
        "jam3-20260513__orchestrator_set-A_1.mp4",
        "jam3__orchestrator_set-LEGACY_1.mp4",
    ]


def test_prefix_anchored_does_not_match_substring(tmp_path: Path):
    """`jam3` must not match `jam33__` or `notjam3__`. Anchored start."""
    fake_root = tmp_path / "phone-state"
    _devices_json(fake_root, [{"serial": "PHONE-S23", "model": "SM-S911B"}])
    _make_phone(fake_root, "PHONE-S23", "SM-S911B", [
        ("orchestrator_recordings", "jam33-20260513__orchestrator_set-X_1.mp4"),
        ("orchestrator_recordings", "notjam3-20260513__orchestrator_set-Y_1.mp4"),
        ("orchestrator_recordings", "jam3-20260513__orchestrator_set-OK_1.mp4"),
    ])
    gig_dir = tmp_path / "gigs" / "jam3"
    gig_dir.mkdir(parents=True)

    r = _run_pull(gig_dir, fake_root, gig_name="jam3")
    assert r.returncode == 0
    assert _pulled_files(gig_dir) == [
        "jam3-20260513__orchestrator_set-OK_1.mp4",
    ]


# ---------------------------------------------------------------------------
# Multi-device — both orchestrator + peer dirs scanned
# ---------------------------------------------------------------------------

def test_multi_device_per_gig_scope(tmp_path: Path):
    """Two phones (orchestrator + peer roles). Each holds mp4s from two gigs.
    Pull for jam3 lands jam3's mp4s from BOTH phones, ignores other gig."""
    fake_root = tmp_path / "phone-state"
    _devices_json(fake_root, [
        {"serial": "PHONE-S23", "model": "SM-S911B"},
        {"serial": "PHONE-S9",  "model": "SM-G960F"},
    ])
    _make_phone(fake_root, "PHONE-S23", "SM-S911B", [
        ("orchestrator_recordings", "jam3-20260513__orchestrator_set-A_1.mp4"),
        ("orchestrator_recordings", "Beddau-RFC-20260509__orchestrator_set-Z_1.mp4"),
    ])
    _make_phone(fake_root, "PHONE-S9", "SM-G960F", [
        ("peer_recordings", "jam3-20260513__gig-set_set-A_1.mp4"),
        ("peer_recordings", "Beddau-RFC-20260509__gig-set_set-Z_1.mp4"),
    ])
    gig_dir = tmp_path / "gigs" / "jam3"
    gig_dir.mkdir(parents=True)

    r = _run_pull(gig_dir, fake_root, gig_name="jam3")
    assert r.returncode == 0, f"stdout={r.stdout!r} stderr={r.stderr!r}"

    # Per pull-videos.py layout: <gig>/video/<MODEL>/<file>
    s911_files = sorted((gig_dir / "video" / "SM-S911B").glob("*.mp4")) if (gig_dir / "video" / "SM-S911B").is_dir() else []
    s9_files = sorted((gig_dir / "video" / "SM-G960F").glob("*.mp4")) if (gig_dir / "video" / "SM-G960F").is_dir() else []
    assert [f.name for f in s911_files] == ["jam3-20260513__orchestrator_set-A_1.mp4"]
    assert [f.name for f in s9_files] == ["jam3-20260513__gig-set_set-A_1.mp4"]


# ---------------------------------------------------------------------------
# slugify / pattern unit tests (mirrors APK CameraRecordingManager helpers)
# ---------------------------------------------------------------------------

def _load_pull_module():
    import importlib.util
    spec = importlib.util.spec_from_file_location("pv", str(PULL_VIDEOS))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_slugify_matches_kotlin_behaviour():
    pv = _load_pull_module()
    # F5: separator is now dash. Mirrors APK CameraRecordingManager.slugifyGigName.
    assert pv.slugify_gig_name("jam3") == "jam3"
    assert pv.slugify_gig_name("Beddau-RFC") == "Beddau-RFC"
    assert pv.slugify_gig_name("Spaces in name") == "Spaces-in-name"
    assert pv.slugify_gig_name("weird/chars*here") == "weird-chars-here"
    assert pv.slugify_gig_name("") == "nogig"
    assert pv.slugify_gig_name("   ") == "nogig"
    assert pv.slugify_gig_name("!!!") == "nogig"
    assert pv.slugify_gig_name("jam3", "20260513") == "jam3-20260513"
    assert pv.slugify_gig_name("jam3", "bad") == "jam3"
    assert pv.slugify_gig_name("", "20260513") == "nogig-20260513"


def test_gig_match_pattern_shapes():
    pv = _load_pull_module()
    # name only — allows both dated + legacy
    p = pv.gig_match_pattern("jam3", None)
    assert p.match("jam3__a.mp4")
    assert p.match("jam3-20260513__a.mp4")
    assert not p.match("notjam3__a.mp4")
    assert not p.match("jam33__a.mp4")
    # name + date — exact-date match only
    p = pv.gig_match_pattern("jam3", "20260513")
    assert not p.match("jam3__a.mp4")
    assert p.match("jam3-20260513__a.mp4")
    assert not p.match("jam3-20260601__a.mp4")


def test_gig_match_lenient_separator_legacy_vs_f5(tmp_path: Path):
    """F5 regression — the 2026-05-13 field-test bug. APK pre-F5 produced
    'testing_2-' (underscore for space) but the MS host pulled by 'testing-2'
    (dash from canonical dir name). The lenient regex matches BOTH variants
    so already-deployed pre-F5 APKs still get pulled correctly."""
    fake_root = tmp_path / "phone-state"
    _devices_json(fake_root, [{"serial": "PHONE-S23", "model": "SM-S911B"}])
    _make_phone(fake_root, "PHONE-S23", "SM-S911B", [
        # Pre-F5 APK output: space → underscore
        ("orchestrator_recordings", "testing_2-20260513__orchestrator_set-OLD_1.mp4"),
        # F5 APK output: space → dash
        ("orchestrator_recordings", "testing-2-20260513__orchestrator_set-NEW_1.mp4"),
        # Different gig, must not match
        ("orchestrator_recordings", "Beddau-RFC-20260509__orchestrator_set-Z_1.mp4"),
    ])
    gig_dir = tmp_path / "gigs" / "testing-2"
    gig_dir.mkdir(parents=True)

    # Pull with the dash form (what the MS host passes from the gig dir name).
    r = _run_pull(gig_dir, fake_root, gig_name="testing-2")
    assert r.returncode == 0, f"stdout={r.stdout!r} stderr={r.stderr!r}"
    assert _pulled_files(gig_dir) == [
        "testing-2-20260513__orchestrator_set-NEW_1.mp4",
        "testing_2-20260513__orchestrator_set-OLD_1.mp4",
    ]


def test_gig_match_lenient_separator_with_space_input(tmp_path: Path):
    """If someone passes the human-typed name with a space (`testing 2`)
    instead of the canonicalised slug, the regex still finds both legacy
    and F5 file shapes."""
    fake_root = tmp_path / "phone-state"
    _devices_json(fake_root, [{"serial": "PHONE-S23", "model": "SM-S911B"}])
    _make_phone(fake_root, "PHONE-S23", "SM-S911B", [
        ("orchestrator_recordings", "testing_2-20260513__orchestrator_set-OLD_1.mp4"),
        ("orchestrator_recordings", "testing-2-20260513__orchestrator_set-NEW_1.mp4"),
        ("orchestrator_recordings", "testing33-20260513__orchestrator_set-NO_1.mp4"),
    ])
    gig_dir = tmp_path / "gigs" / "testing 2"
    gig_dir.mkdir(parents=True)

    r = _run_pull(gig_dir, fake_root, gig_name="testing 2")
    assert r.returncode == 0
    assert _pulled_files(gig_dir) == [
        "testing-2-20260513__orchestrator_set-NEW_1.mp4",
        "testing_2-20260513__orchestrator_set-OLD_1.mp4",
    ]
