import { apiService } from './api.js';

export interface User {
  name: string;
  phone: string;
  photo?: string;
  createdAt: string;
  lastPlayedAt?: string;
}

export interface UsersResponse {
  users: User[];
  total: number;
}

class UsersService {
  /**
   * Lista todos os usuários
   */
  async getAll(): Promise<User[]> {
    const response = await apiService.get<UsersResponse>('/api/users');
    return response.users || [];
  }

  /**
   * Busca um usuário pelo telefone
   */
  async getByPhone(phone: string): Promise<User | null> {
    try {
      return await apiService.get<User>(`/api/users/by-phone/${encodeURIComponent(phone)}`);
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }
}

export const usersService = new UsersService();
