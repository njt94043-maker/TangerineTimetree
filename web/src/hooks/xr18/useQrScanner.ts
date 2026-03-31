import { useRef, useState, useCallback, useEffect } from 'react';
import { parsePairingUri, type PairingInfo } from './protocol';

/**
 * QR code scanner using BarcodeDetector API (Chrome/Edge).
 * Falls back to manual entry if BarcodeDetector is not available.
 */
interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}

export function useQrScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [isSupported] = useState(() => {
    return typeof (window as unknown as Record<string, unknown>).BarcodeDetector !== 'undefined';
  });
  const [scannedResult, setScannedResult] = useState<PairingInfo | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Initialize BarcodeDetector if supported
    const BarcodeDetectorCtor = (window as unknown as Record<string, unknown>).BarcodeDetector as
      (new (opts: { formats: string[] }) => BarcodeDetectorInstance) | undefined;
    if (BarcodeDetectorCtor) {
      detectorRef.current = new BarcodeDetectorCtor({ formats: ['qr_code'] });
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const stopScanning = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsScanning(false);
  }, []);

  /** Start scanning frames from a video element. */
  const startScanning = useCallback((videoElement: HTMLVideoElement) => {
    if (!detectorRef.current) return;
    setIsScanning(true);
    setScannedResult(null);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      if (videoElement.videoWidth === 0) return;
      try {
        const barcodes = await detectorRef.current!.detect(videoElement);
        for (const barcode of barcodes) {
          const info = parsePairingUri(barcode.rawValue);
          if (info) {
            setScannedResult(info);
            stopScanning();
            return;
          }
        }
      } catch {
        // detection failed, retry
      }
    }, 500); // scan every 500ms
  }, [stopScanning]);

  return { isScanning, isSupported, scannedResult, startScanning, stopScanning, setScannedResult };
}
