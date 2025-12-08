import { apiService } from './api.js';
import { API_CONFIG } from '../config/index.js';
import { LyricsJson } from '../types/index.js';

/**
 * Lyrics API service
 */
export const lyricsService = {
  /**
   * Get lyrics as LRC text
   */
  async getLrc(songId: string): Promise<string> {
    const response = await fetch(`${API_CONFIG.ENDPOINTS.LYRICS}?song=${songId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch lyrics');
    }
    return await response.text();
  },

  /**
   * Get lyrics as JSON
   */
  async getJson(songId: string): Promise<LyricsJson> {
    return apiService.get<LyricsJson>(`${API_CONFIG.ENDPOINTS.LYRICS}/json?song=${songId}`);
  },

  /**
   * Update a lyrics line
   */
  async updateLine(songId: string, lineIndex: number, newText: string, newTime?: number): Promise<void> {
    await apiService.put(`${API_CONFIG.ENDPOINTS.LYRICS}`, {
      songId,
      lineIndex,
      newText,
      newTime,
    });
  },

  /**
   * Add a new lyrics line
   */
  async addLine(songId: string, time: number, text: string): Promise<void> {
    await apiService.post(`${API_CONFIG.ENDPOINTS.LYRICS}`, {
      songId,
      time,
      text,
    });
  },

  /**
   * Delete a lyrics line
   */
  async deleteLine(songId: string, lineIndex: number): Promise<void> {
    await apiService.delete(`${API_CONFIG.ENDPOINTS.LYRICS}`, {
      songId,
      lineIndex,
    });
  },
};
