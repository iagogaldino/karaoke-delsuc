// Types for the Karaoke Frontend

export interface Song {
  id: string;
  name: string;
  displayName: string;
  artist: string;
  duration: number;
  status: SongStatus;
  files?: {
    video?: string;
    original?: string;
    vocals?: string;
    instrumental?: string;
    waveform?: string;
    lyrics?: string;
  };
  metadata?: {
    sampleRate: number;
    format: string;
    createdAt: string;
    lastProcessed?: string;
  };
  video?: VideoInfo;
  audioMode?: AudioMode;
  generateLRCAfterRecording?: boolean;
  category?: string; // ID da categoria/pasta
  band?: string; // ID da banda/artista
}

export interface SongStatus {
  ready: boolean;
  vocals: boolean;
  instrumental: boolean;
  waveform: boolean;
  lyrics: boolean;
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

export interface LyricsLine {
  time: number;
  text: string;
}

export interface LyricsJson {
  lyrics: LyricsLine[];
  totalLines: number;
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

export type AudioMode = 'both' | 'vocals-only' | 'instrumental-only';

export interface SyncMessage {
  type: 'play' | 'pause' | 'seek' | 'getTime' | 'timeUpdate' | 'stateChanged' | 'error' | 'qrcodeNameSubmitted' | 'qrcodeSongSelected' | 'qrcodeGiveUp';
  timestamp?: number;
  state?: 'playing' | 'paused';
  message?: string;
  qrId?: string;
  userName?: string;
  songId?: string;
}

// Web Speech API types
export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface WordMatchResult {
  correct: number;
  total: number;
  percentage: number;
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

export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Band {
  id: string;
  name: string;
  description?: string;
  category?: string; // Categoria padrão da banda (quando não tem músicas)
  createdAt: string;
  updatedAt: string;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}
