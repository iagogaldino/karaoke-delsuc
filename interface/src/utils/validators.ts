import { ALLOWED_AUDIO_TYPES } from '../config/index.js';

/**
 * Validate audio file type
 */
export function isValidAudioFile(file: File): boolean {
  return ALLOWED_AUDIO_TYPES.some(
    (type) =>
      file.type.includes(type.split('/')[1] || '') || type === 'audio/*'
  );
}

/**
 * Validate music name
 */
export function isValidMusicName(name: string): boolean {
  return name && name.trim().length > 0;
}

/**
 * Validate YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  const trimmedUrl = url.trim();
  
  // Padrões de URL do YouTube
  const youtubePatterns = [
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+$/i,
    /^https?:\/\/youtube\.com\/watch\?v=[\w-]+/i,
    /^https?:\/\/youtu\.be\/[\w-]+/i,
    /^https?:\/\/www\.youtube\.com\/watch\?v=[\w-]+/i,
    /^https?:\/\/m\.youtube\.com\/watch\?v=[\w-]+/i,
  ];
  
  return youtubePatterns.some(pattern => pattern.test(trimmedUrl));
}
