import { Router, Request, Response } from 'express';
import {
  getWaveformMetadata,
  getWaveformChunk,
  getTotalChunks,
  getWaveformPreview,
  loadWaveformData
} from '../utils/chunkUtils.js';
import { getSongById } from '../utils/database.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const router = Router();

/**
 * GET /api/waveform/metadata?song=id
 * Retorna apenas os metadados da waveform (sem o array completo)
 */
router.get('/metadata', (req, res) => {
  try {
    const songId = req.query.song as string;
    const metadata = getWaveformMetadata(songId);
    const totalChunks = getTotalChunks(songId);
    const preview = getWaveformPreview(1000, songId); // 1 ponto a cada 1000

    res.json({
      ...metadata,
      totalChunks,
      preview,
      previewLength: preview.length,
      songId: songId || 'default'
    });
  } catch (error: any) {
    console.error('Error getting waveform metadata:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * GET /api/waveform/chunk?start=X&end=Y
 * Retorna um chunk específico do array waveform
 */
router.get('/chunk', (req, res) => {
  try {
    const start = parseInt(req.query.start as string, 10);
    const end = req.query.end ? parseInt(req.query.end as string, 10) : undefined;

    if (isNaN(start) || start < 0) {
      res.status(400).json({ error: 'Invalid start parameter' });
      return;
    }

    if (end !== undefined && (isNaN(end) || end < start)) {
      res.status(400).json({ error: 'Invalid end parameter' });
      return;
    }

    const chunk = getWaveformChunk(start, end);

    res.json({
      start,
      end: end || start + chunk.length - 1,
      data: chunk,
      length: chunk.length
    });
  } catch (error: any) {
    console.error('Error getting waveform chunk:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * GET /api/waveform/stream?song=id
 * Server-Sent Events (SSE) para streaming completo da waveform
 * Envia metadados primeiro, depois chunks sequenciais
 */
router.get('/stream', (req, res) => {
  try {
    const songId = req.query.song as string;
    
    // Configurar headers para SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Enviar metadados primeiro
    const metadata = getWaveformMetadata(songId);
    const totalChunks = getTotalChunks(songId);

    res.write(`data: ${JSON.stringify({
      type: 'metadata',
      ...metadata,
      totalChunks
    })}\n\n`);

    // Enviar chunks sequencialmente
    const CHUNK_SIZE = 100000;
    let currentIndex = 0;
    const waveformData = loadWaveformData(songId);
    const waveform = waveformData.waveform;

    let isClientConnected = true;

    const sendChunk = () => {
      // Verificar se cliente ainda está conectado
      if (!isClientConnected || res.destroyed || res.closed) {
        return;
      }

      if (currentIndex >= waveform.length) {
        // Fim do stream
        if (isClientConnected && !res.destroyed && !res.closed) {
          try {
            res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
            res.end();
          } catch (err) {
            // Cliente desconectou durante o write
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

          // Enviar próximo chunk no próximo tick (para não bloquear)
          setImmediate(sendChunk);
        }
      } catch (error: any) {
        // Cliente desconectou durante o write
        if (error.code !== 'ECONNABORTED' && error.code !== 'EPIPE') {
          console.error('Error writing chunk:', error);
        }
        isClientConnected = false;
      }
    };

    // Iniciar envio de chunks
    sendChunk();

    // Limpar quando cliente desconectar
    req.on('close', () => {
      isClientConnected = false;
      if (!res.destroyed && !res.closed) {
        try {
          res.end();
        } catch (err) {
          // Ignorar erros ao fechar conexão já fechada
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
  } catch (error: any) {
    console.error('Error streaming waveform:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * GET /api/waveform/preview?rate=N
 * Retorna uma amostragem reduzida da waveform
 */
router.get('/preview', (req, res) => {
  try {
    const rate = req.query.rate ? parseInt(req.query.rate as string, 10) : 1000;
    
    if (isNaN(rate) || rate < 1) {
      res.status(400).json({ error: 'Invalid rate parameter' });
      return;
    }

    const preview = getWaveformPreview(rate);
    const metadata = getWaveformMetadata();

    res.json({
      ...metadata,
      preview,
      previewLength: preview.length,
      sampleRate: rate
    });
  } catch (error: any) {
    console.error('Error getting waveform preview:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

export { router as waveformRoutes };

