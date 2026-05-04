package com.thegreentangerine.gigbooks.data.xr18

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.YuvImage
import android.util.Log
import android.util.Size
import android.view.Surface
import android.view.WindowManager
import androidx.camera.core.*
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
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
 * Bind to a LifecycleOwner before use.
 *
 * `previewView` is nullable. Pass a real PreviewView for screens that show the
 * live camera (PeerScreen). Pass null for hidden-bind use cases (orchestrator
 * recording its own selfie video while the prompter UI takes the screen) — only
 * VideoCapture + ImageAnalysis are bound, no preview surface needed.
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
    /**
     * Live preview JPEG flow — emits at camera fps (whatever ImageAnalysis delivers).
     * Local-device consumers (Gig Mode self-tile) collect it for real-time preview;
     * network consumers (PeerOrchestratorClient) snapshot via [capturePreviewFrame]
     * and apply their own polling cadence to limit hotspot bandwidth.
     */
    private val _previewFlow = MutableStateFlow<ByteArray?>(null)
    val previewFlow: StateFlow<ByteArray?> = _previewFlow
    private val analysisExecutor = Executors.newSingleThreadExecutor()
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
     * Bind CameraX to lifecycle. Pass `previewView = null` for hidden recording
     * (orchestrator-as-camera) — only VideoCapture + ImageAnalysis are bound.
     */
    fun bind(lifecycleOwner: LifecycleOwner, previewView: PreviewView?, settings: PhoneSettings = PhoneSettings()) {
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
        previewView: PreviewView?,
        settings: PhoneSettings,
    ) {
        // Don't rebind during recording — it kills the active recording
        if (_isRecording.value) {
            Log.w(TAG, "Ignoring rebind during active recording")
            return
        }

        try {
            provider.unbindAll()

            val targetRotation = effectiveRotation(settings)

            preview = previewView?.let { pv ->
                Preview.Builder()
                    .setTargetRotation(targetRotation)
                    .build()
                    .also { it.surfaceProvider = pv.surfaceProvider }
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
                .setAudioSource(android.media.MediaRecorder.AudioSource.DEFAULT)  // Ensure audio is always recorded
                .build()
            videoCapture = VideoCapture.Builder(recorder)
                .setTargetFrameRate(android.util.Range(safeFramerate, safeFramerate))
                .setTargetRotation(targetRotation)
                .build()

            // ImageAnalysis for preview frame capture (orchestrator/peer thumbnail).
            // Aspect ratio MUST match VideoCapture (16:9 for HD/FHD/UHD) so the
            // thumbnail shows the same framing as the recorded MP4 — Nathan's S123
            // ask: WYSIWYG coverage for placement decisions. setTargetResolution()
            // would have given a 4:3 frame from the sensor's ImageAnalysis surface,
            // which is a different crop than VideoCapture and confuses placement.
            val analysisResolution = ResolutionSelector.Builder()
                .setAspectRatioStrategy(AspectRatioStrategy.RATIO_16_9_FALLBACK_AUTO_STRATEGY)
                .build()
            imageAnalysis = ImageAnalysis.Builder()
                .setResolutionSelector(analysisResolution)
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setTargetRotation(targetRotation)
                .build()
                .also { analysis ->
                    @androidx.camera.core.ExperimentalGetImage
                    analysis.setAnalyzer(analysisExecutor) { imageProxy ->
                        val jpeg = imageProxyToJpeg(imageProxy)
                        if (jpeg != null) _previewFlow.value = jpeg
                        imageProxy.close()
                    }
                }

            val cameraSelector = if (settings.cameraFacing == "front") {
                CameraSelector.DEFAULT_FRONT_CAMERA
            } else {
                CameraSelector.DEFAULT_BACK_CAMERA
            }

            val useCases = mutableListOf<UseCase>()
            preview?.let { useCases.add(it) }
            videoCapture?.let { useCases.add(it) }
            imageAnalysis?.let { useCases.add(it) }

            provider.bindToLifecycle(
                lifecycleOwner,
                cameraSelector,
                *useCases.toTypedArray(),
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
     * Apply rotation to bound use cases without rebinding. Cheap — no camera
     * teardown. Safe to call mid-recording.
     */
    fun applyRotation(settings: PhoneSettings) {
        val rot = effectiveRotation(settings)
        preview?.targetRotation = rot
        videoCapture?.targetRotation = rot
        imageAnalysis?.targetRotation = rot
    }

    /**
     * Resolves [PhoneSettings] rotation to a [Surface.ROTATION_*] constant.
     * If `useAutoRotation = true`, reads the device's current display rotation —
     * mounting the phone landscape gives landscape video, portrait gives portrait,
     * no manual setting needed. Manual override `rotationDegrees` is honoured when
     * `useAutoRotation = false`.
     */
    private fun effectiveRotation(settings: PhoneSettings): Int {
        if (!settings.useAutoRotation) return rotationToSurface(settings.rotationDegrees)
        return try {
            @Suppress("DEPRECATION")
            (context.getSystemService(WindowManager::class.java))?.defaultDisplay?.rotation ?: Surface.ROTATION_0
        } catch (_: Exception) {
            Surface.ROTATION_0
        }
    }

    private fun rotationToSurface(degrees: Int): Int = when (degrees) {
        90 -> Surface.ROTATION_90
        180 -> Surface.ROTATION_180
        270 -> Surface.ROTATION_270
        else -> Surface.ROTATION_0
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
                            val recordedSec = stats.recordedDurationNanos / 1_000_000_000.0
                            if (recordedSec > 0) {
                                val wallElapsedSec = (nowMs - frameMonitorStartMs) / 1000.0
                                val durationRatio = if (wallElapsedSec > 0) recordedSec / wallElapsedSec else 1.0
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
    fun capturePreviewFrame(): ByteArray? = _previewFlow.value

    fun applySettings(lifecycleOwner: LifecycleOwner, previewView: PreviewView?, settings: PhoneSettings) {
        val provider = cameraProvider ?: return
        // CameraX bindToLifecycle must run on the main thread. Settings pushes arrive
        // from BT/TCP/relay handler threads — dispatch to main to avoid crashes.
        ContextCompat.getMainExecutor(context).execute {
            val state = lifecycleOwner.lifecycle.currentState
            if (!state.isAtLeast(androidx.lifecycle.Lifecycle.State.STARTED)) {
                Log.w(TAG, "Skipping applySettings — lifecycle is $state")
                return@execute
            }
            rebind(provider, lifecycleOwner, previewView, settings)
        }
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
            val raw = out.toByteArray()

            // Match the thumbnail orientation to what VideoCapture writes to the MP4.
            // ImageAnalysis frames come out in the camera sensor's native orientation;
            // we need to rotate by imageInfo.rotationDegrees to get the upright frame.
            val rotation = imageProxy.imageInfo.rotationDegrees
            if (rotation == 0) return raw

            val bmp = BitmapFactory.decodeByteArray(raw, 0, raw.size) ?: return raw
            val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
            val rotated = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, matrix, true)
            val out2 = ByteArrayOutputStream()
            rotated.compress(Bitmap.CompressFormat.JPEG, 60, out2)
            bmp.recycle()
            if (rotated !== bmp) rotated.recycle()
            out2.toByteArray()
        } catch (_: Exception) { null }
    }
}
