package com.thegreentangerine.gigbooks.data.xr18

import android.graphics.Bitmap
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * ML Kit barcode scanner for XR18Studio QR codes.
 * Call [scanBitmap] with a camera frame to detect pairing URIs.
 */
object QrScannerHelper {

    private val scanner = BarcodeScanning.getClient()

    /**
     * Scan a bitmap for QR codes containing xr18studio:// URIs.
     * Returns the first valid PairingInfo, or null.
     */
    suspend fun scanBitmap(bitmap: Bitmap): PairingInfo? =
        suspendCancellableCoroutine { cont ->
            val image = InputImage.fromBitmap(bitmap, 0)
            scanner.process(image)
                .addOnSuccessListener { barcodes ->
                    val info = barcodes
                        .filter { it.format == Barcode.FORMAT_QR_CODE }
                        .mapNotNull { it.rawValue }
                        .firstNotNullOfOrNull { PhoneProtocol.parsePairingUri(it) }
                    cont.resume(info)
                }
                .addOnFailureListener { cont.resume(null) }
        }

    /**
     * Scan from a CameraX ImageProxy (for real-time analysis).
     */
    @androidx.camera.core.ExperimentalGetImage
    suspend fun scanImageProxy(imageProxy: androidx.camera.core.ImageProxy): PairingInfo? =
        suspendCancellableCoroutine { cont ->
            val mediaImage = imageProxy.image
            if (mediaImage == null) {
                cont.resume(null)
                return@suspendCancellableCoroutine
            }
            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
            scanner.process(image)
                .addOnSuccessListener { barcodes ->
                    val info = barcodes
                        .filter { it.format == Barcode.FORMAT_QR_CODE }
                        .mapNotNull { it.rawValue }
                        .firstNotNullOfOrNull { PhoneProtocol.parsePairingUri(it) }
                    cont.resume(info)
                }
                .addOnFailureListener { cont.resume(null) }
        }
}
