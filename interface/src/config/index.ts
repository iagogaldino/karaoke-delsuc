// Frontend configuration

export const API_CONFIG = {
  BASE_URL: '', // Empty for same origin
  ENDPOINTS: {
    SONGS: '/api/songs',
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
  MIN_BUFFER: 3, // seconds
  BUFFER_TIMEOUT: 10000, // ms
  BUFFER_CHECK_INTERVAL: 500, // ms
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
