import { Router, Request, Response } from 'express';
import { createReadStream, statSync } from 'fs';
import { getSongById } from '../utils/database.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const router = Router();

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
function serveVideoFile(filePath: string, req: Request, res: Response) {
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
      res.setHeader('Content-Type', 'video/mp4'); // Assumindo mp4 para vídeos

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
      res.setHeader('Content-Type', 'video/mp4'); // Assumindo mp4 para vídeos
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
    console.error('Error serving video file:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Video file not found' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/**
 * GET /api/video?song=id
 * Stream do vídeo com suporte a Range Requests
 */
router.get('/', (req, res) => {
  const songId = req.query.song as string;
  if (!songId) {
    return res.status(400).json({ error: 'Song ID is required' });
  }

  const song = getSongById(songId);
  if (!song || !song.files?.video) {
    return res.status(404).json({ error: 'Video not found for this song' });
  }

  const videoPath = join(PROJECT_ROOT, 'music', song.id, song.files.video);
  serveVideoFile(videoPath, req, res);
});

export { router as videoRoutes };

