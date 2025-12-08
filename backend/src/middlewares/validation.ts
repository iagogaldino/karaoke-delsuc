import { Request, Response, NextFunction } from 'express';

/**
 * Validates that songId query parameter exists
 */
export function validateSongId(req: Request, res: Response, next: NextFunction) {
  const songId = req.query.song as string;
  
  if (!songId) {
    return res.status(400).json({ error: 'Song ID is required' });
  }
  
  next();
}

/**
 * Validates range parameters for waveform chunks
 */
export function validateWaveformChunk(req: Request, res: Response, next: NextFunction) {
  const start = parseInt(req.query.start as string, 10);
  const end = req.query.end ? parseInt(req.query.end as string, 10) : undefined;

  if (isNaN(start) || start < 0) {
    return res.status(400).json({ error: 'Invalid start parameter' });
  }

  if (end !== undefined && (isNaN(end) || end < start)) {
    return res.status(400).json({ error: 'Invalid end parameter' });
  }

  next();
}

/**
 * Validates preview rate parameter
 */
export function validatePreviewRate(req: Request, res: Response, next: NextFunction) {
  const rate = req.query.rate ? parseInt(req.query.rate as string, 10) : undefined;

  if (rate !== undefined && (isNaN(rate) || rate < 1)) {
    return res.status(400).json({ error: 'Invalid rate parameter' });
  }

  next();
}
