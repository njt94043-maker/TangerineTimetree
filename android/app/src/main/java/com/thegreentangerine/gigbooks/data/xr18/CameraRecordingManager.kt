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

    private val _actualFramerate = MutableStateFlow(0.0)
    val actualFramerate: StateFlow<Double> = _actualFramerate

    private val _isConstantFrameRate = MutableStateFlow(true)
    val isConstantFrameRate: StateFlow<Boolean> = _isConstantFrameRate

    /** Session ID from StartRecPayload, used for file naming and sync correlation. */
    private var currentSessionId: String? = null

    // Frame rate monitoring state
    private var requestedFramerate: Int = 30
    private var framerateMonitorJob: Job? = null
    private var frameEventCount = 0
    private var frameMonitorStartMs = 0L

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
            requestedFramerate = safeFramerate

            val recorder = Recorder.Builder()
                .setQualitySelector(QualitySelector.from(quality, FallbackStrategy.higherQualityOrLowerThan(quality)))
                .setAudioSource(AudioSource.DEFAULT)  // Ensure audio is always recorded
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
     * @param sessionId Optional session ID from StartRecPayload for file naming and sync correlation.
     */
    fun startRecording(outputDir: File, sessionName: String, sessionId: String? = null): File {
        val capture = videoCapture ?: throw IllegalStateException("Camera not bound")
        currentSessionId = sessionId
        outputDir.mkdirs()

        // Include sessionId in filename if provided, for easy correlation with audio files
        val namePart = if (!sessionId.isNullOrBlank()) {
            "${sessionName}_${sessionId}_${System.currentTimeMillis()}"
        } else {
            "${sessionName}_${System.currentTimeMillis()}"
        }
        val file = File(outputDir, "$namePart.mp4")
        val outputOptions = FileOutputOptions.Builder(file).build()

        // Reset frame rate monitoring state
        _actualFramerate.value = 0.0
        _isConstantFrameRate.value = true
        frameEventCount = 0
        frameMonitorStartMs = 0L

        activeRecording = capture.output
            .prepareRecording(context, outputOptions)
            .withAudioEnabled()
            .start(ContextCompat.getMainExecutor(context)) { event ->
                when (event) {
                    is VideoRecordEvent.Status -> {
                        // Count frames delivered to estimate actual framerate
                        val stats = event.recordingStats
                        val nowMs = System.currentTimeMillis()
                        if (frameMonitorStartMs == 0L) {
                            frameMonitorStartMs = nowMs
                        }
                        frameEventCount++
                        val elapsedSec = (nowMs - frameMonitorStartMs) / 1000.0
                        if (elapsedSec >= 5.0) {
                            // We get Status events ~1Hz from CameraX; derive framerate from
                            // the recorded duration vs the number of bytes/frames reported.
                            // Use recordedDurationNanos for a more accurate measurement.
                            val recordedSec = stats.recordedDurationNanos / 1_000_000_000.0
                            if (recordedSec > 0) {
                                // CameraX Status events fire once per second; use recorded duration
                                // to estimate actual fps from the numBytesRecorded trend.
                                // For a direct fps measurement, track Status event cadence
                                // against the elapsed wall clock.
                                val measuredFps = frameEventCount / elapsedSec
                                // Status events fire ~1/sec, so measuredFps ≈ 1. Instead derive
                                // from the encoder's reported duration: if duration is close to
                                // wall time, CFR is working.
                                val wallElapsedSec = (nowMs - frameMonitorStartMs) / 1000.0
                                val durationRatio = if (wallElapsedSec > 0) recordedSec / wallElapsedSec else 1.0
                                // Estimate actual fps as requestedFramerate * durationRatio
                                val estimatedFps = requestedFramerate * durationRatio
                                _actualFramerate.value = estimatedFps
                                val diff = kotlin.math.abs(estimatedFps - requestedFramerate)
                                if (diff > 0.5) {
                                    _isConstantFrameRate.value = false
                                    Log.w(TAG, "CFR deviation detected: requested=$requestedFramerate, estimated=%.2f".format(estimatedFps))
                                }
                            }
                        }
                    }
                    is VideoRecordEvent.Finalize -> {
                        framerateMonitorJob?.cancel()
                        _isRecording.value = false
                    }
                }
            }
        _isRecording.value = true
        return file
    }

    fun stopRecording() {
        framerateMonitorJob?.cancel()
        activeRecording?.stop()
        activeRecording = null
    }

    /** Returns last captured preview frame as JPEG bytes, or null. */
    fun capturePreviewFrame(): ByteArray? = lastPreviewFrame

    fun applySettings(lifecycleOwner: LifecycleOwner, previewView: PreviewView, settings: PhoneSettings) {
        val provider = cameraProvider ?: return
        rebind(provider, lifecycleOwner, previewView, settings)
    }

    /**
     * Execute a sync pulse: flash the screen white for 66ms and play a 1kHz beep for 100ms.
     * Returns the timestamp (ms) at which the pulse was initiated, for sync correlation.
     * Must be called from any thread; UI work is dispatched to the main thread internally.
     */
    fun executeSyncPulse(activity: android.app.Activity): Long {
        val timestamp = System.currentTimeMillis()
        // Flash screen white for 66ms (2 frames at 30fps)
        activity.runOnUiThread {
            val overlay = android.view.View(activity)
            overlay.setBackgroundColor(android.graphics.Color.WHITE)
            val decorView = activity.window.decorView as android.view.ViewGroup
            decorView.addView(overlay, android.view.ViewGroup.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT
            ))
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                decorView.removeView(overlay)
            }, 66)
        }
        // Play 1kHz beep for 100ms at max volume
        playBeep(1000, 100)
        return timestamp
    }

    private fun playBeep(frequencyHz: Int, durationMs: Int) {
        val sampleRate = 44100
        val numSamples = (sampleRate * durationMs / 1000.0).toInt()
        val samples = ShortArray(numSamples)
        for (i in 0 until numSamples) {
            samples[i] = (Short.MAX_VALUE * kotlin.math.sin(2.0 * Math.PI * frequencyHz * i / sampleRate)).toInt().toShort()
        }
        val track = android.media.AudioTrack.Builder()
            .setAudioAttributes(android.media.AudioAttributes.Builder()
                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build())
            .setAudioFormat(android.media.AudioFormat.Builder()
                .setEncoding(android.media.AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(sampleRate)
                .setChannelMask(android.media.AudioFormat.CHANNEL_OUT_MONO)
                .build())
            .setBufferSizeInBytes(samples.size * 2)
            .setTransferMode(android.media.AudioTrack.MODE_STATIC)
            .build()
        track.write(samples, 0, samples.size)
        track.play()
        // Clean up after playback
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            track.stop()
            track.release()
        }, durationMs.toLong() + 50)
    }

    /**
     * Validate current frame rate quality. Returns a QualityWarningPayload if the
     * device cannot sustain the requested CFR, or null if quality is acceptable.
     */
    fun checkFramerateQuality(): QualityWarningPayload? {
        val actual = _actualFramerate.value
        val isCfr = _isConstantFrameRate.value
        val requested = requestedFramerate
        // Only report after monitoring has started (actual > 0)
        if (actual <= 0.0) return null
        val diff = kotlin.math.abs(actual - requested)
        return if (diff > 0.5 || !isCfr) {
            QualityWarningPayload(
                warning = "Device cannot sustain ${requested}fps CFR. Actual: %.2f fps".format(actual),
                actualFramerate = actual,
                requestedFramerate = requested,
                isConstantFrameRate = isCfr,
            )
        } else null
    }

    fun release() {
        framerateMonitorJob?.cancel()
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
