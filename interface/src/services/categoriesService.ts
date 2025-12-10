import { apiService } from './api.js';
import { API_CONFIG } from '../config/index.js';
import { Category } from '../types/index.js';

export const categoriesService = {
  async getAll(): Promise<Category[]> {
    const response = await apiService.get<{ categories: Category[]; total: number }>(
      API_CONFIG.ENDPOINTS.CATEGORIES
    );
    return response.categories || [];
  },

  async getById(id: string): Promise<Category> {
    return await apiService.get<Category>(`${API_CONFIG.ENDPOINTS.CATEGORIES}/${id}`);
  },

  async create(name: string, description?: string): Promise<Category> {
    return await apiService.post<Category>(API_CONFIG.ENDPOINTS.CATEGORIES, {
      name,
      description
    });
  },

  async update(id: string, updates: Partial<Category>): Promise<Category> {
    return await apiService.put<Category>(`${API_CONFIG.ENDPOINTS.CATEGORIES}/${id}`, updates);
  },

  async delete(id: string): Promise<void> {
    await apiService.delete(`${API_CONFIG.ENDPOINTS.CATEGORIES}/${id}`);
  },

  async moveSong(songId: string, categoryId: string | null): Promise<void> {
    await apiService.post(`${API_CONFIG.ENDPOINTS.CATEGORIES}/move-song`, { 
      songId, 
      categoryId 
    });
  }
};

