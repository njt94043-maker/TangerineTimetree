export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  category: string;
  source_url: string;
  source_type: 'tab' | 'wasapi' | 'file_import';
  capture_date: string;
  duration_seconds: number | null;
  bpm: number | null;
  key: string;
  sample_rate: number;
  bitrate: number;
  encoding: string;
  instrument_focus: string;
  difficulty: string;
  practice_category: string;
  personal_notes: string;
  setlist_id: string | null;
  song_id: string | null;
  file_path: string;
  waveform_path: string;
  thumbnail_path: string;
  file_size_bytes: number;
  play_count: number;
  last_played_at: string | null;
  favorite: number;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  usage_count?: number;
}

export interface CaptureSession {
  session_id: string;
  status: 'recording' | 'encoding' | 'complete' | 'failed' | 'cancelled';
  source_type: string;
  tab_title: string;
  error_message: string;
  paused: boolean;
  duration_seconds?: number;
}

export interface Stats {
  total_tracks: number;
  total_duration_seconds: number;
  top_artists: { artist: string; cnt: number }[];
  recent_captures: { id: string; title: string; artist: string; capture_date: string }[];
  category_breakdown: { practice_category: string; cnt: number }[];
}

export type View = 'library' | 'detail' | 'capture' | 'stats' | 'server';
