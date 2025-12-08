import { Request, Response } from 'express';
import {
  getWaveformMetadata,
  getWaveformChunk,
  getTotalChunks,
  getWaveformPreview,
  loadWaveformData
} from '../utils/chunkUtils.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { PROCESSING_CONFIG, WEBSOCKET_CONFIG } from '../config/index.js';
import { WaveformMetadata, WaveformChunk } from '../types/index.js';

/**
 * GET /api/waveform/metadata?song=id
 * Returns waveform metadata (without the full array)
 */
export const getMetadata = asyncHandler(async (req: Request, res: Response) => {
  const songId = req.query.song as string;
  const metadata = getWaveformMetadata(songId);
  const totalChunks = getTotalChunks(songId);
  const preview = getWaveformPreview(1000, songId); // 1 point every 1000

  const response: WaveformMetadata = {
    ...metadata,
    totalChunks,
    preview,
    previewLength: preview.length,
    songId: songId || 'default'
  };

  res.json(response);
});

/**
 * GET /api/waveform/chunk?start=X&end=Y&song=id
 * Returns a specific chunk of the waveform array
 */
export const getChunk = asyncHandler(async (req: Request, res: Response) => {
  const start = parseInt(req.query.start as string, 10);
  const end = req.query.end ? parseInt(req.query.end as string, 10) : undefined;
  const songId = req.query.song as string;

  const chunk = getWaveformChunk(start, end, songId);

  const response: WaveformChunk = {
    start,
    end: end || start + chunk.length - 1,
    data: chunk,
    length: chunk.length
  };

  res.json(response);
});

/**
 * GET /api/waveform/stream?song=id
 * Server-Sent Events (SSE) for complete waveform streaming
 * Sends metadata first, then sequential chunks
 */
export const stream = asyncHandler(async (req: Request, res: Response) => {
  const songId = req.query.song as string;
  
  // Configure headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send metadata first
  const metadata = getWaveformMetadata(songId);
  const totalChunks = getTotalChunks(songId);

  res.write(`data: ${JSON.stringify({
    type: 'metadata',
    ...metadata,
    totalChunks
  })}\n\n`);

  // Send chunks sequentially
  const CHUNK_SIZE = PROCESSING_CONFIG.CHUNK_SIZE;
  let currentIndex = 0;
  const waveformData = loadWaveformData(songId);
  const waveform = waveformData.waveform;

  let isClientConnected = true;

  const sendChunk = () => {
    // Check if client is still connected
    if (!isClientConnected || res.destroyed || res.closed) {
      return;
    }

    if (currentIndex >= waveform.length) {
      // End of stream
      if (isClientConnected && !res.destroyed && !res.closed) {
        try {
          res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
          res.end();
        } catch (err) {
          // Client disconnected during write
          console.log('Client disconnected during stream end');
        }
      }
      return;
    }

    const endIndex = Math.min(currentIndex + CHUNK_SIZE, waveform.length);
    const chunk = waveform.slice(currentIndex, endIndex);

    try {
      if (isClientConnected && !res.destroyed && !res.closed) {
        res.write(`data: ${JSON.stringify({
          type: 'chunk',
          start: currentIndex,
          end: endIndex - 1,
          data: chunk
        })}\n\n`);

        currentIndex = endIndex;

        // Send next chunk on next tick (to avoid blocking)
        setImmediate(sendChunk);
      }
    } catch (error: any) {
      // Client disconnected during write
      if (error.code !== 'ECONNABORTED' && error.code !== 'EPIPE') {
        console.error('Error writing chunk:', error);
      }
      isClientConnected = false;
    }
  };

  // Start sending chunks
  sendChunk();

  // Clean up when client disconnects
  req.on('close', () => {
    isClientConnected = false;
    if (!res.destroyed && !res.closed) {
      try {
        res.end();
      } catch (err) {
        // Ignore errors when closing already closed connection
      }
    }
  });

  req.on('error', (error: any) => {
    isClientConnected = false;
    if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
      console.error('Request error:', error);
    }
  });

  res.on('error', (error: any) => {
    isClientConnected = false;
    if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE' && error.code !== 'ECONNABORTED') {
      console.error('Response error:', error);
    }
  });
});

/**
 * GET /api/waveform/preview?rate=N&song=id
 * Returns a reduced sampling of the waveform
 */
export const getPreview = asyncHandler(async (req: Request, res: Response) => {
  const rate = req.query.rate ? parseInt(req.query.rate as string, 10) : 1000;
  const songId = req.query.song as string;
  
  const preview = getWaveformPreview(rate, songId);
  const metadata = getWaveformMetadata(songId);

  res.json({
    ...metadata,
    preview,
    previewLength: preview.length,
    sampleRate: rate
  });
});
