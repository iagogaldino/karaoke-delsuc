import { readFileSync, existsSync, statSync } from 'fs';
import { getSongById } from './database.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// Helper para obter caminho da waveform
function getWaveformPath(songId?: string): string | null {
  if (songId) {
    const song = getSongById(songId);
    if (song && song.files.waveform) {
      const waveformPath = join(PROJECT_ROOT, 'music', song.id, song.files.waveform);
      // Verificar se o arquivo existe e é realmente um arquivo (não um diretório)
      if (existsSync(waveformPath)) {
        const stats = statSync(waveformPath);
        if (stats.isFile()) {
          console.log(`[Waveform] ✅ Arquivo encontrado para ${songId}: ${waveformPath}`);
          return waveformPath;
        } else {
          console.warn(`[Waveform] ⚠️  Waveform path is a directory, not a file: ${waveformPath}`);
          return null;
        }
      } else {
        console.warn(`[Waveform] ⚠️  Arquivo não encontrado para ${songId}: ${waveformPath}`);
      }
      return null;
    } else {
      console.warn(`[Waveform] ⚠️  Música não encontrada no banco ou waveform vazio: ${songId}`);
    }
  }
  // NÃO usar fallback para evitar carregar waveform errado
  // Se songId não foi fornecido ou não foi encontrado, retornar null
  console.warn(`[Waveform] ⚠️  Nenhum songId fornecido ou arquivo não encontrado. Não usando fallback.`);
  return null;
}

let currentSongId: string | undefined = undefined;

interface WaveformData {
  sample_rate: number;
  duration: number;
  num_samples: number;
  waveform: number[];
}

const CHUNK_SIZE = 100000; // ~10MB por chunk (aproximadamente)

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
  const end = endIndex !== undefined ? Math.min(endIndex, data.waveform.length) : Math.min(startIndex + CHUNK_SIZE, data.waveform.length);
  return data.waveform.slice(startIndex, end);
}

/**
 * Retorna o número total de chunks necessários
 */
export function getTotalChunks(songId?: string): number {
  const data = loadWaveformData(songId);
  return Math.ceil(data.waveform.length / CHUNK_SIZE);
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

