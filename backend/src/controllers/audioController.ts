import { Request, Response } from 'express';
import { statSync } from 'fs';
import { serveFile } from '../services/fileService.js';
import { getAudioPaths } from '../services/songPathService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { AudioInfo } from '../types/index.js';

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
