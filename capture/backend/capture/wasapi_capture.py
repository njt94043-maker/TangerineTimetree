"""WASAPI loopback audio capture for Windows."""

import collections
import ctypes
import queue
import struct
import threading
import wave
from pathlib import Path

import pyaudiowpatch as pyaudio

from config import RECORDINGS_DIR

# Threshold for detecting audio (0.0-1.0 peak level).
# 0.005 ≈ -46 dB — picks up any real audio, ignores system noise floor.
DEFAULT_ARMED_THRESHOLD = 0.005

# Pre-roll: keep this many frames buffered while armed so the very
# first audio frames aren't clipped when recording triggers.
PRE_ROLL_FRAMES = 10  # ~200ms at 20ms/frame

# Write buffer: audio callback pushes frames here, writer thread drains.
# Decouples disk I/O from the realtime audio thread to prevent glitches.
WRITE_QUEUE_MAXSIZE = 500  # ~10s at 20ms/frame


def _set_process_priority(high: bool):
    """Set current process to High (recording) or Normal priority."""
    try:
        ABOVE_NORMAL_PRIORITY_CLASS = 0x00008000
        HIGH_PRIORITY_CLASS = 0x00000080
        NORMAL_PRIORITY_CLASS = 0x00000020
        handle = ctypes.windll.kernel32.GetCurrentProcess()
        priority = HIGH_PRIORITY_CLASS if high else NORMAL_PRIORITY_CLASS
        ctypes.windll.kernel32.SetPriorityClass(handle, priority)
    except Exception:
        pass  # Non-Windows or permission denied — silently ignore


class WasapiCapture:
    """Records system audio via WASAPI loopback to a WAV file.

    Supports an "armed" mode: the stream opens and monitors audio levels,
    but doesn't write to disk until audio exceeds a threshold. A small
    pre-roll buffer captures the frames just before the trigger so the
    start of the audio isn't clipped.

    Audio callback never touches disk — it pushes frames to a queue.
    A dedicated writer thread drains the queue to WAV, keeping the
    realtime audio path lock-free and glitch-free.
    """

    def __init__(self, session_id: str, device_index: int | None = None):
        self.session_id = session_id
        self.device_index = device_index
        self._pa = pyaudio.PyAudio()
        self._stream = None
        self._wf = None
        self._recording = False
        self._paused = False
        self._armed = False  # waiting for audio before recording
        self._armed_threshold = DEFAULT_ARMED_THRESHOLD
        self._pre_roll: collections.deque[bytes] = collections.deque(maxlen=PRE_ROLL_FRAMES)
        self._duration = 0.0
        self._bytes_written = 0
        self._peak_level = 0.0  # 0.0-1.0 peak audio level for meter
        self.output_path = RECORDINGS_DIR / f"{session_id}.wav"
        self._device_info = None
        self._channels = 0
        self._rate = 0
        self._sample_width = 2  # 16-bit

        # Writer thread state
        self._write_queue: queue.Queue[bytes | None] = queue.Queue(maxsize=WRITE_QUEUE_MAXSIZE)
        self._writer_thread: threading.Thread | None = None
        self._writer_alive = False

    @staticmethod
    def list_devices() -> list[dict]:
        """List available WASAPI loopback devices."""
        pa = pyaudio.PyAudio()
        devices = []
        try:
            for i in range(pa.get_device_count()):
                info = pa.get_device_info_by_index(i)
                if info.get("isLoopbackDevice", False):
                    devices.append({
                        "index": i,
                        "name": info["name"],
                        "channels": info["maxInputChannels"],
                        "sample_rate": int(info["defaultSampleRate"]),
                    })
        finally:
            pa.terminate()
        return devices

    def _get_loopback_device(self) -> dict:
        """Get the target loopback device info."""
        if self.device_index is not None:
            return self._pa.get_device_info_by_index(self.device_index)

        # Default: use pyaudiowpatch's built-in default loopback finder
        try:
            return self._pa.get_default_wasapi_loopback()
        except Exception:
            pass

        # Fallback: manually find loopback matching default speakers
        wasapi_info = self._pa.get_host_api_info_by_type(pyaudio.paWASAPI)
        default_speakers = self._pa.get_device_info_by_index(wasapi_info["defaultOutputDevice"])
        speaker_name = default_speakers["name"].split(" (")[0]
        for i in range(self._pa.get_device_count()):
            info = self._pa.get_device_info_by_index(i)
            if info.get("isLoopbackDevice", False) and speaker_name in info["name"]:
                return info
        raise RuntimeError(
            f"No WASAPI loopback device found. Default speakers: {default_speakers['name']}"
        )

    def _measure_peak(self, in_data: bytes) -> float:
        """Measure peak level from raw audio data. Returns 0.0-1.0."""
        try:
            n_samples = min(64, len(in_data) // self._sample_width)
            fmt = f"<{n_samples}h"
            samples = struct.unpack(fmt, in_data[:n_samples * self._sample_width])
            return max(abs(s) for s in samples) / 32768.0
        except Exception:
            return 0.0

    def _open_wav(self):
        """Open the WAV file for writing."""
        self._wf = wave.open(str(self.output_path), "wb")
        self._wf.setnchannels(self._channels)
        self._wf.setsampwidth(self._sample_width)
        self._wf.setframerate(self._rate)

    def _flush_pre_roll(self):
        """Queue buffered pre-roll frames for writing."""
        for frame_data in self._pre_roll:
            self._enqueue_write(frame_data)
        self._pre_roll.clear()

    def _enqueue_write(self, data: bytes):
        """Push audio data to the writer queue (non-blocking from callback)."""
        try:
            self._write_queue.put_nowait(data)
        except queue.Full:
            pass  # Drop frame rather than block the audio thread

    def _writer_loop(self):
        """Background thread: drain queue → WAV file. Runs until sentinel."""
        rate = self._rate
        channels = self._channels
        sample_width = self._sample_width

        while self._writer_alive:
            try:
                data = self._write_queue.get(timeout=0.1)
            except queue.Empty:
                continue

            if data is None:
                break  # Sentinel — stop

            if self._wf:
                self._wf.writeframes(data)
                self._bytes_written += len(data)
                self._duration = self._bytes_written / (rate * channels * sample_width)

    def _start_writer(self):
        """Start the background writer thread."""
        self._writer_alive = True
        self._writer_thread = threading.Thread(
            target=self._writer_loop, daemon=True, name="wav-writer"
        )
        self._writer_thread.start()

    def _stop_writer(self):
        """Stop the writer thread and drain remaining frames."""
        self._writer_alive = False
        # Send sentinel to unblock the writer
        try:
            self._write_queue.put_nowait(None)
        except queue.Full:
            pass
        if self._writer_thread and self._writer_thread.is_alive():
            self._writer_thread.join(timeout=5.0)
        self._writer_thread = None

    def start(self, armed: bool = False, threshold: float = DEFAULT_ARMED_THRESHOLD):
        """Start recording (or arm for auto-start on audio detection).

        Args:
            armed: If True, opens the stream but waits for audio above
                   threshold before writing to disk.
            threshold: Peak level (0.0-1.0) to trigger recording.
                       Default 0.005 ≈ -46 dB.
        """
        if self._recording or self._armed:
            return

        self._device_info = self._get_loopback_device()
        self._channels = self._device_info["maxInputChannels"]
        self._rate = int(self._device_info["defaultSampleRate"])
        pa_format = pyaudio.paInt16

        self._bytes_written = 0
        self._duration = 0.0
        self._paused = False
        self._pre_roll.clear()

        # Clear any stale data in write queue
        while not self._write_queue.empty():
            try:
                self._write_queue.get_nowait()
            except queue.Empty:
                break

        # Boost process priority for glitch-free capture
        _set_process_priority(high=True)

        if armed:
            # Armed mode: don't open WAV yet, wait for audio
            self._armed = True
            self._armed_threshold = threshold
            self._recording = False
        else:
            # Immediate recording
            self._armed = False
            self._open_wav()
            self._start_writer()
            self._recording = True

        def callback(in_data, frame_count, time_info, status):
            # Always measure peak for the level meter
            peak = self._measure_peak(in_data)
            self._peak_level = peak

            # Armed mode: buffer frames, trigger on audio
            if self._armed and not self._recording:
                self._pre_roll.append(in_data)
                if peak >= self._armed_threshold:
                    # Audio detected — open file, start writer, flush pre-roll
                    self._open_wav()
                    self._start_writer()
                    self._flush_pre_roll()
                    self._recording = True
                    self._armed = False
                return (in_data, pyaudio.paContinue)

            # Normal recording — push to queue (never blocks)
            if self._recording and not self._paused:
                self._enqueue_write(in_data)

            return (in_data, pyaudio.paContinue)

        # Larger buffer = more tolerance for OS scheduling jitter.
        # 40ms gives ~2x headroom over the default 20ms at the cost of
        # slightly higher latency (irrelevant for loopback capture).
        frames_per_buffer = int(self._rate * 0.04)  # 40ms chunks

        try:
            self._stream = self._pa.open(
                format=pa_format,
                channels=self._channels,
                rate=self._rate,
                input=True,
                input_device_index=self._device_info["index"],
                frames_per_buffer=frames_per_buffer,
                stream_callback=callback,
            )
        except OSError as e:
            _set_process_priority(high=False)
            self._stop_writer()
            if self._wf:
                self._wf.close()
                self._wf = None
            self._recording = False
            self._armed = False
            raise RuntimeError(
                f"WASAPI open failed: {e}. "
                f"Device: {self._device_info['name']}, "
                f"Rate: {self._rate}Hz, Ch: {self._channels}"
            )

    def pause(self):
        """Pause recording (ad skip)."""
        self._paused = True

    def resume(self):
        """Resume recording after pause."""
        self._paused = False

    @property
    def is_paused(self) -> bool:
        return self._paused

    @property
    def is_armed(self) -> bool:
        return self._armed and not self._recording

    @property
    def duration(self) -> float:
        return self._duration

    @property
    def peak_level(self) -> float:
        return self._peak_level

    @property
    def is_recording(self) -> bool:
        return self._recording

    @property
    def is_listening(self) -> bool:
        """True if stream is open (armed or recording)."""
        return self._stream is not None and (self._recording or self._armed)

    def stop(self) -> Path:
        """Stop recording and return path to WAV file."""
        self._recording = False
        self._armed = False
        if self._stream:
            self._stream.stop_stream()
            self._stream.close()
            self._stream = None
        # Drain remaining frames to disk
        self._stop_writer()
        if self._wf:
            self._wf.close()
            self._wf = None
        self._pa.terminate()
        _set_process_priority(high=False)
        return self.output_path

    def cleanup(self):
        """Clean up resources without saving."""
        self._recording = False
        self._armed = False
        if self._stream:
            try:
                self._stream.stop_stream()
                self._stream.close()
            except Exception:
                pass
        self._stop_writer()
        if self._wf:
            self._wf.close()
        self._pa.terminate()
        _set_process_priority(high=False)
        if self.output_path.exists():
            self.output_path.unlink()
