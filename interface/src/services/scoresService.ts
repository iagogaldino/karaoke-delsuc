import { apiService } from './api.js';
import { API_CONFIG } from '../config/index.js';
import { SongScore, LyricResult, PlayerScore } from '../types/index.js';

/**
 * Scores API service
 */
export const scoresService = {
  /**
   * Get score for a song
   */
  async getScore(songId: string, sessionId?: string): Promise<SongScore | null> {
    try {
      const endpoint = sessionId
        ? `${API_CONFIG.ENDPOINTS.SCORES}/${songId}?sessionId=${sessionId}`
        : `${API_CONFIG.ENDPOINTS.SCORES}/${songId}`;
      return await apiService.get<SongScore>(endpoint);
    } catch (error: any) {
      if (error.message.includes('404') || error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Save or update score for a song
   */
  async saveScore(
    songId: string,
    results: LyricResult[],
    maxPossiblePoints: number,
    sessionId?: string
  ): Promise<SongScore> {
    return apiService.post<SongScore>(
      `${API_CONFIG.ENDPOINTS.SCORES}/${songId}`,
      { results, maxPossiblePoints, sessionId }
    );
  },

  /**
   * Add a result to existing score
   */
  async addResult(
    songId: string,
    result: LyricResult,
    maxPossiblePoints: number,
    sessionId?: string
  ): Promise<SongScore> {
    return apiService.post<SongScore>(
      `${API_CONFIG.ENDPOINTS.SCORES}/${songId}/add-result`,
      { result, maxPossiblePoints, sessionId }
    );
  },

  /**
   * Get all scores for a song
   */
  async getAllScores(songId: string): Promise<SongScore[]> {
    const response = await apiService.get<{ scores: SongScore[]; total: number }>(
      `${API_CONFIG.ENDPOINTS.SCORES}/${songId}/all`
    );
    return response.scores || [];
  },

  /**
   * Delete all scores for a song
   */
  async deleteScores(songId: string): Promise<void> {
    await apiService.delete(`${API_CONFIG.ENDPOINTS.SCORES}/${songId}`);
  },
};
