"""
S31A: Beat detection Cloud Run service using madmom.
Accepts an audio file (POST /analyse) and returns beat timestamps + BPM.
"""
import io
import os
import tempfile
import subprocess

import numpy as np
from flask import Flask, request, jsonify

app = Flask(__name__)


def decode_to_wav(input_bytes: bytes) -> str:
    """Decode any audio format to 44100 Hz mono WAV using ffmpeg."""
    tmp_in = tempfile.NamedTemporaryFile(suffix=".audio", delete=False)
    tmp_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp_in.write(input_bytes)
    tmp_in.close()
    tmp_out.close()

    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", tmp_in.name,
                "-ar", "44100", "-ac", "1", "-f", "wav", tmp_out.name,
            ],
            capture_output=True, check=True, timeout=120,
        )
    finally:
        os.unlink(tmp_in.name)

    return tmp_out.name


@app.route("/analyse", methods=["POST"])
def analyse():
    """
    POST /analyse
    Body: raw audio file bytes (MP3, WAV, etc.)
    Returns: { "beats": [0.45, 0.92, ...], "bpm": 104.2 }
    """
    if not request.data and not request.files:
        return jsonify({"error": "No audio data provided"}), 400

    # Accept either raw body or multipart file upload
    if request.files and "file" in request.files:
        audio_bytes = request.files["file"].read()
    else:
        audio_bytes = request.data

    if len(audio_bytes) < 1000:
        return jsonify({"error": "Audio data too small"}), 400

    wav_path = None
    try:
        # Decode to WAV (madmom needs WAV or uses ffmpeg internally,
        # but pre-decoding is more reliable in containerised environments)
        wav_path = decode_to_wav(audio_bytes)

        # Import madmom here to avoid slow startup on health checks
        from madmom.features.beats import (
            RNNBeatProcessor,
            DBNBeatTrackingProcessor,
        )

        # RNNBeatProcessor: runs 8 RNN models on the audio, outputs beat
        # activation function. DBNBeatTrackingProcessor: dynamic Bayesian
        # network that finds optimal beat sequence from the activation.
        proc = RNNBeatProcessor()
        activations = proc(wav_path)

        dbn = DBNBeatTrackingProcessor(fps=100)
        beats = dbn(activations)

        # beats is a numpy array of beat times in seconds
        beat_list = [round(float(b), 4) for b in beats]

        # Compute BPM from median inter-beat interval
        if len(beat_list) >= 2:
            ibis = np.diff(beat_list)
            median_ibi = float(np.median(ibis))
            bpm = round(60.0 / median_ibi, 1) if median_ibi > 0 else 0.0
        else:
            bpm = 0.0

        return jsonify({"beats": beat_list, "bpm": bpm})

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Audio decode timed out"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
