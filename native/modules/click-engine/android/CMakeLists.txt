cmake_minimum_required(VERSION 3.22.1)
project("clickengine" LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find Oboe (provided via prefab from the oboe AAR)
find_package(oboe REQUIRED CONFIG)

# Native source files
add_library(clickengine SHARED
    src/main/cpp/jni_bridge.cpp
    src/main/cpp/audio_engine.cpp
    src/main/cpp/metronome.cpp
    src/main/cpp/mixer.cpp
    src/main/cpp/wav_loader.cpp
)

target_include_directories(clickengine PRIVATE
    src/main/cpp
)

target_link_libraries(clickengine
    oboe::oboe
    android
    log
)
