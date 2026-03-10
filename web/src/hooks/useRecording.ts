/**
 * useRecording — Web recording hook for S41.
 *
 * Handles getUserMedia, MediaRecorder, input device enumeration,
 * camera toggle, input level metering, and count-in coordination.
 *
 * Decisions: D-132 (camera local), D-133 (USB interfaces), D-140 (overdub),
 * D-141 (click during recording), D-142 (count-in), D-150 (record button).
 */
import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingState = 'idle' | 'count-in' | 'recording' | 'done';

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export interface RecordingResult {
  audioBlob: Blob;
  videoBlob: Blob | undefined;
  durationSeconds: number;
}

export interface UseRecordingReturn {
  state: RecordingState;
  elapsedSeconds: number;
  inputLevel: number; // 0-1 normalized RMS
  audioDevices: AudioDevice[];
  selectedDeviceId: string;
  cameraEnabled: boolean;
  cameraStream: MediaStream | null;
  lastResult: RecordingResult | null;

  enumerateDevices: () => Promise<void>;
  selectDevice: (deviceId: string) => void;
  toggleCamera: (enabled: boolean) => void;
  startRecording: (countInMs?: number) => Promise<void>;
  stopRecording: () => void;
  discardResult: () => void;
}

export function useRecording(): UseRecordingReturn {
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [inputLevel, setInputLevel] = useState(0);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [lastResult, setLastResult] = useState<RecordingResult | null>(null);

  // Refs for recording state
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  // Enumerate audio input devices (D-133)
  const enumerateDevicesAction = useCallback(async () => {
    try {
      // Need a brief getUserMedia call to get device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach(t => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Input ${d.deviceId.slice(0, 8)}` }));
      setAudioDevices(inputs);
      if (inputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(inputs[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  }, [selectedDeviceId]);

  // Select input device
  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
  }, []);

  // Toggle camera (D-132)
  const toggleCamera = useCallback(async (enabled: boolean) => {
    setCameraEnabled(enabled);
    if (enabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        setCameraStream(stream);
      } catch (err) {
        console.error('Camera access failed:', err);
        setCameraEnabled(false);
      }
    } else {
      setCameraStream(prev => {
        prev?.getTracks().forEach(t => t.stop());
        return null;
      });
    }
  }, []);

  // Input level meter using AnalyserNode
  const startLevelMeter = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      setInputLevel(Math.min(1, rms * 3)); // scale up for visual
      levelRafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (levelRafRef.current) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = 0;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setInputLevel(0);
  }, []);

  // Start recording
  const startRecording = useCallback(async (countInMs = 0) => {
    setLastResult(null);

    // Get audio stream with selected device
    const audioConstraints: MediaStreamConstraints = {
      audio: selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId } }
        : true,
    };

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      audioStreamRef.current = audioStream;
      startLevelMeter(audioStream);

      // Count-in phase (D-142)
      if (countInMs > 0) {
        setState('count-in');
        await new Promise(resolve => setTimeout(resolve, countInMs));
      }

      // Start audio recording
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const audioRecorder = new MediaRecorder(audioStream, { mimeType });
      audioChunksRef.current = [];
      audioRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      audioRecorderRef.current = audioRecorder;
      audioRecorder.start(1000); // 1s chunks

      // Start video recording if camera enabled (D-132)
      if (cameraEnabled && cameraStream) {
        const videoMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : 'video/webm';
        const videoRecorder = new MediaRecorder(cameraStream, { mimeType: videoMime });
        videoChunksRef.current = [];
        videoRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) videoChunksRef.current.push(e.data);
        };
        videoRecorderRef.current = videoRecorder;
        videoRecorder.start(1000);
      }

      // Timer
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 250);

      setState('recording');
    } catch (err) {
      console.error('Recording start failed:', err);
      setState('idle');
    }
  }, [selectedDeviceId, cameraEnabled, cameraStream, startLevelMeter]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const durationSeconds = (Date.now() - startTimeRef.current) / 1000;

    const finishAudio = new Promise<Blob>((resolve) => {
      const recorder = audioRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
        return;
      }
      recorder.onstop = () => {
        resolve(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
      };
      recorder.stop();
    });

    const finishVideo = new Promise<Blob | undefined>((resolve) => {
      const recorder = videoRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(videoChunksRef.current.length > 0
          ? new Blob(videoChunksRef.current, { type: 'video/webm' })
          : undefined);
        return;
      }
      recorder.onstop = () => {
        resolve(videoChunksRef.current.length > 0
          ? new Blob(videoChunksRef.current, { type: 'video/webm' })
          : undefined);
      };
      recorder.stop();
    });

    Promise.all([finishAudio, finishVideo]).then(([audioBlob, videoBlob]) => {
      setLastResult({ audioBlob, videoBlob, durationSeconds });
      setState('done');
    });

    // Stop streams
    audioStreamRef.current?.getTracks().forEach(t => t.stop());
    audioStreamRef.current = null;
    stopLevelMeter();
  }, [stopLevelMeter]);

  // Discard result and return to idle
  const discardResult = useCallback(() => {
    setLastResult(null);
    setElapsedSeconds(0);
    setState('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      audioStreamRef.current?.getTracks().forEach(t => t.stop());
      cameraStream?.getTracks().forEach(t => t.stop());
      stopLevelMeter();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    elapsedSeconds,
    inputLevel,
    audioDevices,
    selectedDeviceId,
    cameraEnabled,
    cameraStream,
    lastResult,
    enumerateDevices: enumerateDevicesAction,
    selectDevice,
    toggleCamera,
    startRecording,
    stopRecording,
    discardResult,
  };
}
