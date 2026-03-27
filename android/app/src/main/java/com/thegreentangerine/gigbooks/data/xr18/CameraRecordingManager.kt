package com.thegreentangerine.gigbooks.data.xr18

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.YuvImage
import android.util.Size
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.*
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
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

    private var cameraProvider: ProcessCameraProvider? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var preview: Preview? = null
    private var activeRecording: Recording? = null
    private var lastPreviewFrame: ByteArray? = null
    private val analysisExecutor = Executors.newSingleThreadExecutor()

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
        provider.unbindAll()

        preview = Preview.Builder().build().also {
            it.surfaceProvider = previewView.surfaceProvider
        }

        val quality = when (settings.resolution) {
            "4K" -> Quality.UHD
            "720p" -> Quality.HD
            else -> Quality.FHD  // 1080p default
        }

        val recorder = Recorder.Builder()
            .setQualitySelector(QualitySelector.from(quality, FallbackStrategy.higherQualityOrLowerThan(quality)))
            .build()
        videoCapture = VideoCapture.withOutput(recorder)

        // ImageAnalysis for preview frame capture (low-res JPEG for base64 preview)
        imageAnalysis = ImageAnalysis.Builder()
            .setTargetResolution(Size(320, 240))
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also { analysis ->
                analysis.setAnalyzer(analysisExecutor) { imageProxy ->
                    lastPreviewFrame = imageProxyToJpeg(imageProxy)
                    imageProxy.close()
                }
            }

        val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

        provider.bindToLifecycle(
            lifecycleOwner,
            cameraSelector,
            preview,
            videoCapture,
            imageAnalysis,
        )
        _isBound.value = true
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
