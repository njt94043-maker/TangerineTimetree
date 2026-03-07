import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Animated,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { COLORS, FONTS, neuRaisedStyle, neuInsetStyle } from '../../src/theme';
import { getSetlists, getSetlistWithSongs } from '../../src/db';
import type { Setlist, SetlistWithSongs } from '../../src/db';
import { loadSong, ClickEngineNative } from '../../src/audio/ClickEngine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ENGINE_SAMPLE_RATE = 48000;
const ENGINE_FRAMES = 256;

export default function LiveModeScreen() {
  useKeepAwake();

  const [setlists, setSetlistsData] = useState<Setlist[]>([]);
  const [activeSetlist, setActiveSetlist] = useState<SetlistWithSongs | null>(null);
  const [songIndex, setSongIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [currentBar, setCurrentBar] = useState(0);
  const [engineStarted, setEngineStarted] = useState(false);
  const [showSetlistPicker, setShowSetlistPicker] = useState(true);
  const [swingPercent, setSwingPercent] = useState(50);
  const [isCountIn, setIsCountIn] = useState(false);
  const rafRef = useRef<number | null>(null);
  const beatScales = useRef<Animated.Value[]>([]);

  const currentSong = activeSetlist?.songs?.[songIndex];
  const totalSongs = activeSetlist?.songs?.length ?? 0;
  const beatsPerBar = currentSong?.song_time_signature_top ?? 4;

  // Ensure we always have the right number of animated values for beats
  if (beatScales.current.length !== beatsPerBar) {
    beatScales.current = Array.from({ length: beatsPerBar }, () => new Animated.Value(1));
  }

  // Load setlists on focus
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setSetlistsData(await getSetlists());
        } catch (err) {
          console.error('Failed to load setlists', err);
        }
      })();
    }, [])
  );

  // Start engine once
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
          ClickEngineNative.stopEngine();
        } catch {
          // engine may already be stopped
        }
      }
    };
  }, [engineStarted]);

  // Beat polling via requestAnimationFrame
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastBeat = -1;
    function poll() {
      try {
        const beat = ClickEngineNative.getCurrentBeat();
        const bar = ClickEngineNative.getCurrentBar();
        setCurrentBeat(beat);
        setCurrentBar(bar);

        // Animate beat dot on change
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

        // Detect count-in (bar < 0 or bar === 0 and we just started)
        const countInBars = currentSong?.song_count_in_bars ?? 0;
        setIsCountIn(countInBars > 0 && bar < 0);
      } catch {
        // engine not ready
      }
      rafRef.current = requestAnimationFrame(poll);
    }
    rafRef.current = requestAnimationFrame(poll);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, beatsPerBar, currentSong]);

  // -- Actions --

  async function handleSelectSetlist(sl: Setlist) {
    try {
      const full = await getSetlistWithSongs(sl.id);
      if (full && full.songs.length > 0) {
        setActiveSetlist(full);
        setSongIndex(0);
        setShowSetlistPicker(false);
        setIsPlaying(false);

        // Build a Song-like object from SetlistSongWithDetails
        const firstSong = full.songs[0];
        configureEngineForSong(firstSong);
        setSwingPercent(firstSong.song_swing_percent);
      }
    } catch (err) {
      console.error('Failed to load setlist', err);
    }
  }

  function configureEngineForSong(s: NonNullable<SetlistWithSongs['songs']>[number]) {
    loadSong({
      id: s.song_id,
      name: s.song_name,
      artist: s.song_artist,
      bpm: s.song_bpm,
      time_signature_top: s.song_time_signature_top,
      time_signature_bottom: s.song_time_signature_bottom,
      subdivision: s.song_subdivision,
      swing_percent: s.song_swing_percent,
      accent_pattern: s.song_accent_pattern,
      click_sound: s.song_click_sound,
      count_in_bars: s.song_count_in_bars,
      duration_seconds: s.song_duration_seconds,
      key: s.song_key,
      notes: s.song_notes,
      lyrics: s.song_lyrics,
      chords: s.song_chords,
      beat_offset_ms: 0,
      audio_url: s.song_audio_url,
      audio_storage_path: null,
      created_by: '',
      created_at: '',
      updated_at: '',
    });
  }

  function handlePlayStop() {
    if (isPlaying) {
      ClickEngineNative.stopClick();
      setIsPlaying(false);
    } else {
      ClickEngineNative.startClick();
      setIsPlaying(true);
    }
  }

  function handlePrevSong() {
    if (!activeSetlist || songIndex <= 0) return;
    const wasPlaying = isPlaying;
    if (wasPlaying) ClickEngineNative.stopClick();
    setIsPlaying(false);

    const newIdx = songIndex - 1;
    setSongIndex(newIdx);
    const song = activeSetlist.songs[newIdx];
    configureEngineForSong(song);
    setSwingPercent(song.song_swing_percent);
    setCurrentBeat(0);
    setCurrentBar(0);
  }

  function handleNextSong() {
    if (!activeSetlist || songIndex >= totalSongs - 1) return;
    const wasPlaying = isPlaying;
    if (wasPlaying) ClickEngineNative.stopClick();
    setIsPlaying(false);

    const newIdx = songIndex + 1;
    setSongIndex(newIdx);
    const song = activeSetlist.songs[newIdx];
    configureEngineForSong(song);
    setSwingPercent(song.song_swing_percent);
    setCurrentBeat(0);
    setCurrentBar(0);
  }

  function handleSwingChange(value: number) {
    // Snap to 50 (straight) when within 3%
    const snapped = Math.abs(value - 50) < 3 ? 50 : value;
    setSwingPercent(snapped);
    ClickEngineNative.setSwing(snapped);
  }

  function handleBackToSetlists() {
    if (isPlaying) ClickEngineNative.stopClick();
    setIsPlaying(false);
    setActiveSetlist(null);
    setShowSetlistPicker(true);
  }

  // -- Render --

  if (showSetlistPicker || !activeSetlist) {
    return (
      <View style={styles.container}>
        <Text style={styles.pickerTitle}>Select a Setlist</Text>
        {setlists.length === 0 ? (
          <Text style={styles.emptyText}>No setlists available. Create one first.</Text>
        ) : (
          <FlatList
            data={setlists}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.pickerList}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.setlistCard, neuRaisedStyle(), pressed && styles.pressed]}
                onPress={() => handleSelectSetlist(item)}
              >
                <Text style={styles.setlistCardName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.setlistCardDesc}>{item.description}</Text>
                ) : null}
              </Pressable>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Compact metadata bar */}
      <View style={styles.metaBar}>
        <Pressable onPress={handleBackToSetlists} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'} Setlists</Text>
        </Pressable>
        <Text style={styles.setlistLabel} numberOfLines={1}>
          {activeSetlist.name}
        </Text>
        <Text style={styles.positionText}>
          {songIndex + 1} of {totalSongs}
        </Text>
      </View>

      {/* Song info */}
      <View style={styles.songInfoContainer}>
        <Text style={styles.songName} numberOfLines={2}>
          {currentSong?.song_name ?? 'No Song'}
        </Text>
        {currentSong?.song_artist ? (
          <Text style={styles.songArtist}>{currentSong.song_artist}</Text>
        ) : null}

        {/* BPM + Key + Time Sig row */}
        <View style={styles.songMetaRow}>
          <View style={[styles.metaChip, neuInsetStyle()]}>
            <Text style={styles.metaChipLabel}>BPM</Text>
            <Text style={styles.bpmValue}>{currentSong?.song_bpm ?? '--'}</Text>
          </View>
          {currentSong?.song_key ? (
            <View style={[styles.metaChip, neuInsetStyle()]}>
              <Text style={styles.metaChipLabel}>KEY</Text>
              <Text style={styles.metaChipValue}>{currentSong.song_key}</Text>
            </View>
          ) : null}
          <View style={[styles.metaChip, neuInsetStyle()]}>
            <Text style={styles.metaChipLabel}>TIME</Text>
            <Text style={styles.metaChipValue}>
              {currentSong?.song_time_signature_top ?? 4}/{currentSong?.song_time_signature_bottom ?? 4}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {currentSong?.notes ? (
          <Text style={styles.songNotes} numberOfLines={2}>{currentSong.notes}</Text>
        ) : null}
      </View>

      {/* Count-in indicator */}
      {isCountIn && isPlaying && (
        <View style={styles.countInBanner}>
          <Text style={styles.countInText}>COUNT IN</Text>
        </View>
      )}

      {/* Beat Visualization */}
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

      {/* Swing slider */}
      {currentSong && (
        <View style={styles.swingContainer}>
          <Text style={styles.swingLabel}>
            SWING {swingPercent === 50 ? '(straight)' : `${swingPercent}%`}
          </Text>
          <View style={[styles.swingTrack, neuInsetStyle()]}>
            <SwingSlider value={swingPercent} onChange={handleSwingChange} />
          </View>
        </View>
      )}

      {/* Transport + Nav */}
      <View style={styles.transportContainer}>
        <Pressable
          style={[styles.navBtn, neuRaisedStyle(), songIndex <= 0 && styles.navBtnDisabled]}
          onPress={handlePrevSong}
          disabled={songIndex <= 0}
        >
          <Text style={[styles.navBtnText, songIndex <= 0 && styles.navBtnTextDisabled]}>PREV</Text>
        </Pressable>

        <Pressable
          style={[
            styles.playBtn,
            neuRaisedStyle('strong'),
            { backgroundColor: isPlaying ? '#661111' : '#114411' },
          ]}
          onPress={handlePlayStop}
        >
          <Text style={styles.playBtnText}>{isPlaying ? 'STOP' : 'PLAY'}</Text>
        </Pressable>

        <Pressable
          style={[styles.navBtn, neuRaisedStyle(), songIndex >= totalSongs - 1 && styles.navBtnDisabled]}
          onPress={handleNextSong}
          disabled={songIndex >= totalSongs - 1}
        >
          <Text style={[styles.navBtnText, songIndex >= totalSongs - 1 && styles.navBtnTextDisabled]}>NEXT</Text>
        </Pressable>
      </View>
    </View>
  );
}

// -- Swing Slider (custom, no external dep) --

function SwingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackWidth = SCREEN_WIDTH - 80; // container padding
  const percent = ((value - 50) / 25); // 0 to 1 range for 50-75
  const thumbX = percent * (trackWidth - 24);

  return (
    <View
      style={{ width: trackWidth, height: 36, justifyContent: 'center' }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderMove={(e) => {
        const x = e.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, x / trackWidth));
        const newVal = Math.round(50 + pct * 25);
        onChange(newVal);
      }}
      onResponderRelease={(e) => {
        const x = e.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, x / trackWidth));
        const newVal = Math.round(50 + pct * 25);
        onChange(newVal);
      }}
    >
      {/* Center marker (straight = 50%) */}
      <View style={[styles.swingCenter, { left: 0 }]} />
      {/* Filled portion */}
      <View style={[styles.swingFill, { width: Math.max(0, thumbX + 12) }]} />
      {/* Thumb */}
      <View style={[styles.swingThumb, { left: Math.max(0, thumbX) }]} />
    </View>
  );
}

const DOT_SIZE = 28;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // Setlist picker
  pickerTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 22,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  pickerList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  setlistCard: {
    padding: 20,
    marginBottom: 12,
  },
  setlistCardName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.text,
  },
  setlistCardDesc: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
    textAlign: 'center',
    marginTop: 60,
  },

  // Metadata bar
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.teal,
  },
  setlistLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textDim,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  positionText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.orange,
  },

  // Song info
  songInfoContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  songName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 28,
    color: '#ffffff',
    textAlign: 'center',
  },
  songArtist: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textDim,
    marginTop: 4,
  },
  songMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  metaChip: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 72,
  },
  metaChipLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bpmValue: {
    fontFamily: FONTS.mono,
    fontSize: 32,
    color: COLORS.green,
    marginTop: 2,
  },
  metaChipValue: {
    fontFamily: FONTS.mono,
    fontSize: 18,
    color: COLORS.text,
    marginTop: 2,
  },
  songNotes: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textDim,
    marginTop: 12,
    textAlign: 'center',
  },

  // Count-in
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

  // Beat visualization
  beatVizContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    flex: 1,
    justifyContent: 'center',
  },
  barLabel: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  beatDotsRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  beatDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },

  // Swing
  swingContainer: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 12,
  },
  swingLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  swingTrack: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  swingCenter: {
    position: 'absolute',
    top: 14,
    width: 2,
    height: 8,
    backgroundColor: COLORS.textMuted,
  },
  swingFill: {
    position: 'absolute',
    left: 0,
    top: 14,
    height: 4,
    backgroundColor: COLORS.teal,
    borderRadius: 2,
  },
  swingThumb: {
    position: 'absolute',
    top: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.teal,
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  // Transport
  transportContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
  },
  navBtn: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.text,
  },
  navBtnTextDisabled: {
    color: COLORS.textMuted,
  },
  playBtn: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 20,
    color: '#ffffff',
    letterSpacing: 2,
  },
});
