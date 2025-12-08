// Types for the Karaoke Backend

export interface SongFile {
  original?: string;
  vocals: string;
  instrumental: string;
  waveform: string;
  lyrics: string;
  video?: string;
}

export interface SongMetadata {
  sampleRate: number;
  format: string;
  createdAt: string;
  lastProcessed?: string;
}

export interface SongStatus {
  vocals: boolean;
  instrumental: boolean;
  waveform: boolean;
  lyrics: boolean;
  ready: boolean;
}

export interface VideoInfo {
  id?: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  duration?: number;
  file?: string;
  uploader?: string;
  view_count?: number;
  file_size?: number;
}

export type AudioMode = 'both' | 'vocals-only' | 'instrumental-only';

export interface Song {
  id: string;
  name: string;
  displayName: string;
  artist: string;
  duration: number;
  files: SongFile;
  metadata: SongMetadata;
  status: SongStatus;
  video?: VideoInfo;
  audioMode?: AudioMode;
}

export interface Database {
  version: string;
  lastUpdated: string;
  songs: Song[];
}

export interface WaveformData {
  sample_rate: number;
  duration: number;
  num_samples: number;
  waveform: number[];
}

export interface SyncMessage {
  type: 'play' | 'pause' | 'seek' | 'getTime' | 'timeUpdate' | 'stateChanged' | 'qrcodeNameSubmitted' | 'qrcodeSongSelected' | 'qrcodeGiveUp';
  timestamp?: number;
  state?: 'playing' | 'paused';
  qrId?: string;
  userName?: string;
  songId?: string;
}

export interface ProcessingStatus {
  status: 'pending' | 'processing' | 'completed' | 'error';
  step: string;
  progress: number;
  error?: string;
  songId?: string;
}

export interface AudioInfo {
  songId: string;
  vocals: {
    size: number;
    sizeMB: string;
    lastModified: string;
  };
  instrumental: {
    size: number;
    sizeMB: string;
    lastModified: string;
  };
}

export interface WaveformMetadata {
  sample_rate: number;
  duration: number;
  num_samples: number;
  totalChunks: number;
  preview: number[];
  previewLength: number;
  songId: string;
}

export interface WaveformChunk {
  start: number;
  end: number;
  data: number[];
  length: number;
}

export interface LyricsLine {
  time: number;
  text: string;
}

export interface LyricsJson {
  lyrics: LyricsLine[];
  totalLines: number;
}

export interface LyricResult {
  lyric: string;
  score: number;
  percentage: number;
  totalWords: number;
}

export interface PlayerScore {
  total: number;
  average: number;
  count: number;
  points: number;
}

export interface SongScore {
  songId: string;
  sessionId?: string;
  results: LyricResult[];
  score: PlayerScore;
  maxPossiblePoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  createdAt: string;
  lastPlayedAt?: string;
}

export interface UserDatabase {
  version: string;
  lastUpdated: string;
  users: User[];
}