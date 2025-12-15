import { Request, Response } from 'express';
import { statSync, existsSync } from 'fs';
import { join } from 'path';
import { serveFile } from '../services/fileService.js';
import { getAudioPaths } from '../services/songPathService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { AudioInfo } from '../types/index.js';
import { PROJECT_ROOT } from '../config/index.js';
import { execPython } from '../services/processingService.js';

/**
 * GET /api/audio/vocals?song=id
 * Stream vocals audio with Range Request support
 */
export const getVocals = asyncHandler(async (req: Request, res: Response) => {
  const songId = req.query.song as string;
  const paths = getAudioPaths(songId);
  
  if (!paths) {
    return res.status(404).json({ error: 'Song not found' });
  }
  
  serveFile(paths.vocals, req, res, 'audio/wav');
});

/**
 * GET /api/audio/instrumental?song=id
 * Stream instrumental audio with Range Request support
 */
export const getInstrumental = asyncHandler(async (req: Request, res: Response) => {
  const songId = req.query.song as string;
  const paths = getAudioPaths(songId);
  
  if (!paths) {
    return res.status(404).json({ error: 'Song not found' });
  }
  
  serveFile(paths.instrumental, req, res, 'audio/wav');
});

/**
 * GET /api/audio/info?song=id
 * Returns information about audio files
 */
export const getAudioInfo = asyncHandler(async (req: Request, res: Response) => {
  const songId = req.query.song as string;
  const paths = getAudioPaths(songId);
  
  if (!paths) {
    return res.status(404).json({ error: 'Song not found' });
  }
  
  const vocalsStats = statSync(paths.vocals);
  const instrumentalStats = statSync(paths.instrumental);

  const info: AudioInfo = {
    songId: songId || 'default',
    vocals: {
      size: vocalsStats.size,
      sizeMB: (vocalsStats.size / (1024 * 1024)).toFixed(2),
      lastModified: vocalsStats.mtime.toISOString()
    },
    instrumental: {
      size: instrumentalStats.size,
      sizeMB: (instrumentalStats.size / (1024 * 1024)).toFixed(2),
      lastModified: instrumentalStats.mtime.toISOString()
    }
  };

  res.json(info);
});

/**
 * GET /api/audio/segment?song=id&start=0&end=10
 * Extract and serve audio segment
 */
export const getAudioSegment = asyncHandler(async (req: Request, res: Response) => {
  const songId = req.query.song as string;
  const startTime = parseFloat(req.query.start as string);
  const endTime = parseFloat(req.query.end as string);

  if (!songId) {
    return res.status(400).json({ error: 'Song ID é obrigatório' });
  }

  if (isNaN(startTime) || isNaN(endTime) || startTime < 0 || endTime <= startTime) {
    return res.status(400).json({ error: 'start e end devem ser números válidos com start < end' });
  }

  const paths = getAudioPaths(songId);
  if (!paths || !existsSync(paths.vocals)) {
    return res.status(404).json({ error: 'Arquivo de vocais não encontrado' });
  }

  // Criar nome único para o cache do trecho
  const segmentHash = `${songId}_${startTime.toFixed(2)}_${endTime.toFixed(2)}`;
  const musicDir = join(PROJECT_ROOT, 'music', songId);
  const segmentPath = join(musicDir, `temp_segment_${segmentHash}.wav`);

  // Extrair trecho se não existir
  if (!existsSync(segmentPath)) {
    const duration = endTime - startTime;
    const extractScript = join(PROJECT_ROOT, 'youtube-downloader', 'extract_audio_segment.py');

    if (!existsSync(extractScript)) {
      return res.status(500).json({ error: 'Script de extração não encontrado' });
    }

    try {
      await execPython(
        `python "${extractScript}" "${paths.vocals}" "${segmentPath}" "${startTime}" "${duration}" "0.5"`,
        undefined,
        `[Extract Segment]`
      );

      if (!existsSync(segmentPath)) {
        return res.status(500).json({ error: 'Falha ao extrair trecho de áudio' });
      }
    } catch (error: any) {
      console.error('Erro ao extrair trecho:', error);
      return res.status(500).json({ error: `Erro ao extrair trecho: ${error.message}` });
    }
  }

  // Servir o arquivo
  serveFile(segmentPath, req, res, 'audio/wav');
});
