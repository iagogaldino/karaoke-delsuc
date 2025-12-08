import { join } from 'path';
import { existsSync, statSync } from 'fs';
import { getSongById } from '../utils/database.js';
import { PROJECT_ROOT } from '../config/index.js';

/**
 * Get audio file paths for a song
 */
export function getAudioPaths(songId?: string) {
  if (songId) {
    const song = getSongById(songId);
    if (song) {
      const songDir = join(PROJECT_ROOT, 'music', song.id);
      return {
        vocals: join(songDir, song.files.vocals),
        instrumental: join(songDir, song.files.instrumental),
      };
    }
  }
  
  // Return null if song not found (no fallback)
  return null;
}

/**
 * Get lyrics file path for a song
 */
export function getLyricsPath(songId?: string): string | null {
  if (!songId) {
    console.warn('[Lyrics] ⚠️  Nenhum songId fornecido');
    return null;
  }

  const song = getSongById(songId);
  if (!song) {
    console.warn(`[Lyrics] ⚠️  Música não encontrada no banco: ${songId}`);
    return null;
  }

  if (!song.files.lyrics || song.files.lyrics.trim() === '') {
    console.warn(`[Lyrics] ⚠️  Arquivo de letras não especificado para: ${songId}`);
    return null;
  }

  const lyricsPath = join(PROJECT_ROOT, 'music', song.id, song.files.lyrics);
  console.log(`[Lyrics] 🔍 Procurando letras em: ${lyricsPath}`);

  // Check if file exists and is actually a file (not a directory)
  if (existsSync(lyricsPath)) {
    const stats = statSync(lyricsPath);
    if (stats.isFile()) {
      console.log(`[Lyrics] ✅ Arquivo encontrado: ${lyricsPath}`);
      return lyricsPath;
    } else {
      console.warn(`[Lyrics] ⚠️  Caminho é um diretório, não um arquivo: ${lyricsPath}`);
      return null;
    }
  }

  // Try to find file with common extensions if exact path doesn't exist
  const basePath = join(PROJECT_ROOT, 'music', song.id);
  const possibleExtensions = ['.lrc', '.LRC', '.txt', '.TXT'];
  const baseName = song.files.lyrics.replace(/\.(lrc|LRC|txt|TXT)$/, '');
  
  for (const ext of possibleExtensions) {
    const testPath = join(basePath, baseName + ext);
    if (existsSync(testPath)) {
      const stats = statSync(testPath);
      if (stats.isFile()) {
        console.log(`[Lyrics] ✅ Arquivo encontrado com extensão alternativa: ${testPath}`);
        return testPath;
      }
    }
  }

  // List files in directory for debug
  try {
    const fs = require('fs');
    const files = fs.readdirSync(basePath);
    const lrcFiles = files.filter((f: string) => f.toLowerCase().endsWith('.lrc'));
    console.warn(`[Lyrics] ⚠️  Arquivo não encontrado. Arquivos .lrc no diretório:`, lrcFiles);
  } catch (err) {
    console.warn(`[Lyrics] ⚠️  Erro ao listar arquivos do diretório:`, err);
  }

  console.warn(`[Lyrics] ❌ Arquivo de letras não encontrado para: ${songId}`);
  return null;
}

/**
 * Get waveform file path for a song
 */
export function getWaveformPath(songId?: string): string | null {
  if (songId) {
    const song = getSongById(songId);
    if (song && song.files.waveform) {
      const waveformPath = join(PROJECT_ROOT, 'music', song.id, song.files.waveform);
      // Check if file exists and is actually a file (not a directory)
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
  console.warn(`[Waveform] ⚠️  Nenhum songId fornecido ou arquivo não encontrado. Não usando fallback.`);
  return null;
}

/**
 * Get video file path for a song
 */
export function getVideoPath(songId?: string): string | null {
  if (!songId) {
    return null;
  }

  const song = getSongById(songId);
  if (!song || !song.files?.video) {
    return null;
  }

  return join(PROJECT_ROOT, 'music', song.id, song.files.video);
}
