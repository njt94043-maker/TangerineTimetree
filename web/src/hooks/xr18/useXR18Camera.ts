import { useRef, useState, useCallback, useEffect } from 'react';
import type { PhoneSettings } from './protocol';

/**
 * Camera + MediaRecorder hook for XR18 companion.
 * Manages getUserMedia, video preview, recording, and frame capture.
 */
export function useXR18Camera() {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /** Start camera with given settings. */
  const startCamera = useCallback(async (settings?: PhoneSettings) => {
    // Stop any existing stream first
    cameraStream?.getTracks().forEach(t => t.stop());

    const facing = settings?.cameraFacing === 'front' ? 'user' : 'environment';
    const targetFrameRate = Math.min(Math.max(settings?.framerate ?? 30, 15), 60);

    // Try with exact framerate first (CFR enforcement), fall back to ideal
    let stream: MediaStream;
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: settings?.resolution === '4K' ? 3840 : settings?.resolution === '720p' ? 1280 : 1920 },
          height: { ideal: settings?.resolution === '4K' ? 2160 : settings?.resolution === '720p' ? 720 : 1080 },
          frameRate: { exact: targetFrameRate },
        },
        audio: {
          sampleRate: { ideal: 48000 },  // Match session sample rate
          channelCount: { ideal: 1 },
        },
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      // exact framerate not supported — retry with ideal
      const fallbackConstraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: settings?.resolution === '4K' ? 3840 : settings?.resolution === '720p' ? 1280 : 1920 },
          height: { ideal: settings?.resolution === '4K' ? 2160 : settings?.resolution === '720p' ? 720 : 1080 },
          frameRate: { ideal: targetFrameRate },
        },
        audio: {
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
        },
      };
      stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
    }

    setCameraStream(stream);

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }

    return stream;
  }, [cameraStream]);

  /** Start MediaRecorder recording. */
  const startRecording = useCallback(() => {
    if (!cameraStream) return;
    chunksRef.current = [];
    setRecordedBlob(null);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

    const recorder = new MediaRecorder(cameraStream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,  // 8 Mbps for consistent quality
    });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      setIsRecording(false);
    };

    recorder.start(1000); // timeslice: chunk every 1s
    setIsRecording(true);
  }, [cameraStream]);

  /** Stop recording. */
  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

  /** Capture current preview frame as base64 JPEG. */
  const capturePreviewFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    // Low-res for preview
    const scale = Math.min(320 / video.videoWidth, 240 / video.videoHeight);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Return base64 without the data:image/jpeg;base64, prefix
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    return dataUrl.split(',')[1] ?? null;
  }, []);

  /** Apply new settings by restarting the camera stream. */
  const applySettings = useCallback(async (settings: PhoneSettings) => {
    await startCamera(settings);
  }, [startCamera]);

  /** Stop everything. */
  const stopCamera = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setIsRecording(false);
  }, [cameraStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      cameraStream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return {
    videoRef,
    cameraStream,
    isRecording,
    recordedBlob,
    startCamera,
    startRecording,
    stopRecording,
    capturePreviewFrame,
    applySettings,
    stopCamera,
  };
}
