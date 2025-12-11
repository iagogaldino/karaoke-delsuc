import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root (3 levels up from backend/src/config)
export const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// Server configuration
export const SERVER_CONFIG = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_MOBILE_URL: process.env.CLIENT_MOBILE_URL || 'http://localhost:4200',
};

// File paths configuration
export const PATHS = {
  MUSIC_DIR: join(PROJECT_ROOT, 'music'),
  TEMP_DIR: join(PROJECT_ROOT, 'temp'),
  DATABASE: join(PROJECT_ROOT, 'music', 'database.json'),
  USERS_DATABASE: join(PROJECT_ROOT, 'music', 'users.json'),
  USERS_PHOTOS_DIR: join(PROJECT_ROOT, 'music', 'users-photos'),
};

// Processing configuration
export const PROCESSING_CONFIG = {
  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB
  CHUNK_SIZE: 100000, // ~10MB per chunk
  STATUS_CLEANUP_TIME: 3600000, // 1 hour in ms
};

// Audio/Video configuration
export const MEDIA_CONFIG = {
  ALLOWED_AUDIO_EXTENSIONS: ['mp3', 'wav', 'm4a', 'flac', 'ogg'],
  ALLOWED_VIDEO_EXTENSIONS: ['mp4', 'mkv', 'webm', 'avi'],
  WAVEFORM_PREVIEW_SAMPLE_RATE: 1000,
};

// WebSocket configuration
export const WEBSOCKET_CONFIG = {
  PATH: '/ws/sync',
  TIME_UPDATE_INTERVAL: 100, // ms
};
