import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ScrollView,
  Dimensions,
  Animated,
  TextInput,
  Switch,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { COLORS, FONTS, neuRaisedStyle, neuInsetStyle } from '../../src/theme';
import { getSongs } from '../../src/db';
import type { Song } from '../../src/db';
import {
  loadSong,
  loadPracticeTrack,
  setSpeed,
  nudgeClickForward,
  nudgeClickBackward,
  ClickEngineNative,
} from '../../src/audio/ClickEngine';
import type { TrackLoadResult, BeatAnalysisResult } from '../../src/audio/ClickEngine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ENGINE_SAMPLE_RATE = 48000;
const ENGINE_FRAMES = 256;

type PracticeState = 'picker' | 'loading' | 'ready';

export default function PracticeScreen() {
  useKeepAwake();

  // -- State --
  const [practiceState, setPracticeState] = useState<PracticeState>('picker');
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Engine state
  const [engineStarted, setEngineStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Track info
  const [trackDurationMs, setTrackDurationMs] = useState(0);
  const [trackTotalFrames, setTrackTotalFrames] = useState(0);
  const [detectedBpm, setDetectedBpm] = useState(0);

  // Position & beat
  const [positionMs, setPositionMs] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [currentBar, setCurrentBar] = useState(0);

  // Speed
  const [speedRatio, setSpeedRatio] = useState(1.0);

  // A-B loop
  const [loopA, setLoopA] = useState<number | null>(null); // frame
  const [loopB, setLoopB] = useState<number | null>(null); // frame

  // Volumes
  const [clickVolume, setClickVolume] = useState(1.0);
  const [trackVolume, setTrackVolume] = useState(1.0);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [splitStereo, setSplitStereo] = useState(false);

  // Count-in
  const [countInBars, setCountInBars] = useState(0);
  const [isCountIn, setIsCountIn] = useState(false);

  // Beat viz
  const rafRef = useRef<number | null>(null);
  const beatScales = useRef<Animated.Value[]>([]);
  const beatsPerBar = selectedSong?.time_signature_top ?? 4;

  if (beatScales.current.length !== beatsPerBar) {
    beatScales.current = Array.from({ length: beatsPerBar }, () => new Animated.Value(1));
  }

  // Songs with audio only
  const songsWithAudio = songs.filter(s => s.audio_url);
  const filteredSongs = searchQuery.trim()
    ? songsWithAudio.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.artist.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : songsWithAudio;

  // Computed BPM
  const baseBpm = selectedSong?.bpm ?? detectedBpm;
  const effectiveBpm = Math.round(baseBpm * speedRatio);

  // -- Load songs on focus --
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setSongs(await getSongs());
        } catch (err) {
          console.error('Failed to load songs', err);
        }
      })();
    }, [])
  );

  // -- Engine lifecycle --
  useEffect(() => {
    if (!engineStarted) {
      try {
        ClickEngineNative.startEngine(ENGINE_SAMPLE_RATE, ENGINE_FRAMES);
        setEngineStarted(true);
      } catch (err) {
        console.error('Failed to start audio engine', err);
      }
    }
    return () => {
      if (engineStarted) {
        try {
          ClickEngineNative.stopClick();
          ClickEngineNative.stopTrack();
          ClickEngineNative.stopEngine();
        } catch {
          // engine may already be stopped
        }
      }
    };
  }, [engineStarted]);

  // -- Position polling via RAF --
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastBeat = -1;
    function poll() {
      try {
        const posFrame = ClickEngineNative.getTrackPosition();
        const totalFrames = ClickEngineNative.getTrackTotalFrames();
        const ms = totalFrames > 0 ? (posFrame / totalFrames) * trackDurationMs : 0;
        setPositionMs(ms);

        const beat = ClickEngineNative.getCurrentBeat();
        const bar = ClickEngineNative.getCurrentBar();
        setCurrentBeat(beat);
        setCurrentBar(bar);

        // Count-in detection
        setIsCountIn(countInBars > 0 && bar < 0);

        // Animate beat dot
        if (beat !== lastBeat && beat >= 0 && beat < beatScales.current.length) {
          const scale = beatScales.current[beat];
          scale.setValue(1.5);
          Animated.spring(scale, {
            toValue: 1,
            friction: 4,
            tension: 200,
            useNativeDriver: true,
          }).start();
          lastBeat = beat;
        }
      } catch {
        // engine not ready
      }
      rafRef.current = requestAnimationFrame(poll);
    }
    rafRef.current = requestAnimationFrame(poll);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, trackDurationMs, countInBars, beatsPerBar]);

  // -- Actions --

  async function handleSelectSong(song: Song) {
    if (!song.audio_url) return;
    setSelectedSong(song);
    setPracticeState('loading');
    setLoadError(null);
    setIsPlaying(false);
    setIsPaused(false);
    setPositionMs(0);
    setSpeedRatio(1.0);
    setLoopA(null);
    setLoopB(null);
    setCountInBars(song.count_in_bars);

    try {
      // Configure metronome from song settings
      loadSong(song);

      // Load and analyse the practice track
      const result: TrackLoadResult & BeatAnalysisResult = await loadPracticeTrack(song.audio_url);
      setTrackDurationMs(result.durationMs);
      setTrackTotalFrames(result.numFrames);
      setDetectedBpm(result.bpm);

      // Apply volumes
      ClickEngineNative.setChannelGain(0, clickVolume);
      ClickEngineNative.setChannelGain(1, trackVolume);
      ClickEngineNative.setMasterGain(masterVolume);
      ClickEngineNative.setSplitStereo(splitStereo);

      setPracticeState('ready');
    } catch (err) {
      console.error('Failed to load practice track', err);
      setLoadError(String(err));
      setPracticeState('picker');
    }
  }

  function handlePlay() {
    if (isPaused) {
      ClickEngineNative.playTrack();
      ClickEngineNative.startClick();
      setIsPaused(false);
      setIsPlaying(true);
    } else {
      // Fresh play from current position
      ClickEngineNative.playTrack();
      ClickEngineNative.startClick();
      setIsPlaying(true);
      setIsPaused(false);
    }
  }

  function handlePause() {
    ClickEngineNative.pauseTrack();
    ClickEngineNative.stopClick();
    setIsPlaying(false);
    setIsPaused(true);
  }

  function handleStop() {
    ClickEngineNative.stopTrack();
    ClickEngineNative.stopClick();
    setIsPlaying(false);
    setIsPaused(false);
    setPositionMs(0);
  }

  function handleSpeedChange(ratio: number) {
    const clamped = Math.max(0.5, Math.min(1.5, ratio));
    const rounded = Math.round(clamped * 20) / 20; // snap to 5% increments
    setSpeedRatio(rounded);
    setSpeed(rounded);
  }

  function handleSeek(x: number, trackWidth: number) {
    if (trackTotalFrames <= 0) return;
    const pct = Math.max(0, Math.min(1, x / trackWidth));
    const frame = Math.round(pct * trackTotalFrames);
    ClickEngineNative.seekTrack(frame);
    setPositionMs(pct * trackDurationMs);
  }

  function handleSetLoopA() {
    if (loopA !== null && loopB !== null) {
      // Clear loop
      setLoopA(null);
      setLoopB(null);
      ClickEngineNative.clearLoopRegion();
      return;
    }
    if (loopA === null) {
      // Set A marker at current position
      const frame = Math.round((positionMs / trackDurationMs) * trackTotalFrames);
      setLoopA(frame);
    } else {
      // Set B marker and activate loop
      const frame = Math.round((positionMs / trackDurationMs) * trackTotalFrames);
      if (frame > loopA) {
        setLoopB(frame);
        ClickEngineNative.setLoopRegion(loopA, frame);
      }
    }
  }

  function handleClickVolume(gain: number) {
    const clamped = Math.max(0, Math.min(2, gain));
    setClickVolume(clamped);
    ClickEngineNative.setChannelGain(0, clamped);
  }

  function handleTrackVolume(gain: number) {
    const clamped = Math.max(0, Math.min(2, gain));
    setTrackVolume(clamped);
    ClickEngineNative.setChannelGain(1, clamped);
  }

  function handleMasterVolume(gain: number) {
    const clamped = Math.max(0, Math.min(2, gain));
    setMasterVolume(clamped);
    ClickEngineNative.setMasterGain(clamped);
  }

  function handleSplitStereo(enabled: boolean) {
    setSplitStereo(enabled);
    ClickEngineNative.setSplitStereo(enabled);
  }

  function handleCountIn(bars: number) {
    setCountInBars(bars);
    ClickEngineNative.setCountIn(bars, ClickEngineNative.CLICK_HIGH);
  }

  function handleBackToSongs() {
    handleStop();
    setSelectedSong(null);
    setPracticeState('picker');
    setLoadError(null);
  }

  // -- Helpers --

  function formatTime(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // -- Song Picker --

  if (practiceState === 'picker') {
    return (
      <View style={styles.container}>
        <Text style={styles.pickerTitle}>Practice Mode</Text>
        <Text style={styles.pickerSubtitle}>Select a song with a practice track</Text>

        {/* Search */}
        <View style={[styles.searchContainer, neuInsetStyle()]}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search songs..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loadError && (
          <Text style={styles.errorText}>{loadError}</Text>
        )}

        {filteredSongs.length === 0 ? (
          <Text style={styles.emptyText}>
            {songsWithAudio.length === 0
              ? 'No songs have practice tracks attached.\nUpload an MP3 in song settings first.'
              : 'No matching songs found.'}
          </Text>
        ) : (
          <FlatList
            data={filteredSongs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.pickerList}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.songCard, neuRaisedStyle(), pressed && styles.pressed]}
                onPress={() => handleSelectSong(item)}
              >
                <View style={styles.songCardRow}>
                  <View style={styles.songCardInfo}>
                    <Text style={styles.songCardName}>{item.name}</Text>
                    {item.artist ? (
                      <Text style={styles.songCardArtist}>{item.artist}</Text>
                    ) : null}
                  </View>
                  <View style={styles.songCardMeta}>
                    <Text style={styles.songCardBpm}>{item.bpm}</Text>
                    <Text style={styles.songCardBpmLabel}>BPM</Text>
                  </View>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    );
  }

  // -- Loading --

  if (practiceState === 'loading') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading track...</Text>
        <Text style={styles.loadingSubtext}>{selectedSong?.name}</Text>
      </View>
    );
  }

  // -- Practice View --

  const progressPct = trackDurationMs > 0 ? positionMs / trackDurationMs : 0;
  const loopAPct = loopA !== null && trackTotalFrames > 0 ? loopA / trackTotalFrames : null;
  const loopBPct = loopB !== null && trackTotalFrames > 0 ? loopB / trackTotalFrames : null;
  const progressBarWidth = SCREEN_WIDTH - 48;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.practiceContent}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Pressable onPress={handleBackToSongs} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'} Songs</Text>
        </Pressable>
        <Text style={styles.headerSongName} numberOfLines={1}>
          {selectedSong?.name}
        </Text>
      </View>

      {/* Song meta */}
      <View style={styles.metaRow}>
        {selectedSong?.artist ? (
          <Text style={styles.artistText}>{selectedSong.artist}</Text>
        ) : null}
        {selectedSong?.key ? (
          <View style={[styles.metaChip, neuInsetStyle('subtle')]}>
            <Text style={styles.metaChipLabel}>KEY</Text>
            <Text style={styles.metaChipValue}>{selectedSong.key}</Text>
          </View>
        ) : null}
        <View style={[styles.metaChip, neuInsetStyle('subtle')]}>
          <Text style={styles.metaChipLabel}>TIME</Text>
          <Text style={styles.metaChipValue}>
            {selectedSong?.time_signature_top ?? 4}/{selectedSong?.time_signature_bottom ?? 4}
          </Text>
        </View>
      </View>

      {/* BPM display */}
      <View style={styles.bpmContainer}>
        <Text style={styles.bpmLabel}>BPM</Text>
        <Text style={styles.bpmValue}>{effectiveBpm}</Text>
        {speedRatio !== 1.0 && (
          <Text style={styles.bpmOriginal}>
            ({baseBpm} x {Math.round(speedRatio * 100)}%)
          </Text>
        )}
      </View>

      {/* Count-in indicator */}
      {isCountIn && isPlaying && (
        <View style={styles.countInBanner}>
          <Text style={styles.countInText}>COUNT IN</Text>
        </View>
      )}

      {/* Beat visualization */}
      <View style={styles.beatVizContainer}>
        <Text style={styles.barLabel}>
          Bar {currentBar >= 0 ? currentBar + 1 : '--'}
        </Text>
        <View style={styles.beatDotsRow}>
          {Array.from({ length: beatsPerBar }).map((_, i) => {
            const isActive = isPlaying && currentBeat === i;
            const isDownbeat = i === 0;
            const dotColor = isDownbeat
              ? (isActive ? '#ff3333' : '#661111')
              : (isActive ? COLORS.teal : '#0d3d33');
            const glowColor = isDownbeat ? '#ff3333' : COLORS.teal;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.beatDot,
                  {
                    backgroundColor: dotColor,
                    transform: [{ scale: beatScales.current[i] ?? 1 }],
                  },
                  isActive && {
                    shadowColor: glowColor,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.9,
                    shadowRadius: 12,
                    elevation: 8,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
          <Text style={styles.timeText}>{formatTime(trackDurationMs)}</Text>
        </View>
        <View
          style={[styles.progressTrack, neuInsetStyle('subtle')]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={(e) => handleSeek(e.nativeEvent.locationX, progressBarWidth)}
        >
          {/* A-B loop markers */}
          {loopAPct !== null && (
            <View style={[styles.loopMarker, styles.loopMarkerA, { left: loopAPct * progressBarWidth }]} />
          )}
          {loopBPct !== null && (
            <View style={[styles.loopMarker, styles.loopMarkerB, { left: loopBPct * progressBarWidth }]} />
          )}
          {/* Loop region highlight */}
          {loopAPct !== null && loopBPct !== null && (
            <View style={[
              styles.loopRegion,
              { left: loopAPct * progressBarWidth, width: (loopBPct - loopAPct) * progressBarWidth },
            ]} />
          )}
          {/* Progress fill */}
          <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
          {/* Playhead */}
          <View style={[styles.playhead, { left: progressPct * progressBarWidth - 6 }]} />
        </View>
      </View>

      {/* Transport controls */}
      <View style={styles.transportRow}>
        <Pressable
          style={[styles.transportBtn, neuRaisedStyle()]}
          onPress={handleStop}
        >
          <Text style={styles.transportBtnText}>STOP</Text>
        </Pressable>

        <Pressable
          style={[
            styles.playBtn,
            neuRaisedStyle('strong'),
            { backgroundColor: isPlaying ? COLORS.orange : '#114411' },
          ]}
          onPress={isPlaying ? handlePause : handlePlay}
        >
          <Text style={styles.playBtnText}>{isPlaying ? 'PAUSE' : 'PLAY'}</Text>
        </Pressable>

        <Pressable
          style={[styles.transportBtn, neuRaisedStyle()]}
          onPress={handleSetLoopA}
        >
          <Text style={[
            styles.transportBtnText,
            (loopA !== null || loopB !== null) && { color: COLORS.orange },
          ]}>
            {loopA !== null && loopB !== null ? 'CLR' : loopA !== null ? 'B' : 'A'}
          </Text>
          <Text style={styles.transportBtnSub}>
            {loopA !== null && loopB !== null ? 'LOOP' : 'LOOP'}
          </Text>
        </Pressable>
      </View>

      {/* Speed control */}
      <View style={styles.controlSection}>
        <Text style={styles.sectionLabel}>SPEED</Text>
        <View style={styles.speedRow}>
          <Pressable
            style={[styles.smallBtn, neuRaisedStyle('subtle')]}
            onPress={() => handleSpeedChange(speedRatio - 0.05)}
          >
            <Text style={styles.smallBtnText}>-5%</Text>
          </Pressable>
          <View style={[styles.speedDisplay, neuInsetStyle('subtle')]}>
            <Text style={styles.speedText}>{Math.round(speedRatio * 100)}%</Text>
          </View>
          <Pressable
            style={[styles.smallBtn, neuRaisedStyle('subtle')]}
            onPress={() => handleSpeedChange(speedRatio + 0.05)}
          >
            <Text style={styles.smallBtnText}>+5%</Text>
          </Pressable>
          {speedRatio !== 1.0 && (
            <Pressable
              style={[styles.smallBtn, neuRaisedStyle('subtle')]}
              onPress={() => handleSpeedChange(1.0)}
            >
              <Text style={[styles.smallBtnText, { color: COLORS.orange }]}>100%</Text>
            </Pressable>
          )}
        </View>
        {/* Speed slider */}
        <View style={[styles.sliderTrack, neuInsetStyle('subtle')]}>
          <CustomSlider
            value={(speedRatio - 0.5) / 1.0}
            onChange={(pct) => handleSpeedChange(0.5 + pct * 1.0)}
            trackWidth={SCREEN_WIDTH - 72}
            color={COLORS.teal}
          />
        </View>
      </View>

      {/* Beat nudge */}
      <View style={styles.controlSection}>
        <Text style={styles.sectionLabel}>BEAT NUDGE</Text>
        <View style={styles.nudgeRow}>
          <Pressable
            style={[styles.nudgeBtn, neuRaisedStyle('subtle')]}
            onPress={nudgeClickBackward}
          >
            <Text style={styles.nudgeBtnText}>{'<< '} EARLIER</Text>
          </Pressable>
          <Pressable
            style={[styles.nudgeBtn, neuRaisedStyle('subtle')]}
            onPress={nudgeClickForward}
          >
            <Text style={styles.nudgeBtnText}>LATER {' >>'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Volume controls */}
      <View style={styles.controlSection}>
        <Text style={styles.sectionLabel}>VOLUME</Text>

        <VolumeRow
          label="Click"
          value={clickVolume}
          onChange={handleClickVolume}
          color={COLORS.orange}
        />
        <VolumeRow
          label="Track"
          value={trackVolume}
          onChange={handleTrackVolume}
          color={COLORS.teal}
        />
        <VolumeRow
          label="Master"
          value={masterVolume}
          onChange={handleMasterVolume}
          color={COLORS.green}
        />

        {/* Split stereo */}
        <View style={styles.splitRow}>
          <Text style={styles.splitLabel}>Split Stereo (IEM)</Text>
          <Switch
            value={splitStereo}
            onValueChange={handleSplitStereo}
            trackColor={{ false: COLORS.cardLight, true: COLORS.teal }}
            thumbColor={splitStereo ? COLORS.green : COLORS.textDim}
          />
        </View>
        {splitStereo && (
          <Text style={styles.splitHint}>Click = left ear, Track = right ear</Text>
        )}
      </View>

      {/* Count-in */}
      <View style={styles.controlSection}>
        <Text style={styles.sectionLabel}>COUNT-IN</Text>
        <View style={styles.countInRow}>
          {[0, 1, 2, 4].map(bars => (
            <Pressable
              key={bars}
              style={[
                styles.countInOption,
                neuRaisedStyle('subtle'),
                countInBars === bars && styles.countInActive,
              ]}
              onPress={() => handleCountIn(bars)}
            >
              <Text style={[
                styles.countInOptionText,
                countInBars === bars && styles.countInActiveText,
              ]}>
                {bars === 0 ? 'OFF' : `${bars} BAR${bars > 1 ? 'S' : ''}`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Bottom spacer */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// -- Custom Slider --

function CustomSlider({
  value,
  onChange,
  trackWidth,
  color,
}: {
  value: number;
  onChange: (pct: number) => void;
  trackWidth: number;
  color: string;
}) {
  const thumbX = value * (trackWidth - 24);

  return (
    <View
      style={{ width: trackWidth, height: 36, justifyContent: 'center' }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderMove={(e) => {
        const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth));
        onChange(pct);
      }}
      onResponderRelease={(e) => {
        const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth));
        onChange(pct);
      }}
    >
      <View style={[sliderStyles.fill, { width: Math.max(0, thumbX + 12), backgroundColor: color }]} />
      <View style={[sliderStyles.thumb, { left: Math.max(0, thumbX), borderColor: color }]} />
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0,
    top: 14,
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 2,
  },
});

// -- Volume Row --

function VolumeRow({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  const trackWidth = SCREEN_WIDTH - 120;

  return (
    <View style={styles.volumeRow}>
      <Text style={styles.volumeLabel}>{label}</Text>
      <View style={[styles.volumeTrack, neuInsetStyle('subtle')]}>
        <CustomSlider
          value={value / 2.0}
          onChange={(pct) => onChange(pct * 2.0)}
          trackWidth={trackWidth}
          color={color}
        />
      </View>
      <Text style={styles.volumeValue}>{Math.round(value * 100)}%</Text>
    </View>
  );
}

// -- Styles --

const DOT_SIZE = 22;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  practiceContent: {
    paddingBottom: 20,
  },

  // -- Picker --
  pickerTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 22,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 20,
  },
  pickerSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textDim,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  searchContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  searchInput: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    height: 36,
  },
  pickerList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  songCard: {
    padding: 16,
    marginBottom: 10,
  },
  songCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  songCardInfo: {
    flex: 1,
    marginRight: 12,
  },
  songCardName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.text,
  },
  songCardArtist: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textDim,
    marginTop: 2,
  },
  songCardMeta: {
    alignItems: 'center',
  },
  songCardBpm: {
    fontFamily: FONTS.mono,
    fontSize: 20,
    color: COLORS.green,
  },
  songCardBpmLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
    textAlign: 'center',
    marginTop: 60,
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.danger,
    textAlign: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.7,
  },

  // -- Loading --
  loadingText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.text,
  },
  loadingSubtext: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
    marginTop: 8,
  },

  // -- Header --
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.teal,
  },
  headerSongName: {
    flex: 1,
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.text,
  },

  // -- Meta row --
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  artistText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
  },
  metaChip: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  metaChipLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metaChipValue: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.text,
    marginTop: 1,
  },

  // -- BPM --
  bpmContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  bpmLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  bpmValue: {
    fontFamily: FONTS.mono,
    fontSize: 48,
    color: COLORS.green,
  },
  bpmOriginal: {
    fontFamily: FONTS.monoRegular,
    fontSize: 12,
    color: COLORS.textDim,
    marginTop: 2,
  },

  // -- Count-in --
  countInBanner: {
    backgroundColor: COLORS.orange,
    paddingVertical: 4,
    alignItems: 'center',
  },
  countInText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: '#000000',
    letterSpacing: 2,
  },

  // -- Beat viz --
  beatVizContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  barLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  beatDotsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  beatDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },

  // -- Progress bar --
  progressSection: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timeText: {
    fontFamily: FONTS.monoRegular,
    fontSize: 12,
    color: COLORS.textDim,
  },
  progressTrack: {
    height: 28,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(26,188,156,0.25)',
    borderRadius: 12,
  },
  playhead: {
    position: 'absolute',
    top: 2,
    width: 12,
    height: 24,
    borderRadius: 6,
    backgroundColor: COLORS.teal,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  loopMarker: {
    position: 'absolute',
    top: 0,
    width: 3,
    height: 28,
    zIndex: 2,
  },
  loopMarkerA: {
    backgroundColor: COLORS.orange,
  },
  loopMarkerB: {
    backgroundColor: COLORS.orange,
  },
  loopRegion: {
    position: 'absolute',
    top: 0,
    height: 28,
    backgroundColor: 'rgba(243,156,18,0.15)',
    zIndex: 1,
  },

  // -- Transport --
  transportRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  transportBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    minWidth: 72,
  },
  transportBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.text,
  },
  transportBtnSub: {
    fontFamily: FONTS.bodyBold,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  playBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 2,
  },

  // -- Speed --
  controlSection: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.text,
  },
  speedDisplay: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  speedText: {
    fontFamily: FONTS.mono,
    fontSize: 20,
    color: COLORS.teal,
  },
  sliderTrack: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  // -- Nudge --
  nudgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  nudgeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  nudgeBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.text,
  },

  // -- Volume --
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  volumeLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textDim,
    width: 48,
  },
  volumeTrack: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  volumeValue: {
    fontFamily: FONTS.monoRegular,
    fontSize: 11,
    color: COLORS.textDim,
    width: 40,
    textAlign: 'right',
  },

  // -- Split stereo --
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  splitLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textDim,
  },
  splitHint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // -- Count-in --
  countInRow: {
    flexDirection: 'row',
    gap: 10,
  },
  countInOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  countInActive: {
    backgroundColor: 'rgba(26,188,156,0.15)',
    borderColor: COLORS.teal,
    borderWidth: 1,
  },
  countInOptionText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textDim,
  },
  countInActiveText: {
    color: COLORS.teal,
  },
});
