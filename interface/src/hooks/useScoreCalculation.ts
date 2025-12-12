import { useCallback } from 'react';
import { recordingService } from '../services/recordingService.js';
import { lyricsService } from '../services/lyricsService.js';
import { parseLRC, alignLRCLinesByTextOnly, calculateScoreFromLRCAlignment } from '../utils/textUtils.js';

/**
 * Hook para calcular pontuação baseada em LRC gravado
 */
export function useScoreCalculation() {
  const calculateScoreFromRecordedLRC = useCallback(async (
    songId: string,
    recordingId?: string
  ): Promise<{ results: Array<{ lyric: string; score: number; percentage: number; totalWords: number }>; totalScore: number } | null> => {
    try {
      // O backend agora aguarda o LRC ser criado antes de retornar sucesso
      const recordedLRCContent = await recordingService.getRecordingLRC(songId, recordingId);

      // Carregar letras originais
      const originalLyricsData = await lyricsService.getJson(songId);

      const recordedLyrics = parseLRC(recordedLRCContent);
      const originalLyrics = originalLyricsData.lyrics || [];

      if (originalLyrics.length === 0 || recordedLyrics.length === 0) {
        console.warn('⚠️ Não há letras originais ou gravadas para comparar');
        return null;
      }

      // Usar alinhamento apenas por texto (mesma forma que LRCComparison)
      const alignments = alignLRCLinesByTextOnly(originalLyrics, recordedLyrics, 0.3);

      // Calcular pontuação
      const scoreResult = calculateScoreFromLRCAlignment(alignments);

      return scoreResult;
    } catch (error: any) {
      console.error('❌ Erro ao calcular pontuação do LRC:', error);
      return null;
    }
  }, []);

  return { calculateScoreFromRecordedLRC };
}
