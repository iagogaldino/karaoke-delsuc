import { apiService } from './api.js';

export interface RankingEntry {
  position: number;
  sessionId: string;
  name: string;
  score: number;
  bestSong: string;
  photo?: string | null;
  totalScore: number;
  playCount: number;
}

export interface RankingResponse {
  ranking: RankingEntry[];
  total: number;
}

class RankingService {
  /**
   * Busca o ranking de jogadores
   */
  async getRanking(): Promise<RankingEntry[]> {
    const response = await apiService.get<RankingResponse>('/api/scores/ranking');
    return response.ranking || [];
  }
}

export const rankingService = new RankingService();
