import { apiService } from './api.js';
import { API_CONFIG } from '../config/index.js';
import { Song } from '../types/index.js';

export interface SongsResponse {
  songs: Song[];
  total: number;
}

/**
 * Songs API service
 */
export const songsService = {
  /**
   * Get all songs
   */
  async getAll(): Promise<Song[]> {
    const response = await apiService.get<SongsResponse>(API_CONFIG.ENDPOINTS.SONGS);
    return response.songs || [];
  },

  /**
   * Get song by ID
   */
  async getById(id: string): Promise<Song> {
    return apiService.get<Song>(`${API_CONFIG.ENDPOINTS.SONGS}/${id}`);
  },

  /**
   * Create a new song
   */
  async create(song: Omit<Song, 'status'>): Promise<Song> {
    return apiService.post<Song>(API_CONFIG.ENDPOINTS.SONGS, song);
  },

  /**
   * Update a song
   */
  async update(id: string, updates: Partial<Song>): Promise<Song> {
    return apiService.put<Song>(`${API_CONFIG.ENDPOINTS.SONGS}/${id}`, updates);
  },

  /**
   * Delete a song
   */
  async delete(id: string): Promise<void> {
    await apiService.delete(`${API_CONFIG.ENDPOINTS.SONGS}/${id}`);
  },

  /**
   * Refresh all song statuses
   */
  async refresh(): Promise<SongsResponse> {
    return apiService.post<SongsResponse>(`${API_CONFIG.ENDPOINTS.SONGS}/refresh`);
  },
};
