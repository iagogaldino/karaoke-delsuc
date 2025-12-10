import { Request, Response } from 'express';
import {
  getAllBands,
  getBandById,
  addBand,
  updateBand,
  removeBand,
  moveSongToBand,
} from '../utils/database.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

/**
 * GET /api/bands
 * List all bands
 */
export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const bands = getAllBands();
  res.json({
    bands,
    total: bands.length
  });
});

/**
 * GET /api/bands/:id
 * Get a specific band
 */
export const getById = asyncHandler(async (req: Request, res: Response) => {
  const band = getBandById(req.params.id);
  
  if (!band) {
    return res.status(404).json({ error: 'Band not found' });
  }

  res.json(band);
});

/**
 * POST /api/bands
 * Create a new band
 */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const { name, description } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Band name is required' });
  }

  try {
    const newBand = addBand(name.trim(), description);
    res.status(201).json(newBand);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    throw error;
  }
});

/**
 * PUT /api/bands/:id
 * Update an existing band
 */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const updates = req.body;
  const updatedBand = updateBand(req.params.id, updates);

  if (!updatedBand) {
    return res.status(404).json({ error: 'Band not found' });
  }

  res.json(updatedBand);
});

/**
 * DELETE /api/bands/:id
 * Remove a band (removes band from songs)
 */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const deleted = removeBand(req.params.id);

  if (!deleted) {
    return res.status(404).json({ error: 'Band not found' });
  }

  res.json({ message: 'Band deleted successfully' });
});

/**
 * POST /api/bands/move-song
 * Move a song to a band
 */
export const moveSong = asyncHandler(async (req: Request, res: Response) => {
  const { songId, bandId } = req.body;
  const finalBandId = bandId === null || bandId === undefined || bandId === 'null' || bandId === 'none' ? null : bandId;

  if (!songId) {
    return res.status(400).json({ error: 'songId is required' });
  }

  try {
    const updatedSong = moveSongToBand(songId, finalBandId);
    
    if (!updatedSong) {
      return res.status(404).json({ error: 'Song not found' });
    }

    res.json(updatedSong);
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    throw error;
  }
});

