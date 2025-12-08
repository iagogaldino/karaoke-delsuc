import { Request, Response } from 'express';
import {
  getAllSongs,
  getSongById,
  addSong,
  updateSong,
  removeSong,
  refreshAllSongStatuses,
} from '../utils/database.js';
import { join } from 'path';
import { existsSync, rmSync } from 'fs';
import { PROJECT_ROOT } from '../config/index.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

/**
 * GET /api/songs
 * List all songs
 */
export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const songs = getAllSongs();
  res.json({
    songs,
    total: songs.length
  });
});

/**
 * GET /api/songs/:id
 * Get a specific song
 */
export const getById = asyncHandler(async (req: Request, res: Response) => {
  const song = getSongById(req.params.id);
  
  if (!song) {
    return res.status(404).json({ error: 'Song not found' });
  }

  res.json(song);
});

/**
 * POST /api/songs
 * Add a new song
 */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const songData = req.body;
  
  // Basic validation
  if (!songData.id || !songData.name || !songData.files) {
    return res.status(400).json({ error: 'Missing required fields: id, name, files' });
  }

  try {
    const newSong = addSong(songData);
    res.status(201).json(newSong);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    throw error;
  }
});

/**
 * PUT /api/songs/:id
 * Update an existing song
 */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const updates = req.body;
  const updatedSong = updateSong(req.params.id, updates);

  if (!updatedSong) {
    return res.status(404).json({ error: 'Song not found' });
  }

  res.json(updatedSong);
});

/**
 * DELETE /api/songs/:id
 * Remove a song and its files
 */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const songId = req.params.id;
  const song = getSongById(songId);

  if (!song) {
    return res.status(404).json({ error: 'Song not found' });
  }

  // Remove from database
  const deleted = removeSong(songId);

  if (!deleted) {
    return res.status(404).json({ error: 'Song not found' });
  }

  // Remove song directory and all files
  const musicDir = join(PROJECT_ROOT, 'music', songId);
  if (existsSync(musicDir)) {
    try {
      rmSync(musicDir, { recursive: true, force: true });
      console.log(`✅ Diretório removido: ${musicDir}`);
    } catch (err: any) {
      console.error(`⚠️  Erro ao remover diretório ${musicDir}:`, err.message);
      // Continue even if there's an error removing files
    }
  }

  res.json({ message: 'Song deleted successfully' });
});

/**
 * POST /api/songs/refresh
 * Refresh status of all songs
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  refreshAllSongStatuses();
  const songs = getAllSongs();
  res.json({
    message: 'Song statuses refreshed',
    songs,
    total: songs.length
  });
});
