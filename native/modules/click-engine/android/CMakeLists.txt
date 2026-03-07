cmake_minimum_required(VERSION 3.22.1)
project("clickengine" LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find Oboe (provided via prefab from the oboe AAR)
find_package(oboe REQUIRED CONFIG)

# --- SoundTouch (vendored source) ---
set(SOUNDTOUCH_DIR ${CMAKE_CURRENT_SOURCE_DIR}/third_party/soundtouch)
set(SOUNDTOUCH_SRC
    ${SOUNDTOUCH_DIR}/source/SoundTouch/AAFilter.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/FIFOSampleBuffer.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/FIRFilter.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/InterpolateCubic.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/InterpolateLinear.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/InterpolateShannon.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/RateTransposer.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/SoundTouch.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/TDStretch.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/BPMDetect.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/PeakFinder.cpp
)

add_library(soundtouch STATIC ${SOUNDTOUCH_SRC})
target_include_directories(soundtouch PUBLIC
    ${SOUNDTOUCH_DIR}/include
    ${SOUNDTOUCH_DIR}/source/SoundTouch
)
# SoundTouch needs integer sample support disabled for float-only mode
target_compile_definitions(soundtouch PUBLIC
    SOUNDTOUCH_FLOAT_SAMPLES=1
)

# --- Native source files ---
add_library(clickengine SHARED
    src/main/cpp/jni_bridge.cpp
    src/main/cpp/audio_engine.cpp
    src/main/cpp/metronome.cpp
    src/main/cpp/mixer.cpp
    src/main/cpp/wav_loader.cpp
    src/main/cpp/track_player.cpp
    src/main/cpp/beat_detector.cpp
)

target_include_directories(clickengine PRIVATE
    src/main/cpp
)

target_link_libraries(clickengine
    oboe::oboe
    soundtouch
    android
    log
)
