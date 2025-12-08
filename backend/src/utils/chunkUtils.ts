import { readFileSync } from 'fs';
import { getWaveformPath } from '../services/songPathService.js';
import { WaveformData } from '../types/index.js';
import { PROCESSING_CONFIG } from '../config/index.js';

let currentSongId: string | undefined = undefined;
let cachedWaveformData: WaveformData | null = null;

/**
 * Carrega o arquivo JSON de waveform (com cache)
 */
export function loadWaveformData(songId?: string): WaveformData {
  // Se mudou a música, limpar cache
  if (currentSongId !== songId) {
    console.log(`[Waveform] 🔄 Limpando cache: ${currentSongId} -> ${songId}`);
    cachedWaveformData = null;
    currentSongId = songId;
  }

  if (cachedWaveformData) {
    console.log(`[Waveform] ✅ Usando cache para: ${songId}`);
    return cachedWaveformData;
  }

  const waveformPath = getWaveformPath(songId);
  
  if (!waveformPath) {
    throw new Error(`Waveform file not found for song: ${songId || 'default'}`);
  }
  
  try {
    console.log(`[Waveform] 📂 Carregando waveform de: ${waveformPath}`);
    const fileContent = readFileSync(waveformPath, 'utf-8');
    cachedWaveformData = JSON.parse(fileContent) as WaveformData;
    console.log(`[Waveform] ✅ Waveform carregado: ${cachedWaveformData.num_samples} amostras, duração: ${cachedWaveformData.duration}s`);
    return cachedWaveformData;
  } catch (error) {
    console.error(`[Waveform] ❌ Erro ao carregar waveform:`, error);
    throw new Error(`Failed to load waveform data: ${error}`);
  }
}

/**
 * Retorna apenas os metadados da waveform
 */
export function getWaveformMetadata(songId?: string): Omit<WaveformData, 'waveform'> {
  const data = loadWaveformData(songId);
  return {
    sample_rate: data.sample_rate,
    duration: data.duration,
    num_samples: data.num_samples
  };
}

/**
 * Retorna um chunk específico do array waveform
 */
export function getWaveformChunk(startIndex: number, endIndex?: number, songId?: string): number[] {
  const data = loadWaveformData(songId);
  const end = endIndex !== undefined ? Math.min(endIndex, data.waveform.length) : Math.min(startIndex + PROCESSING_CONFIG.CHUNK_SIZE, data.waveform.length);
  return data.waveform.slice(startIndex, end);
}

/**
 * Retorna o número total de chunks necessários
 */
export function getTotalChunks(songId?: string): number {
  const data = loadWaveformData(songId);
  return Math.ceil(data.waveform.length / PROCESSING_CONFIG.CHUNK_SIZE);
}

/**
 * Retorna uma amostragem reduzida da waveform (para preview)
 * Pega 1 ponto a cada N pontos
 */
export function getWaveformPreview(sampleRate: number = 1000, songId?: string): number[] {
  const data = loadWaveformData(songId);
  const preview: number[] = [];
  
  for (let i = 0; i < data.waveform.length; i += sampleRate) {
    preview.push(data.waveform[i]);
  }
  
  return preview;
}

