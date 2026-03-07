import { useState, useEffect, useRef, useCallback } from 'react';
import { getSetlists, getSetlistWithSongs } from '@shared/supabase/queries';
import type { Setlist, SetlistWithSongs, SetlistSongWithDetails } from '@shared/supabase/types';



function formatDuration(sec: number | null): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimeSig(top: number, bottom: number): string {
  return `${top}/${bottom}`;
}

// Parse ChordPro format: [Am]Some lyrics[F]more lyrics
// Returns array of {chord?: string, text: string} segments
function parseChordPro(line: string): { chord?: string; text: string }[] {
  const segments: { chord?: string; text: string }[] = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    // Text before this chord (if any, and no chord above it)
    if (match.index > lastIndex) {
      const textBefore = line.slice(lastIndex, match.index);
      if (segments.length === 0 || segments[segments.length - 1].chord) {
        segments.push({ text: textBefore });
      } else {
        segments[segments.length - 1].text += textBefore;
      }
    }
    // Start a new segment with this chord
    const chordName = match[1];
    lastIndex = regex.lastIndex;
    // Collect text after chord until next chord or end
    const nextMatch = regex.exec(line);
    if (nextMatch) {
      segments.push({ chord: chordName, text: line.slice(lastIndex, nextMatch.index) });
      lastIndex = nextMatch.index;
      regex.lastIndex = nextMatch.index; // rewind so outer loop picks it up
    } else {
      segments.push({ chord: chordName, text: line.slice(lastIndex) });
      lastIndex = line.length;
    }
  }

  // Remaining text after last chord
  if (lastIndex < line.length) {
    if (segments.length > 0 && !segments[segments.length - 1].chord) {
      segments[segments.length - 1].text += line.slice(lastIndex);
    } else {
      segments.push({ text: line.slice(lastIndex) });
    }
  }

  // If no chords found, return the whole line as plain text
  if (segments.length === 0) {
    segments.push({ text: line });
  }

  return segments;
}

function isChordProLine(text: string): boolean {
  return /\[[A-G][^\]]*\]/.test(text);
}

function ChordProLine({ line }: { line: string }) {
  const segments = parseChordPro(line);
  const hasChords = segments.some(s => s.chord);

  if (!hasChords) {
    return <div className="sp-lyrics-line">{line}</div>;
  }

  return (
    <div className="sp-chordpro-line">
      {segments.map((seg, i) => (
        <span key={i} className="sp-chordpro-segment">
          {seg.chord && <span className="sp-chord-inline">{seg.chord}</span>}
          <span className="sp-chord-text">{seg.text || '\u00A0'}</span>
        </span>
      ))}
    </div>
  );
}

function LyricsDisplay({ lyrics, chords }: { lyrics: string; chords: string }) {
  // If lyrics contain ChordPro notation, render inline
  if (lyrics && isChordProLine(lyrics)) {
    return (
      <div className="sp-lyrics">
        {lyrics.split('\n').map((line, i) => (
          <ChordProLine key={i} line={line} />
        ))}
      </div>
    );
  }

  // Otherwise show chords block separately, then lyrics
  return (
    <div className="sp-lyrics">
      {chords && (
        <div className="sp-chords-block">
          {chords.split('\n').map((line, i) => (
            <div key={i} className="sp-chord-line">{line}</div>
          ))}
        </div>
      )}
      {lyrics && chords && <div className="sp-section-divider" />}
      {lyrics && lyrics.split('\n').map((line, i) => (
        <div key={i} className={`sp-lyrics-line ${line.trim() === '' ? 'sp-lyrics-blank' : ''}`}>
          {line || '\u00A0'}
        </div>
      ))}
    </div>
  );
}

export function StagePrompter() {
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [selectedSetlist, setSelectedSetlist] = useState<SetlistWithSongs | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(30); // pixels per second
  const lyricsRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);

  // Load setlists
  useEffect(() => {
    getSetlists().then(list => {
      setSetlists(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Load selected setlist songs
  const loadSetlist = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await getSetlistWithSongs(id);
      if (data) {
        setSelectedSetlist(data);
        setCurrentIndex(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const songs = selectedSetlist?.songs ?? [];
  const currentSong: SetlistSongWithDetails | undefined = songs[currentIndex];

  // Navigate songs
  const goToPrevSong = useCallback(() => {
    setCurrentIndex(i => Math.max(0, i - 1));
  }, []);

  const goToNextSong = useCallback(() => {
    setCurrentIndex(i => Math.min(songs.length - 1, i + 1));
  }, [songs.length]);

  const goToSong = useCallback((index: number) => {
    setCurrentIndex(index);
    setSidebarOpen(false);
  }, []);

  // Reset scroll when song changes
  useEffect(() => {
    if (lyricsRef.current) {
      lyricsRef.current.scrollTop = 0;
    }
  }, [currentIndex]);

  // Auto-scroll
  useEffect(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    if (autoScroll && lyricsRef.current) {
      const el = lyricsRef.current;
      scrollIntervalRef.current = window.setInterval(() => {
        el.scrollTop += scrollSpeed / 60;
      }, 1000 / 60);
    }
    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    };
  }, [autoScroll, scrollSpeed, currentIndex]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Listen for fullscreen change (e.g. user presses Escape)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevSong();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextSong();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 's' || e.key === 'S') {
        setAutoScroll(a => !a);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goToPrevSong, goToNextSong, toggleFullscreen]);

  // Setlist picker
  if (!selectedSetlist) {
    return (
      <div className="sp-container">
        <div className="sp-picker">
          <h2 className="sp-picker-title">Stage Prompter</h2>
          <p className="sp-picker-subtitle">Select a setlist to display on stage</p>
          {loading ? (
            <div className="sp-loading">Loading setlists...</div>
          ) : setlists.length === 0 ? (
            <div className="sp-empty">No setlists found. Create one from the Setlists page.</div>
          ) : (
            <div className="sp-setlist-grid">
              {setlists.map(sl => (
                <button
                  key={sl.id}
                  className="sp-setlist-card"
                  onClick={() => loadSetlist(sl.id)}
                >
                  <span className="sp-setlist-card-name">{sl.name}</span>
                  {sl.description && (
                    <span className="sp-setlist-card-desc">{sl.description}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sp-container">
        <div className="sp-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="sp-container">
      {/* Sidebar */}
      <div className={`sp-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sp-sidebar-header">
          <span className="sp-sidebar-title">{selectedSetlist.name}</span>
          <button className="sp-sidebar-close" onClick={() => setSidebarOpen(false)}>X</button>
        </div>
        <div className="sp-sidebar-songs">
          {songs.map((song, i) => (
            <button
              key={song.id}
              className={`sp-sidebar-song ${i === currentIndex ? 'active' : ''}`}
              onClick={() => goToSong(i)}
            >
              <span className="sp-sidebar-pos">{i + 1}</span>
              <span className="sp-sidebar-name">{song.song_name}</span>
            </button>
          ))}
        </div>
        <button
          className="sp-sidebar-back"
          onClick={() => { setSelectedSetlist(null); setCurrentIndex(0); }}
        >
          Change Setlist
        </button>
      </div>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="sp-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main stage display */}
      <div className="sp-main">
        {/* Top bar */}
        <div className="sp-topbar">
          <div className="sp-topbar-left">
            <button className="sp-btn sp-btn-icon" onClick={() => setSidebarOpen(o => !o)} title="Song list">
              &#9776;
            </button>
            <span className="sp-position">{currentIndex + 1} of {songs.length}</span>
          </div>
          <div className="sp-topbar-center">
            {currentSong && (
              <span className="sp-song-title">{currentSong.song_name}</span>
            )}
          </div>
          <div className="sp-topbar-right">
            <button
              className={`sp-btn sp-btn-small ${autoScroll ? 'sp-btn-active' : ''}`}
              onClick={() => setAutoScroll(a => !a)}
              title="Auto-scroll (S)"
            >
              {autoScroll ? 'Stop' : 'Scroll'}
            </button>
            {autoScroll && (
              <input
                type="range"
                className="sp-speed-slider"
                min={10}
                max={120}
                value={scrollSpeed}
                onChange={e => setScrollSpeed(Number(e.target.value))}
                title={`Speed: ${scrollSpeed}px/s`}
              />
            )}
            <button className="sp-btn sp-btn-small" onClick={toggleFullscreen} title="Fullscreen (F)">
              {isFullscreen ? 'Exit' : 'Full'}
            </button>
          </div>
        </div>

        {/* Song content */}
        {currentSong ? (
          <>
            {/* Info bar */}
            <div className="sp-infobar">
              {currentSong.song_key && (
                <span className="sp-info-tag sp-info-key">{currentSong.song_key}</span>
              )}
              {currentSong.song_bpm > 0 && (
                <span className="sp-info-tag sp-info-bpm">{currentSong.song_bpm} BPM</span>
              )}
              <span className="sp-info-tag sp-info-time">
                {formatTimeSig(currentSong.song_time_signature_top, currentSong.song_time_signature_bottom)}
              </span>
              {currentSong.song_duration_seconds && (
                <span className="sp-info-tag sp-info-dur">
                  {formatDuration(currentSong.song_duration_seconds)}
                </span>
              )}
              {currentSong.song_artist && (
                <span className="sp-info-tag sp-info-artist">{currentSong.song_artist}</span>
              )}
            </div>

            {/* Lyrics/chords area */}
            <div className="sp-lyrics-area" ref={lyricsRef}>
              <LyricsDisplay
                lyrics={currentSong.song_lyrics}
                chords={currentSong.song_chords}
              />

              {/* Song notes */}
              {(currentSong.song_notes || currentSong.notes) && (
                <div className="sp-notes">
                  {currentSong.song_notes && (
                    <div className="sp-notes-block">
                      <span className="sp-notes-label">Notes</span>
                      <span className="sp-notes-text">{currentSong.song_notes}</span>
                    </div>
                  )}
                  {currentSong.notes && (
                    <div className="sp-notes-block">
                      <span className="sp-notes-label">Setlist Notes</span>
                      <span className="sp-notes-text">{currentSong.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom nav */}
            <div className="sp-nav">
              <button
                className="sp-nav-btn sp-nav-prev"
                onClick={goToPrevSong}
                disabled={currentIndex === 0}
              >
                Prev
              </button>
              <span className="sp-nav-current">{currentSong.song_name}</span>
              <button
                className="sp-nav-btn sp-nav-next"
                onClick={goToNextSong}
                disabled={currentIndex === songs.length - 1}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <div className="sp-empty">No songs in this setlist.</div>
        )}
      </div>
    </div>
  );
}
