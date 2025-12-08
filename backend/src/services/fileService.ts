import { createReadStream, statSync, existsSync } from 'fs';
import { Request, Response } from 'express';
import { join } from 'path';
import { PROJECT_ROOT } from '../config/index.js';

/**
 * Parse Range header from HTTP request
 */
export function parseRange(range: string, fileSize: number): { start: number; end: number } | null {
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
 * Serve file with Range Request support
 */
export function serveFile(
  filePath: string,
  req: Request,
  res: Response,
  contentType: string = 'application/octet-stream'
) {
  try {
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = statSync(filePath);
    const fileSize = stats.size;
    const range = req.headers.range;

    if (range) {
      // Range Request - partial streaming
      const parsedRange = parseRange(range, fileSize);

      if (!parsedRange) {
        return res.status(416).send('Range Not Satisfiable');
      }

      const { start, end } = parsedRange;
      const chunkSize = end - start + 1;

      res.status(206); // Partial Content
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', contentType);

      const stream = createReadStream(filePath, { start, end });

      // Handle stream errors
      stream.on('error', (error: any) => {
        if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE' && error.code !== 'ECONNABORTED') {
          console.error('Stream error:', error);
        }
        if (!res.destroyed && !res.closed) {
          try {
            res.destroy();
          } catch (err) {
            // Ignore errors when destroying already closed response
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
      // Full request
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');

      const stream = createReadStream(filePath);

      // Handle stream errors
      stream.on('error', (error: any) => {
        if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE' && error.code !== 'ECONNABORTED') {
          console.error('Stream error:', error);
        }
        if (!res.destroyed && !res.closed) {
          try {
            res.destroy();
          } catch (err) {
            // Ignore errors when destroying already closed response
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
    console.error('Error serving file:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/**
 * Get song directory path
 */
export function getSongDir(songId: string): string {
  return join(PROJECT_ROOT, 'music', songId);
}

/**
 * Get file path for a song
 */
export function getSongFilePath(songId: string, filename: string): string {
  return join(getSongDir(songId), filename);
}
