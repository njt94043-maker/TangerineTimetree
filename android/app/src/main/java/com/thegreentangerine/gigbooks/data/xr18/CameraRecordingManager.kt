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

        /**
         * S150 P3 bitrate presets. Pre-approved values from brief §6.3.
         * Falls back to Standard for any unrecognised bucket name so old
         * peers without the qualityBucket field still get sensible defaults.
         */
        fun bitrateForBucket(bucket: String): Int = when (bucket) {
            "Eco" -> 4_000_000
            "High" -> 20_000_000
            else -> 10_000_000  // Standard + any unknown
        }

        /** Approximate minutes-per-GB at a given bitrate. 1 GB ≈ 8 Gbits. */
        fun minutesPerGb(bitrateBps: Int): Int =
            if (bitrateBps <= 0) 0 else (8L * 1_000_000_000L / bitrateBps / 60L).toInt()

        /**
         * S155 / F4 / F5: sanitise a gig name + date into the filename prefix
         * used in `<gigSlug>__<role>_<sessId>_<ts>.mp4`. Keeps [A-Za-z0-9._]
         * verbatim and collapses every other run (including spaces) to a
         * single DASH. Dash is the rig + MS host convention — using anything
         * else (S155's `_`) means the APK slug doesn't agree with the
         * D:/Gigs/<name>/ dir for inputs like "testing 2" → rig "testing-2"
         * but phone "testing_2" → pull-videos filter misses. F5 aligns both.
         *
         * F4: when `gigDate` is a YYYYMMDD string (8 digits), it's appended as
         * `<name>-<YYYYMMDD>`.
         *
         * The companion `slugifyForWizard()` applies the same rule but is
         * used at gig-name-entry time so what the user types and what the
         * filesystem stores stay aligned everywhere (phone files, rig dir,
         * MS host dir, Reaper RPP name).
         */
        fun slugifyGigName(name: String, gigDate: String? = null): String {
            val nameSlug = if (name.isBlank()) "nogig" else
                name.replace(Regex("[^A-Za-z0-9._-]+"), "-")
                    .trim('-', '_')
                    .ifEmpty { "nogig" }
            val date = gigDate?.takeIf { it.matches(Regex("^\\d{8}$")) }
            return if (date != null) "$nameSlug-$date" else nameSlug
        }

        /**
         * F5: canonicalise the user-typed gig name at the wizard so it flows
         * unchanged through rig dir, phone files, Reaper RPP, MS host. Same
         * rule as slugifyGigName but without the date suffix (date is
         * appended at recording time, not naming time).
         */
        fun slugifyForWizard(name: String): String = slugifyGigName(name, null)
    }

    private var cameraProvider: ProcessCameraProvider? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var preview: Preview? = null
    private var activeRecording: Recording? = null
    /**
     * Captured from `provider.bindToLifecycle(...)` return — gates access to
     * `cameraControl` (zoom, exposure, focus) and `cameraInfo` (zoom state,
     * exposure caps). These are mid-recording-safe APIs per CameraX docs —
     * no rebind needed when applied (§B.4 gig-safety guard upheld).
     */
    private var boundCamera: Camera? = null

    /** Min/max zoom ratio of the currently-bound camera, read at bind time. */
    data class ZoomRange(val min: Float, val max: Float)
    private val _zoomRange = MutableStateFlow<ZoomRange?>(null)
    val zoomRange: StateFlow<ZoomRange?> = _zoomRange

    /** Exposure-compensation capabilities of the currently-bound camera. */
    data class ExposureCaps(val minIndex: Int, val maxIndex: Int, val stepEv: Float)
    private val _exposureCaps = MutableStateFlow<ExposureCaps?>(null)
    val exposureCaps: StateFlow<ExposureCaps?> = _exposureCaps

    /**
     * Whether the currently-selected camera supports video stabilisation.
     * Probed pre-bind via the static `Recorder.getVideoCapabilities(CameraInfo)`
     * + `isStabilizationSupported()` chain so we can gate the UI toggle
     * before binding. False until first rebind resolves a CameraInfo.
     */
    private val _stabilisationSupported = MutableStateFlow(false)
    val stabilisationSupported: StateFlow<Boolean> = _stabilisationSupported
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

            // Aspect ratio MUST match VideoCapture (16:9 for HD/FHD/UHD) across
            // every UseCase that the user sees — peer's live PreviewView AND the
            // orchestrator/peer thumbnail (ImageAnalysis) AND the recorded MP4
            // (VideoCapture). Preview's default is 4:3, which means the peer
            // would frame on a 4:3 viewfinder and the recording would crop
            // different content. S123 fixed this for the thumbnail; S153 fixes
            // it for the peer's local PreviewView too.
            val sixteenNineResolution = ResolutionSelector.Builder()
                .setAspectRatioStrategy(AspectRatioStrategy.RATIO_16_9_FALLBACK_AUTO_STRATEGY)
                .build()

            preview = previewView?.let { pv ->
                Preview.Builder()
                    .setResolutionSelector(sixteenNineResolution)
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

            // Resolve the CameraSelector against available CameraInfos so we can
            // probe stabilisation capability BEFORE binding. `getVideoCapabilities`
            // is a static method on Recorder, so this works without an active bind.
            val cameraSelector = if (settings.cameraFacing == "front") {
                CameraSelector.DEFAULT_FRONT_CAMERA
            } else {
                CameraSelector.DEFAULT_BACK_CAMERA
            }
            val targetCameraInfo = cameraSelector.filter(provider.availableCameraInfos).firstOrNull()
            val stabSupported = targetCameraInfo?.let {
                runCatching { Recorder.getVideoCapabilities(it).isStabilizationSupported }.getOrDefault(false)
            } ?: false
            _stabilisationSupported.value = stabSupported

            // Bitrate buckets per S150 P3 brief §6.3. Applied via
            // Recorder.Builder.setTargetVideoEncodingBitRate(int) — rebind-class.
            val bitrateBps = bitrateForBucket(settings.qualityBucket)
            val recorder = Recorder.Builder()
                .setQualitySelector(QualitySelector.from(quality, FallbackStrategy.higherQualityOrLowerThan(quality)))
                .setAudioSource(android.media.MediaRecorder.AudioSource.DEFAULT)  // Ensure audio is always recorded
                .setTargetVideoEncodingBitRate(bitrateBps)
                .build()
            // Stabilisation only enabled when the camera actually supports it
            // (per §6.4 + feedback--unfinished-not-orphan.md guard rule).
            val stabilisationOn = (settings.stabilisation == "On") && stabSupported
            videoCapture = VideoCapture.Builder(recorder)
                .setTargetFrameRate(android.util.Range(safeFramerate, safeFramerate))
                .setTargetRotation(targetRotation)
                .setVideoStabilizationEnabled(stabilisationOn)
                .build()
            imageAnalysis = ImageAnalysis.Builder()
                .setResolutionSelector(sixteenNineResolution)
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

            val useCases = mutableListOf<UseCase>()
            preview?.let { useCases.add(it) }
            videoCapture?.let { useCases.add(it) }
            imageAnalysis?.let { useCases.add(it) }

            val camera = provider.bindToLifecycle(
                lifecycleOwner,
                cameraSelector,
                *useCases.toTypedArray(),
            )
            boundCamera = camera

            // Read zoom + exposure capabilities at bind time. ZoomState is a
            // LiveData, so we snapshot .value (may be null on very first bind
            // before CameraX has resolved the camera; gracefully degraded).
            camera.cameraInfo.zoomState.value?.let { zs ->
                _zoomRange.value = ZoomRange(zs.minZoomRatio, zs.maxZoomRatio)
            }
            val expState = camera.cameraInfo.exposureState
            if (expState.isExposureCompensationSupported) {
                val range = expState.exposureCompensationRange
                val stepEv = expState.exposureCompensationStep.toFloat()  // Rational → Float
                _exposureCaps.value = ExposureCaps(range.lower, range.upper, stepEv)
            } else {
                _exposureCaps.value = null
            }

            // Apply settings that don't require rebind. Both are
            // mid-recording-safe via cameraControl per CameraX docs.
            applyZoom(settings.zoomRatio)
            applyExposure(settings.exposure)

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
     * Apply zoom ratio. Mid-recording-safe — `cameraControl.setZoomRatio()`
     * runs without rebind per CameraX docs (§B.4 gig-safety upheld). No-op
     * if camera not bound, or if value is outside the camera's reported
     * min/max (clamped silently rather than erroring — slider can race
     * the bind).
     */
    fun applyZoom(ratio: Float) {
        val cam = boundCamera ?: return
        val range = _zoomRange.value
        val clamped = if (range != null) ratio.coerceIn(range.min, range.max) else ratio
        cam.cameraControl.setZoomRatio(clamped)  // ListenableFuture<Void>, fire-and-forget
    }

    /**
     * Pinch-zoom helper — linear 0.0..1.0 maps across the camera's min/max
     * zoom range. Use during pinch gestures; on settle, the caller should
     * read [currentZoomRatio] and persist back to PhoneSettings.
     */
    fun applyLinearZoom(linear: Float) {
        val cam = boundCamera ?: return
        cam.cameraControl.setLinearZoom(linear.coerceIn(0f, 1f))
    }

    /** Current zoom ratio for write-back after pinch settle. */
    fun currentZoomRatio(): Float = boundCamera?.cameraInfo?.zoomState?.value?.zoomRatio ?: 1.0f

    /**
     * Apply exposure compensation. Maps display-EV strings ("-2"/"-1"/
     * "Auto"/"+1"/"+2") to the camera's integer index via the device's
     * exposure step. Mid-recording-safe. No-op if exposure unsupported
     * (caps null) or camera not bound.
     */
    fun applyExposure(setting: String) {
        val cam = boundCamera ?: return
        val caps = _exposureCaps.value ?: return
        val displayEv = when (setting) {
            "-2" -> -2f
            "-1" -> -1f
            "+1" -> 1f
            "+2" -> 2f
            else -> 0f  // "Auto" + any unknown value
        }
        if (caps.stepEv == 0f) return
        val index = (displayEv / caps.stepEv).toInt().coerceIn(caps.minIndex, caps.maxIndex)
        cam.cameraControl.setExposureCompensationIndex(index)  // ListenableFuture<Integer>, fire-and-forget
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
     * @param gigName Active gig name (from GigSession on the orchestrator, or the
     *   StartRecPayload's `gigName` on the peer). Prepended to the filename so the
     *   MS host post-prod pull can filter per-gig instead of dragging in every mp4
     *   the phone has ever recorded. Blank -> "nogig" so the file is still pullable
     *   for ad-hoc tests; sanitised so only [A-Za-z0-9._-] survive.
     */
    fun startRecording(
        outputDir: File,
        sessionName: String,
        sessionId: String? = null,
        gigName: String = "",
        gigDate: String? = null,
    ): File {
        val capture = videoCapture ?: throw IllegalStateException("Camera not bound")
        currentSessionId = sessionId
        outputDir.mkdirs()

        val gigSlug = slugifyGigName(gigName, gigDate)
        // Include sessionId in filename if provided, for easy correlation with audio files.
        // Filename shape: <gigSlug>__<role>_<sessId>_<ts>.mp4 (S155 — pull-videos.py
        // matches on the "<gigSlug>__" prefix to scope per-gig pulls).
        val tail = if (!sessionId.isNullOrBlank()) {
            "${sessionName}_${sessionId}_${System.currentTimeMillis()}"
        } else {
            "${sessionName}_${System.currentTimeMillis()}"
        }
        val namePart = "${gigSlug}__${tail}"
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
