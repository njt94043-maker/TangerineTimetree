import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// S233-D: load real release-signing creds from a gitignored keystore.properties
// at the android root. Absent in CI/dev -> signingConfigs falls back to the public
// debug keystore (see below), so non-release builds work without the file.
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.thegreentangerine.gigbooks"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.thegreentangerine.gigbooks"
        minSdk = 26
        targetSdk = 36
        versionCode = 62
        versionName = "1.2.43"

        // S186 / D-batchD-1: APK no longer targets the dead E6330 box. Default
        // points at the MS host bridge on the laptop (POST /gig + /song-marker
        // mounted on the MS host's existing port).
        //
        // S211: the dead 2026-06-13 hotspot-IP pin is replaced by a persistent
        // manual rig target. ReaperConfigPane -> OrchestratorService.setManualRig
        // writes the host through RigTargetStore (DataStore), loaded on service
        // start, which supersedes this default — so a venue's rig address is set
        // once and survives reboot/reinstall. Default falls back to the mDNS
        // hostname for the home-WiFi auto-discover path.
        buildConfigField("String", "GIG_HOST_DEFAULT", "\"tgt-host.local\"")
        buildConfigField("int", "GIG_PORT_DEFAULT", "9200")

        // Constrain bundled native libs (ML Kit, CameraX, datastore) to arm64-v8a —
        // every band phone is arm64. Independent of the (removed) clickengine NDK
        // build; without it the APK ships unused x86/x86_64/armeabi-v7a variants (+14MB).
        ndk {
            abiFilters += listOf("arm64-v8a")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    signingConfigs {
        create("release") {
            // S233-D: real release signing reads from keystore.properties (gitignored,
            // never committed). Falls back to the public debug keystore so CI/dev builds
            // work without it; a real release build requires keystore.properties present.
            // The configured storeFile is resolved relative to the android root
            // (rootProject) to match app/tgt-release.keystore; the debug fallback is
            // module-relative (app/debug.keystore), matching the existing layout.
            storeFile = keystoreProps.getProperty("storeFile")?.let { rootProject.file(it) }
                ?: file("debug.keystore")
            storePassword = keystoreProps.getProperty("storePassword") ?: "android"
            keyAlias = keystoreProps.getProperty("keyAlias") ?: "androiddebugkey"
            keyPassword = keystoreProps.getProperty("keyPassword") ?: "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            // Debug builds default to localhost so emulator + adb-reverse rigs work
            // without DNS. Release uses the mDNS hostname set in defaultConfig.
            buildConfigField("String", "GIG_HOST_DEFAULT", "\"localhost\"")
        }
    }

    dexOptions {
        javaMaxHeapSize = "1g"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Compose BOM
    val composeBom = platform(libs.compose.bom)
    implementation(composeBom)
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    implementation(libs.compose.activity)
    debugImplementation(libs.compose.ui.tooling)

    // Navigation
    implementation(libs.navigation.compose)

    // Lifecycle
    implementation(libs.lifecycle.runtime)
    implementation(libs.lifecycle.viewmodel)

    // Supabase
    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.auth)
    implementation(libs.supabase.postgrest)
    implementation(libs.supabase.storage)
    implementation(libs.supabase.realtime)
    // OkHttp Ktor engine — required for Supabase Realtime (WebSocket capability;
    // the default ktor-android engine doesn't support WebSockets).
    implementation(libs.ktor.okhttp)

    // Coroutines
    implementation(libs.coroutines.android)

    // Image loading
    implementation(libs.coil.compose)

    // CameraX
    implementation(libs.camerax.core)
    implementation(libs.camerax.camera2)
    implementation(libs.camerax.lifecycle)
    implementation(libs.camerax.video)
    implementation(libs.camerax.view)

    // ML Kit barcode scanning
    implementation(libs.mlkit.barcode)

    // Kotlin serialization
    implementation(libs.serialization.json)

    // OkHttp (WebSocket for Supabase Broadcast relay)
    implementation(libs.okhttp)

    // Core
    implementation(libs.core.ktx)

    // DataStore (camera settings persistence)
    implementation(libs.datastore.preferences)

    // Unit tests
    testImplementation(libs.junit)
    testImplementation(libs.coroutines.test)
}
