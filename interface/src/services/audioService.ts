import { apiService } from './api.js';
import { API_CONFIG } from '../config/index.js';
import { AudioInfo } from '../types/index.js';

/**
 * Audio API service
 */
export const audioService = {
  /**
   * Get vocals audio URL
   */
  getVocalsUrl(songId?: string): string {
    const base = `${API_CONFIG.ENDPOINTS.AUDIO}/vocals`;
    return songId ? `${base}?song=${songId}` : base;
  },

  /**
   * Get instrumental audio URL
   */
  getInstrumentalUrl(songId?: string): string {
    const base = `${API_CONFIG.ENDPOINTS.AUDIO}/instrumental`;
    return songId ? `${base}?song=${songId}` : base;
  },

  /**
   * Get audio info
   */
  async getInfo(songId?: string): Promise<AudioInfo> {
    const endpoint = songId
      ? `${API_CONFIG.ENDPOINTS.AUDIO}/info?song=${songId}`
      : `${API_CONFIG.ENDPOINTS.AUDIO}/info`;
    return apiService.get<AudioInfo>(endpoint);
  },
};
