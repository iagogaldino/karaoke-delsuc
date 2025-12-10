import { apiService } from './api.js';
import { API_CONFIG } from '../config/index.js';
import { Band } from '../types/index.js';

export const bandsService = {
  async getAll(): Promise<Band[]> {
    const response = await apiService.get<{ bands: Band[]; total: number }>(
      API_CONFIG.ENDPOINTS.BANDS
    );
    return response.bands || [];
  },

  async getById(id: string): Promise<Band> {
    return await apiService.get<Band>(`${API_CONFIG.ENDPOINTS.BANDS}/${id}`);
  },

  async create(name: string, description?: string): Promise<Band> {
    return await apiService.post<Band>(API_CONFIG.ENDPOINTS.BANDS, {
      name,
      description
    });
  },

  async update(id: string, updates: Partial<Band>): Promise<Band> {
    return await apiService.put<Band>(`${API_CONFIG.ENDPOINTS.BANDS}/${id}`, updates);
  },

  async delete(id: string): Promise<void> {
    await apiService.delete(`${API_CONFIG.ENDPOINTS.BANDS}/${id}`);
  },

  async moveSong(songId: string, bandId: string | null): Promise<void> {
    await apiService.post(`${API_CONFIG.ENDPOINTS.BANDS}/move-song`, { 
      songId, 
      bandId 
    });
  }
};

