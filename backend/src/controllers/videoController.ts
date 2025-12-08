import { Request, Response } from 'express';
import { getSongById } from '../utils/database.js';
import { getVideoPath } from '../services/songPathService.js';
import { serveFile } from '../services/fileService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

/**
 * GET /api/video?song=id
 * Stream video with Range Request support
 */
export const getVideo = asyncHandler(async (req: Request, res: Response) => {
  const songId = req.query.song as string;
  
  if (!songId) {
    return res.status(400).json({ error: 'Song ID is required' });
  }

  const song = getSongById(songId);
  if (!song || !song.files?.video) {
    return res.status(404).json({ error: 'Video not found for this song' });
  }

  const videoPath = getVideoPath(songId);
  if (!videoPath) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  serveFile(videoPath, req, res, 'video/mp4');
});
