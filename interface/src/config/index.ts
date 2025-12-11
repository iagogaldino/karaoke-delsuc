// Frontend configuration
import { getApiBaseUrl } from '../utils/electronUtils.js';

export const API_CONFIG = {
  get BASE_URL() {
    return getApiBaseUrl();
  },
  ENDPOINTS: {
    SONGS: '/api/songs',
    CATEGORIES: '/api/categories',
    BANDS: '/api/bands',
    LYRICS: '/api/lyrics',
    AUDIO: '/api/audio',
    WAVEFORM: '/api/waveform',
    PROCESSING: '/api/processing',
    VIDEO: '/api/video',
    SCORES: '/api/scores',
  },
};

export const WEBSOCKET_CONFIG = {
  PATH: '/ws/sync',
  RECONNECT_DELAY: 3000, // ms
};

export const AUDIO_CONFIG = {
  MIN_BUFFER: 2, // seconds - reduzido para Electron (streaming mais rápido)
  BUFFER_TIMEOUT: 8000, // ms - reduzido para Electron
  BUFFER_CHECK_INTERVAL: 300, // ms - mais frequente para melhor responsividade
  SEEK_TOLERANCE: 0.1, // seconds
};

export const PROCESSING_CONFIG = {
  STATUS_CHECK_INTERVAL: 2000, // ms
  INITIAL_STATUS_DELAY: 1000, // ms
};

export const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/flac',
  'audio/ogg',
  'audio/*',
];
