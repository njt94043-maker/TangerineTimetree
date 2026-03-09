"""
S32A: Audio processing Cloud Run service.
- /analyse        — beat detection only (legacy, backward compat)
- /process        — enqueue full pipeline (beats + stem separation) via Cloud Tasks
- /process-worker — the actual worker (called by Cloud Tasks only)
- /health         — health check
"""
# madmom 0.16.1 uses collections.MutableSequence (removed in 3.10+)
import collections
import collections.abc
for attr in ('MutableSequence', 'MutableMapping', 'MutableSet',
             'Mapping', 'Sequence', 'Iterable', 'Iterator'):
    if not hasattr(collections, attr):
        setattr(collections, attr, getattr(collections.abc, attr))

import glob as globmod
import json
import os
import shutil
import subprocess
import tempfile
import time
import traceback

import numpy as np
import requests as http_requests
from flask import Flask, request, jsonify

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Config from env vars (set on Cloud Run, never committed)
# ---------------------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
GCP_PROJECT = os.environ.get("GCP_PROJECT", "")
GCP_REGION = os.environ.get("GCP_REGION", "europe-west1")
CLOUD_TASKS_QUEUE = os.environ.get("CLOUD_TASKS_QUEUE", "stem-processing")
CLOUD_RUN_SERVICE_URL = os.environ.get("CLOUD_RUN_SERVICE_URL", "")
WORKER_SECRET = os.environ.get("WORKER_SECRET", "")
SERVICE_ACCOUNT_EMAIL = os.environ.get("SERVICE_ACCOUNT_EMAIL", "")


def _supa_headers():
    """Supabase REST headers (service role bypasses RLS)."""
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


# ---------------------------------------------------------------------------
# Supabase REST helpers
# ---------------------------------------------------------------------------

def update_beat_map_status(song_id: str, status: str, error: str = None,
                           beats: list = None, bpm: float = None):
    """Upsert beat_maps row via PostgREST."""
    headers = _supa_headers()
    url = f"{SUPABASE_URL}/rest/v1/beat_maps"

    check = http_requests.get(
        f"{url}?song_id=eq.{song_id}&select=id",
        headers=headers,
    )
    payload = {"status": status}
    if error is not None:
        payload["error"] = error
    if beats is not None:
        payload["beats"] = beats
    if bpm is not None:
        payload["bpm"] = bpm

    if check.ok and check.json():
        http_requests.patch(
            f"{url}?song_id=eq.{song_id}",
            headers=headers,
            json=payload,
        )
    else:
        payload["song_id"] = song_id
        http_requests.post(url, headers=headers, json=payload)


def delete_auto_stems(song_id: str):
    """Delete existing auto-generated stems (storage files + DB rows)."""
    headers = _supa_headers()
    url = f"{SUPABASE_URL}/rest/v1/song_stems"

    resp = http_requests.get(
        f"{url}?song_id=eq.{song_id}&source=eq.auto&select=id,storage_path",
        headers=headers,
    )
    if not resp.ok:
        return

    stems = resp.json()
    if not stems:
        return

    # Delete storage files
    storage_paths = [s["storage_path"] for s in stems if s.get("storage_path")]
    if storage_paths:
        http_requests.delete(
            f"{SUPABASE_URL}/storage/v1/object/song-stems",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
            },
            json={"prefixes": storage_paths},
        )

    # Delete DB rows
    for s in stems:
        http_requests.delete(f"{url}?id=eq.{s['id']}", headers=headers)


def upload_stem_to_supabase(song_id: str, label: str, mp3_path: str):
    """Upload stem MP3 to Supabase Storage and create song_stems row."""
    timestamp = int(time.time() * 1000)
    storage_path = f"{song_id}/{label}-{timestamp}.mp3"

    with open(mp3_path, "rb") as f:
        file_bytes = f.read()

    upload_resp = http_requests.post(
        f"{SUPABASE_URL}/storage/v1/object/song-stems/{storage_path}",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "audio/mpeg",
        },
        data=file_bytes,
    )
    if not upload_resp.ok:
        raise Exception(f"Storage upload failed for {label}: {upload_resp.text}")

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/song-stems/{storage_path}"

    insert_resp = http_requests.post(
        f"{SUPABASE_URL}/rest/v1/song_stems",
        headers=_supa_headers(),
        json={
            "song_id": song_id,
            "label": label,
            "audio_url": public_url,
            "storage_path": storage_path,
            "source": "auto",
        },
    )
    if not insert_resp.ok:
        raise Exception(f"DB insert failed for {label}: {insert_resp.text}")


# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------

def decode_to_wav(input_bytes: bytes, channels: int = 1) -> str:
    """Decode any audio format to 44100 Hz WAV using ffmpeg."""
    tmp_in = tempfile.NamedTemporaryFile(suffix=".audio", delete=False)
    tmp_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp_in.write(input_bytes)
    tmp_in.close()
    tmp_out.close()

    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", tmp_in.name,
                "-ar", "44100", "-ac", str(channels), "-f", "wav", tmp_out.name,
            ],
            capture_output=True, check=True, timeout=120,
        )
    finally:
        os.unlink(tmp_in.name)

    return tmp_out.name


def download_audio(url: str) -> bytes:
    """Download audio file from URL."""
    resp = http_requests.get(url, timeout=120)
    if not resp.ok:
        raise Exception(f"Failed to download audio: HTTP {resp.status_code}")
    if len(resp.content) < 1000:
        raise Exception("Downloaded audio too small")
    return resp.content


def encode_to_mp3(wav_path: str, bitrate: str = "192k") -> str:
    """Convert WAV to MP3 using ffmpeg."""
    mp3_path = wav_path.rsplit(".", 1)[0] + ".mp3"
    subprocess.run(
        ["ffmpeg", "-y", "-i", wav_path, "-b:a", bitrate, mp3_path],
        capture_output=True, check=True, timeout=120,
    )
    return mp3_path


# ---------------------------------------------------------------------------
# Beat detection (madmom)
# ---------------------------------------------------------------------------

def run_madmom(wav_path: str) -> tuple:
    """Run madmom RNN+DBN beat detection. Returns (beat_list, bpm)."""
    from madmom.features.beats import RNNBeatProcessor, DBNBeatTrackingProcessor

    proc = RNNBeatProcessor()
    activations = proc(wav_path)

    dbn = DBNBeatTrackingProcessor(fps=100)
    beats = dbn(activations)

    beat_list = [round(float(b), 4) for b in beats]

    if len(beat_list) >= 2:
        ibis = np.diff(beat_list)
        median_ibi = float(np.median(ibis))
        bpm = round(60.0 / median_ibi, 1) if median_ibi > 0 else 0.0
    else:
        bpm = 0.0

    return beat_list, bpm


# ---------------------------------------------------------------------------
# Stem separation (Demucs)
# ---------------------------------------------------------------------------

def run_demucs(wav_path: str) -> dict:
    """
    Run Demucs htdemucs stem separation on a stereo WAV.
    Returns dict: {"drums": "/path/drums.wav", "bass": "/path/bass.wav", ...}
    """
    output_dir = tempfile.mkdtemp(prefix="demucs_")

    result = subprocess.run(
        [
            "python", "-m", "demucs",
            "-n", "htdemucs",
            "-o", output_dir,
            wav_path,
        ],
        capture_output=True, text=True, timeout=900,
    )
    if result.returncode != 0:
        app.logger.error(f"Demucs stdout: {result.stdout}")
        app.logger.error(f"Demucs stderr: {result.stderr}")
        raise Exception(f"Demucs failed (exit {result.returncode}): {result.stderr[-500:] if result.stderr else 'no stderr'}")

    # Demucs outputs to: {output_dir}/htdemucs/{track_name}/{stem}.wav
    track_name = os.path.splitext(os.path.basename(wav_path))[0]
    stems_dir = os.path.join(output_dir, "htdemucs", track_name)

    label_map = {
        "drums": "drums",
        "bass": "bass",
        "vocals": "vocals",
        "other": "other",
    }

    result = {}
    for demucs_name, our_label in label_map.items():
        stem_path = os.path.join(stems_dir, f"{demucs_name}.wav")
        if os.path.exists(stem_path):
            result[our_label] = stem_path

    if not result:
        existing = globmod.glob(os.path.join(output_dir, "**", "*.wav"), recursive=True)
        raise Exception(f"No stem files found. Output dir contents: {existing}")

    return result


# ---------------------------------------------------------------------------
# Cloud Tasks enqueue
# ---------------------------------------------------------------------------

def enqueue_process_task(song_id: str, audio_url: str):
    """Create a Cloud Task to call /process-worker."""
    from google.cloud import tasks_v2

    client = tasks_v2.CloudTasksClient()
    parent = client.queue_path(GCP_PROJECT, GCP_REGION, CLOUD_TASKS_QUEUE)

    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": f"{CLOUD_RUN_SERVICE_URL}/process-worker",
            "headers": {
                "Content-Type": "application/json",
                "X-Worker-Secret": WORKER_SECRET,
            },
            "body": json.dumps({
                "song_id": song_id,
                "audio_url": audio_url,
            }).encode(),
        },
    }

    if SERVICE_ACCOUNT_EMAIL:
        task["http_request"]["oidc_token"] = {
            "service_account_email": SERVICE_ACCOUNT_EMAIL,
        }

    client.create_task(request={"parent": parent, "task": task})


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/analyse", methods=["POST"])
def analyse():
    """
    Legacy: POST /analyse — beat detection only.
    Body: raw audio file bytes. Returns: { "beats": [...], "bpm": 104.2 }
    """
    if not request.data and not request.files:
        return jsonify({"error": "No audio data provided"}), 400

    if request.files and "file" in request.files:
        audio_bytes = request.files["file"].read()
    else:
        audio_bytes = request.data

    if len(audio_bytes) < 1000:
        return jsonify({"error": "Audio data too small"}), 400

    wav_path = None
    try:
        wav_path = decode_to_wav(audio_bytes)
        beat_list, bpm = run_madmom(wav_path)
        return jsonify({"beats": beat_list, "bpm": bpm})
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Audio decode timed out"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)


@app.route("/process", methods=["POST"])
def process():
    """
    POST /process — enqueue full pipeline (beats + stems).
    Body: { "song_id": "uuid", "audio_url": "https://..." }
    Returns: 202 Accepted
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    song_id = data.get("song_id")
    audio_url = data.get("audio_url")

    if not song_id or not audio_url:
        return jsonify({"error": "song_id and audio_url required"}), 400

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return jsonify({"error": "Server not configured (missing Supabase credentials)"}), 500

    if not GCP_PROJECT or not CLOUD_RUN_SERVICE_URL:
        return jsonify({"error": "Server not configured (missing GCP config)"}), 500

    try:
        update_beat_map_status(song_id, "pending", error=None)
        enqueue_process_task(song_id, audio_url)
        return jsonify({"status": "queued"}), 202
    except Exception as e:
        update_beat_map_status(song_id, "failed", error=str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/process-worker", methods=["POST"])
def process_worker():
    """
    POST /process-worker — full pipeline (called by Cloud Tasks).
    Authenticated via X-Worker-Secret header.
    """
    if WORKER_SECRET and request.headers.get("X-Worker-Secret") != WORKER_SECRET:
        return jsonify({"error": "unauthorized"}), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    song_id = data.get("song_id")
    audio_url = data.get("audio_url")

    if not song_id or not audio_url:
        return jsonify({"error": "song_id and audio_url required"}), 400

    wav_mono = None
    wav_stereo = None
    try:
        # Phase 1: Download + beat detection
        update_beat_map_status(song_id, "analysing", error=None)
        audio_bytes = download_audio(audio_url)
        wav_mono = decode_to_wav(audio_bytes, channels=1)
        beat_list, bpm = run_madmom(wav_mono)
        update_beat_map_status(song_id, "separating", beats=beat_list, bpm=bpm)

        # Phase 2: Stem separation (Demucs needs stereo)
        wav_stereo = decode_to_wav(audio_bytes, channels=2)
        stem_paths = run_demucs(wav_stereo)

        # Phase 3: Delete old auto stems, upload new ones
        delete_auto_stems(song_id)
        for label, stem_wav_path in stem_paths.items():
            mp3_path = encode_to_mp3(stem_wav_path)
            upload_stem_to_supabase(song_id, label, mp3_path)

        # Phase 4: Done
        update_beat_map_status(song_id, "ready")
        return jsonify({"status": "done", "stems": list(stem_paths.keys()), "bpm": bpm}), 200

    except Exception as e:
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        app.logger.error(f"process-worker failed for {song_id}: {error_msg}")
        try:
            update_beat_map_status(song_id, "failed", error=str(e))
        except Exception:
            pass
        return jsonify({"error": str(e)}), 500
    finally:
        for p in [wav_mono, wav_stereo]:
            if p and os.path.exists(p):
                os.unlink(p)
        for d in globmod.glob(os.path.join(tempfile.gettempdir(), "demucs_*")):
            shutil.rmtree(d, ignore_errors=True)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
