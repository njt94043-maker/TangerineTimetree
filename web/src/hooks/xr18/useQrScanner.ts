import { useRef, useState, useCallback, useEffect } from 'react';
import { parsePairingUri, type PairingInfo } from './protocol';

/**
 * QR code scanner using BarcodeDetector API (Chrome/Edge).
 * Falls back to manual entry if BarcodeDetector is not available.
 */
export function useQrScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [scannedResult, setScannedResult] = useState<PairingInfo | null>(null);
  const detectorRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Check for BarcodeDetector support
    const supported = typeof (window as any).BarcodeDetector !== 'undefined';
    setIsSupported(supported);
    if (supported) {
      detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
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
        const barcodes = await detectorRef.current.detect(videoElement);
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
  }, []);

  const stopScanning = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsScanning(false);
  }, []);

  return { isScanning, isSupported, scannedResult, startScanning, stopScanning, setScannedResult };
}
