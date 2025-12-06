import { Router, Request, Response } from 'express';
import { createReadStream, statSync } from 'fs';
import { PATHS } from '../utils/paths.js';
import { getSongById } from '../utils/database.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const router = Router();

// Helper para obter caminhos da música atual
function getAudioPaths(songId?: string) {
  if (songId) {
    const song = getSongById(songId);
    if (song) {
      const songDir = join(PROJECT_ROOT, 'music', song.id);
      return {
        vocals: join(songDir, song.files.vocals),
        instrumental: join(songDir, song.files.instrumental)
      };
    }
  }
  
  // Fallback para caminhos padrão
  return {
    vocals: PATHS.VOCALS,
    instrumental: PATHS.INSTRUMENTAL
  };
}

/**
 * Helper para parsear Range header
 */
function parseRange(range: string, fileSize: number): { start: number; end: number } | null {
  const match = range.match(/bytes=(\d+)-(\d*)/);
  if (!match) return null;

  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    return null;
  }

  return { start, end };
}

/**
 * Helper para servir arquivo com Range Request support
 */
function serveAudioFile(filePath: string, req: Request, res: Response) {
  try {
    const stats = statSync(filePath);
    const fileSize = stats.size;
    const range = req.headers.range;

    if (range) {
      // Range Request - streaming parcial
      const parsedRange = parseRange(range, fileSize);
      
      if (!parsedRange) {
        res.status(416).send('Range Not Satisfiable');
        return;
      }

      const { start, end } = parsedRange;
      const chunkSize = end - start + 1;

      res.status(206); // Partial Content
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', 'audio/wav');

      const stream = createReadStream(filePath, { start, end });
      
      // Tratar erros de desconexão
      stream.on('error', (error: any) => {
        if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE' && error.code !== 'ECONNABORTED') {
          console.error('Stream error:', error);
        }
        if (!res.destroyed && !res.closed) {
          try {
            res.destroy();
          } catch (err) {
            // Ignorar erros ao destruir resposta já fechada
          }
        }
      });

      res.on('close', () => {
        stream.destroy();
      });

      stream.pipe(res).on('error', (error: any) => {
        if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE' && error.code !== 'ECONNABORTED') {
          console.error('Pipe error:', error);
        }
        stream.destroy();
      });
    } else {
      // Request completo
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Accept-Ranges', 'bytes');

      const stream = createReadStream(filePath);
      
      // Tratar erros de desconexão
      stream.on('error', (error: any) => {
        if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE' && error.code !== 'ECONNABORTED') {
          console.error('Stream error:', error);
        }
        if (!res.destroyed && !res.closed) {
          try {
            res.destroy();
          } catch (err) {
            // Ignorar erros ao destruir resposta já fechada
          }
        }
      });

      res.on('close', () => {
        stream.destroy();
      });

      stream.pipe(res).on('error', (error: any) => {
        if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE' && error.code !== 'ECONNABORTED') {
          console.error('Pipe error:', error);
        }
        stream.destroy();
      });
    }
  } catch (error: any) {
    console.error('Error serving audio file:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Audio file not found' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/**
 * GET /api/audio/vocals?song=id
 * Stream do áudio de vocais com suporte a Range Requests
 */
router.get('/vocals', (req, res) => {
  const songId = req.query.song as string;
  const paths = getAudioPaths(songId);
  serveAudioFile(paths.vocals, req, res);
});

/**
 * GET /api/audio/instrumental?song=id
 * Stream do áudio instrumental com suporte a Range Requests
 */
router.get('/instrumental', (req, res) => {
  const songId = req.query.song as string;
  const paths = getAudioPaths(songId);
  serveAudioFile(paths.instrumental, req, res);
});

/**
 * GET /api/audio/info?song=id
 * Retorna informações sobre os arquivos de áudio
 */
router.get('/info', (req, res) => {
  try {
    const songId = req.query.song as string;
    const paths = getAudioPaths(songId);
    
    const vocalsStats = statSync(paths.vocals);
    const instrumentalStats = statSync(paths.instrumental);

    res.json({
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
    });
  } catch (error: any) {
    console.error('Error getting audio info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as audioRoutes };

