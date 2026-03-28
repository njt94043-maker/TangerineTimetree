package com.thegreentangerine.gigbooks.data.xr18

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.YuvImage
import android.util.Log
import android.util.Size
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.*
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.Executors

/**
 * Manages CameraX for video recording and preview frame capture.
 * Bind to a LifecycleOwner + PreviewView before use.
 */
class CameraRecordingManager(private val context: Context) {

    companion object {
        private const val TAG = "CameraRecording"
    }

    private var cameraProvider: ProcessCameraProvider? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var preview: Preview? = null
    private var activeRecording: Recording? = null
    private var lastPreviewFrame: ByteArray? = null
    private val analysisExecutor = Executors.newSingleThreadExecutor()
    private val scanScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    /** When set, each camera frame is scanned for QR codes. Called with the result on detection. */
    var onQrCodeScanned: ((PairingInfo) -> Unit)? = null

    /** Enable/disable QR scanning on camera frames. */
    var qrScanEnabled: Boolean = false

    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording

    private val _isBound = MutableStateFlow(false)
    val isBound: StateFlow<Boolean> = _isBound

    /**
     * Bind CameraX to lifecycle with Preview + VideoCapture + ImageAnalysis.
     */
    fun bind(lifecycleOwner: LifecycleOwner, previewView: PreviewView, settings: PhoneSettings = PhoneSettings()) {
        val future = ProcessCameraProvider.getInstance(context)
        future.addListener({
            val provider = future.get()
            cameraProvider = provider
            rebind(provider, lifecycleOwner, previewView, settings)
        }, ContextCompat.getMainExecutor(context))
    }

    private fun rebind(
        provider: ProcessCameraProvider,
        lifecycleOwner: LifecycleOwner,
        previewView: PreviewView,
        settings: PhoneSettings,
    ) {
        // Don't rebind during recording — it kills the active recording
        if (_isRecording.value) {
            Log.w(TAG, "Ignoring rebind during active recording")
            return
        }

        try {
            provider.unbindAll()

            preview = Preview.Builder().build().also {
                it.surfaceProvider = previewView.surfaceProvider
            }

            val quality = when (settings.resolution) {
                "4K" -> Quality.UHD
                "720p" -> Quality.HD
                else -> Quality.FHD  // 1080p default
            }

            // Clamp framerate to safe range (device may not support requested rate)
            val safeFramerate = settings.framerate.coerceIn(15, 60)

            val recorder = Recorder.Builder()
                .setQualitySelector(QualitySelector.from(quality, FallbackStrategy.higherQualityOrLowerThan(quality)))
                .build()
            videoCapture = VideoCapture.Builder(recorder)
                .setTargetFrameRate(android.util.Range(safeFramerate, safeFramerate))
                .build()

            // ImageAnalysis for preview frame capture + QR scanning
            // Use 640x480 for reliable QR detection (320x240 is too low for ML Kit)
            imageAnalysis = ImageAnalysis.Builder()
                .setTargetResolution(Size(640, 480))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also { analysis ->
                    @androidx.camera.core.ExperimentalGetImage
                    analysis.setAnalyzer(analysisExecutor) { imageProxy ->
                        // QR scanning: MUST run BEFORE imageProxyToJpeg because JPEG conversion
                        // consumes YUV buffer positions, leaving empty data for ML Kit.
                        // Also skip JPEG capture during scanning — we're not connected so no preview needed.
                        if (qrScanEnabled && onQrCodeScanned != null) {
                            scanScope.launch {
                                try {
                                    val info = QrScannerHelper.scanImageProxy(imageProxy)
                                    if (info != null) {
                                        qrScanEnabled = false
                                        onQrCodeScanned?.invoke(info)
                                    }
                                } catch (_: Exception) {
                                    // ML Kit can fail on some frames — ignore
                                } finally {
                                    imageProxy.close()
                                }
                            }
                        } else {
                            // Normal mode: capture preview frame as JPEG for companion protocol
                            lastPreviewFrame = imageProxyToJpeg(imageProxy)
                            imageProxy.close()
                        }
                    }
                }

            val cameraSelector = if (settings.cameraFacing == "front") {
                CameraSelector.DEFAULT_FRONT_CAMERA
            } else {
                CameraSelector.DEFAULT_BACK_CAMERA
            }

            provider.bindToLifecycle(
                lifecycleOwner,
                cameraSelector,
                preview,
                videoCapture,
                imageAnalysis,
            )
            _isBound.value = true
        } catch (e: Exception) {
            Log.e(TAG, "Camera rebind failed: ${e.message}", e)
            // Try again with safe defaults if the requested settings failed
            if (settings.framerate != 30 || settings.resolution != "1080p" || settings.cameraFacing != "back") {
                Log.w(TAG, "Retrying with safe defaults")
                rebind(provider, lifecycleOwner, previewView, PhoneSettings())
            }
        }
    }

    /**
     * Start video recording to the given output directory.
     * Returns the output file.
     */
    fun startRecording(outputDir: File, sessionName: String): File {
        val capture = videoCapture ?: throw IllegalStateException("Camera not bound")
        outputDir.mkdirs()
        val file = File(outputDir, "${sessionName}_${System.currentTimeMillis()}.mp4")
        val outputOptions = FileOutputOptions.Builder(file).build()

        activeRecording = capture.output
            .prepareRecording(context, outputOptions)
            .start(ContextCompat.getMainExecutor(context)) { event ->
                when (event) {
                    is VideoRecordEvent.Finalize -> {
                        _isRecording.value = false
                    }
                }
            }
        _isRecording.value = true
        return file
    }

    fun stopRecording() {
        activeRecording?.stop()
        activeRecording = null
    }

    /** Returns last captured preview frame as JPEG bytes, or null. */
    fun capturePreviewFrame(): ByteArray? = lastPreviewFrame

    fun applySettings(lifecycleOwner: LifecycleOwner, previewView: PreviewView, settings: PhoneSettings) {
        val provider = cameraProvider ?: return
        rebind(provider, lifecycleOwner, previewView, settings)
    }

    fun release() {
        activeRecording?.stop()
        activeRecording = null
        cameraProvider?.unbindAll()
        analysisExecutor.shutdown()
        scanScope.cancel()
        _isBound.value = false
    }

    private fun imageProxyToJpeg(imageProxy: ImageProxy): ByteArray? {
        return try {
            val planes = imageProxy.planes
            val yBuffer = planes[0].buffer
            val uBuffer = planes[1].buffer
            val vBuffer = planes[2].buffer
            val ySize = yBuffer.remaining()
            val uSize = uBuffer.remaining()
            val vSize = vBuffer.remaining()
            val nv21 = ByteArray(ySize + uSize + vSize)
            yBuffer.get(nv21, 0, ySize)
            vBuffer.get(nv21, ySize, vSize)
            uBuffer.get(nv21, ySize + vSize, uSize)
            val yuvImage = YuvImage(nv21, ImageFormat.NV21, imageProxy.width, imageProxy.height, null)
            val out = ByteArrayOutputStream()
            yuvImage.compressToJpeg(android.graphics.Rect(0, 0, imageProxy.width, imageProxy.height), 60, out)
            out.toByteArray()
        } catch (_: Exception) { null }
    }
}
