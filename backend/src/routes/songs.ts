import { Router, Request, Response } from 'express';
import {
  getAllSongs,
  getSongById,
  addSong,
  updateSong,
  removeSong,
  refreshAllSongStatuses,
  Song
} from '../utils/database.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, rmSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const router = Router();

/**
 * GET /api/songs
 * Lista todas as músicas
 */
router.get('/', (req, res) => {
  try {
    const songs = getAllSongs();
    res.json({
      songs,
      total: songs.length
    });
  } catch (error: any) {
    console.error('Error getting songs:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * GET /api/songs/:id
 * Busca uma música específica
 */
router.get('/:id', (req, res) => {
  try {
    const song = getSongById(req.params.id);
    
    if (!song) {
      res.status(404).json({ error: 'Song not found' });
      return;
    }

    res.json(song);
  } catch (error: any) {
    console.error('Error getting song:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * POST /api/songs
 * Adiciona uma nova música
 */
router.post('/', (req, res) => {
  try {
    const songData = req.body;
    
    // Validação básica
    if (!songData.id || !songData.name || !songData.files) {
      res.status(400).json({ error: 'Missing required fields: id, name, files' });
      return;
    }

    const newSong = addSong(songData);
    res.status(201).json(newSong);
  } catch (error: any) {
    console.error('Error adding song:', error);
    if (error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
});

/**
 * PUT /api/songs/:id
 * Atualiza uma música existente
 */
router.put('/:id', (req, res) => {
  try {
    const updates = req.body;
    const updatedSong = updateSong(req.params.id, updates);

    if (!updatedSong) {
      res.status(404).json({ error: 'Song not found' });
      return;
    }

    res.json(updatedSong);
  } catch (error: any) {
    console.error('Error updating song:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * DELETE /api/songs/:id
 * Remove uma música e seus arquivos
 */
router.delete('/:id', (req, res) => {
  try {
    const songId = req.params.id;
    const song = getSongById(songId);

    if (!song) {
      res.status(404).json({ error: 'Song not found' });
      return;
    }

    // Remover do banco de dados
    const deleted = removeSong(songId);

    if (!deleted) {
      res.status(404).json({ error: 'Song not found' });
      return;
    }

    // Remover diretório da música e todos os arquivos
    const musicDir = join(PROJECT_ROOT, 'music', songId);
    if (existsSync(musicDir)) {
      try {
        rmSync(musicDir, { recursive: true, force: true });
        console.log(`✅ Diretório removido: ${musicDir}`);
      } catch (err: any) {
        console.error(`⚠️  Erro ao remover diretório ${musicDir}:`, err.message);
        // Continuar mesmo se houver erro ao remover arquivos
      }
    }

    res.json({ message: 'Song deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting song:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * POST /api/songs/refresh
 * Atualiza o status de todas as músicas
 */
router.post('/refresh', (req, res) => {
  try {
    refreshAllSongStatuses();
    const songs = getAllSongs();
    res.json({
      message: 'Song statuses refreshed',
      songs,
      total: songs.length
    });
  } catch (error: any) {
    console.error('Error refreshing songs:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

export { router as songsRoutes };

