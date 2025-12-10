import { Request, Response } from 'express';
import {
  getSongScore,
  saveSongScore,
  addResultToScore,
  getAllSongScores,
  deleteSongScores,
  getAllScores as getAllScoresFromDb
} from '../utils/scoresDatabase.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { LyricResult } from '../types/index.js';
import { getAllUsers } from '../utils/usersDatabase.js';
import { getAllSongs } from '../utils/database.js';

/**
 * GET /api/scores/:songId
 * Get score for a song
 */
export const getScore = asyncHandler(async (req: Request, res: Response) => {
  const { songId } = req.params;
  const sessionId = req.query.sessionId as string | undefined;
  
  const score = getSongScore(songId, sessionId);
  
  if (!score) {
    return res.status(404).json({ error: 'Score not found' });
  }
  
  res.json(score);
});

/**
 * POST /api/scores/:songId
 * Save or update score for a song
 */
export const saveScore = asyncHandler(async (req: Request, res: Response) => {
  const { songId } = req.params;
  const { results, maxPossiblePoints, sessionId } = req.body;
  
  if (!results || !Array.isArray(results)) {
    return res.status(400).json({ error: 'Results array is required' });
  }
  
  if (typeof maxPossiblePoints !== 'number') {
    return res.status(400).json({ error: 'maxPossiblePoints is required' });
  }
  
  const score = saveSongScore(songId, results as LyricResult[], maxPossiblePoints, sessionId);
  res.json(score);
});

/**
 * POST /api/scores/:songId/add-result
 * Add a result to existing score
 */
export const addResult = asyncHandler(async (req: Request, res: Response) => {
  const { songId } = req.params;
  const { result, maxPossiblePoints, sessionId } = req.body;
  
  if (!result) {
    return res.status(400).json({ error: 'Result is required' });
  }
  
  if (typeof maxPossiblePoints !== 'number') {
    return res.status(400).json({ error: 'maxPossiblePoints is required' });
  }
  
  const score = addResultToScore(songId, result as LyricResult, maxPossiblePoints, sessionId);
  res.json(score);
});

/**
 * GET /api/scores/:songId/all
 * Get all scores for a song
 */
export const getAllScores = asyncHandler(async (req: Request, res: Response) => {
  const { songId } = req.params;
  const scores = getAllSongScores(songId);
  res.json({ scores, total: scores.length });
});

/**
 * GET /api/scores/user/:sessionId
 * Get user information from the last score by sessionId
 */
export const getUserInfo = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  // Buscar todos os scores e encontrar o último do sessionId
  const allScores = getAllScoresFromDb();
  const userScores = allScores
    .filter(score => score.sessionId === sessionId)
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime; // Mais recente primeiro
    });

  if (userScores.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Tentar encontrar informações do usuário pelo telefone no QR code
  // Por enquanto, retornar apenas sessionId
  // TODO: Melhorar para buscar informações reais do usuário
  res.json({
    sessionId,
    // Se houver associação com QR code, incluir userName e userPhoto aqui
  });
});

/**
 * DELETE /api/scores/:songId
 * Delete all scores for a song
 */
export const deleteScores = asyncHandler(async (req: Request, res: Response) => {
  const { songId } = req.params;
  const deleted = deleteSongScores(songId);
  
  if (!deleted) {
    return res.status(404).json({ error: 'No scores found to delete' });
  }
  
  res.json({ message: 'Scores deleted successfully' });
});

/**
 * GET /api/scores/ranking
 * Retorna o ranking de jogadores
 */
export const getRanking = asyncHandler(async (req: Request, res: Response) => {
  const allScores = getAllScoresFromDb();
  const users = getAllUsers();
  const songs = getAllSongs();
  
  // Mapa para associar sessionId com userName (via QR codes)
  // Por enquanto, vamos usar sessionId como identificador
  // Agrupar scores por sessionId e pegar o melhor score de cada
  const userScoresMap = new Map<string, { 
    bestScore: number; 
    bestSongId: string;
    bestSongName: string;
    totalScore: number;
    playCount: number;
  }>();

  // Processar todos os scores
  allScores.forEach(score => {
    if (!score.sessionId) return;
    
    const existing = userScoresMap.get(score.sessionId);
    const currentPoints = score.score.points;
    
    if (existing) {
      if (currentPoints > existing.bestScore) {
        existing.bestScore = currentPoints;
        existing.bestSongId = score.songId;
        const song = songs.find(s => s.id === score.songId);
        existing.bestSongName = song?.displayName || song?.name || 'Desconhecida';
      }
      existing.totalScore += currentPoints;
      existing.playCount += 1;
    } else {
      const song = songs.find(s => s.id === score.songId);
      userScoresMap.set(score.sessionId, {
        bestScore: currentPoints,
        bestSongId: score.songId,
        bestSongName: song?.displayName || song?.name || 'Desconhecida',
        totalScore: currentPoints,
        playCount: 1
      });
    }
  });

  // Converter para array e ordenar por melhor score
  const ranking = Array.from(userScoresMap.entries())
    .map(([sessionId, data]) => {
      // Tentar encontrar usuário pelo sessionId (por enquanto usar sessionId como fallback)
      // TODO: Melhorar associação entre sessionId e usuário
      const user = users.find(u => u.phone === sessionId) || null;
      
      return {
        position: 0, // Será preenchido depois
        sessionId,
        name: user?.name || `Jogador ${sessionId.substring(0, 8)}`,
        score: data.bestScore,
        bestSong: data.bestSongName,
        photo: user?.photo || null,
        totalScore: data.totalScore,
        playCount: data.playCount
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({
      ...entry,
      position: index + 1
    }));

  res.json({
    ranking: ranking.slice(0, 100), // Top 100
    total: ranking.length
  });
});
