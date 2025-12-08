import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config/index.js';
import { SongScore, LyricResult, PlayerScore } from '../types/index.js';

const SCORES_DATABASE_PATH = join(PATHS.MUSIC_DIR, 'scores.json');

interface ScoresDatabase {
  version: string;
  lastUpdated: string;
  scores: SongScore[];
}

/**
 * Carrega o banco de dados de pontuações
 */
function loadScoresDatabase(): ScoresDatabase {
  try {
    if (!existsSync(SCORES_DATABASE_PATH)) {
      const emptyDb: ScoresDatabase = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        scores: []
      };
      saveScoresDatabase(emptyDb);
      return emptyDb;
    }

    const content = readFileSync(SCORES_DATABASE_PATH, 'utf-8');
    return JSON.parse(content) as ScoresDatabase;
  } catch (error) {
    console.error('Error loading scores database:', error);
    throw new Error('Failed to load scores database');
  }
}

/**
 * Salva o banco de dados de pontuações
 */
function saveScoresDatabase(database: ScoresDatabase): void {
  try {
    database.lastUpdated = new Date().toISOString();
    writeFileSync(SCORES_DATABASE_PATH, JSON.stringify(database, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving scores database:', error);
    throw new Error('Failed to save scores database');
  }
}

/**
 * Calcula a pontuação do jogador baseado nos resultados
 */
function calculatePlayerScore(results: LyricResult[]): PlayerScore {
  if (results.length === 0) {
    return { total: 0, average: 0, count: 0, points: 0 };
  }

  // Calcular pontos acumulados: cada palavra acertada vale 100 pontos
  const totalPoints = results.reduce((sum, result) => {
    const trechoPoints = result.score * 100;
    return sum + trechoPoints;
  }, 0);

  // Calcular média
  const totalPercentage = results.reduce((sum, result) => sum + result.percentage, 0);
  const average = Math.round(totalPercentage / results.length);

  return {
    total: totalPercentage,
    average,
    count: results.length,
    points: totalPoints
  };
}

/**
 * Busca pontuação de uma música
 */
export function getSongScore(songId: string, sessionId?: string): SongScore | null {
  const db = loadScoresDatabase();
  
  if (sessionId) {
    return db.scores.find(score => 
      score.songId === songId && score.sessionId === sessionId
    ) || null;
  }
  
  // Retornar a pontuação mais recente se não houver sessionId
  const scores = db.scores
    .filter(score => score.songId === songId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  
  return scores[0] || null;
}

/**
 * Salva ou atualiza pontuação de uma música
 */
export function saveSongScore(
  songId: string,
  results: LyricResult[],
  maxPossiblePoints: number,
  sessionId?: string
): SongScore {
  const db = loadScoresDatabase();
  
  const score = calculatePlayerScore(results);
  
  // Procurar pontuação existente
  let existingScore: SongScore | undefined;
  if (sessionId) {
    existingScore = db.scores.find(s => 
      s.songId === songId && s.sessionId === sessionId
    );
  } else {
    // Se não houver sessionId, usar a mais recente
    const scores = db.scores
      .filter(s => s.songId === songId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    existingScore = scores[0];
  }
  
  const now = new Date().toISOString();
  
  if (existingScore) {
    // Atualizar pontuação existente
    existingScore.results = results;
    existingScore.score = score;
    existingScore.maxPossiblePoints = maxPossiblePoints;
    existingScore.updatedAt = now;
    
    saveScoresDatabase(db);
    return existingScore;
  } else {
    // Criar nova pontuação
    const newScore: SongScore = {
      songId,
      sessionId,
      results,
      score,
      maxPossiblePoints,
      createdAt: now,
      updatedAt: now
    };
    
    db.scores.push(newScore);
    saveScoresDatabase(db);
    return newScore;
  }
}

/**
 * Adiciona um resultado a uma pontuação existente
 */
export function addResultToScore(
  songId: string,
  result: LyricResult,
  maxPossiblePoints: number,
  sessionId?: string
): SongScore {
  const db = loadScoresDatabase();
  
  // Procurar pontuação existente
  let existingScore: SongScore | undefined;
  if (sessionId) {
    existingScore = db.scores.find(s => 
      s.songId === songId && s.sessionId === sessionId
    );
  } else {
    const scores = db.scores
      .filter(s => s.songId === songId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    existingScore = scores[0];
  }
  
  const now = new Date().toISOString();
  
  if (existingScore) {
    // Adicionar resultado à lista existente
    existingScore.results.push(result);
    existingScore.score = calculatePlayerScore(existingScore.results);
    existingScore.maxPossiblePoints = maxPossiblePoints;
    existingScore.updatedAt = now;
    
    saveScoresDatabase(db);
    return existingScore;
  } else {
    // Criar nova pontuação com o primeiro resultado
    const newScore: SongScore = {
      songId,
      sessionId,
      results: [result],
      score: calculatePlayerScore([result]),
      maxPossiblePoints,
      createdAt: now,
      updatedAt: now
    };
    
    db.scores.push(newScore);
    saveScoresDatabase(db);
    return newScore;
  }
}

/**
 * Lista todas as pontuações de uma música
 */
export function getAllSongScores(songId: string): SongScore[] {
  const db = loadScoresDatabase();
  return db.scores.filter(score => score.songId === songId);
}

/**
 * Remove pontuações de uma música
 */
export function deleteSongScores(songId: string): boolean {
  const db = loadScoresDatabase();
  const initialLength = db.scores.length;
  db.scores = db.scores.filter(score => score.songId !== songId);
  
  if (db.scores.length < initialLength) {
    saveScoresDatabase(db);
    return true;
  }
  return false;
}

/**
 * Retorna todos os scores
 */
export function getAllScores(): SongScore[] {
  const db = loadScoresDatabase();
  return db.scores;
}