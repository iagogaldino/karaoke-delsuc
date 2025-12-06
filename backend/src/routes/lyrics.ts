import { Router, Request, Response } from 'express';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { PATHS } from '../utils/paths.js';
import { getSongById } from '../utils/database.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const router = Router();

// Helper para obter caminho das letras
function getLyricsPath(songId?: string): string | null {
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

  // Verificar se o arquivo existe e é realmente um arquivo (não um diretório)
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

  // Tentar encontrar o arquivo com extensões comuns se o caminho exato não existir
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

  // Listar arquivos no diretório para debug
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
 * GET /api/lyrics?song=id
 * Retorna o arquivo LRC completo
 */
router.get('/', (req, res) => {
  try {
    const songId = req.query.song as string;
    const lrcPath = getLyricsPath(songId);
    
    if (!lrcPath) {
      res.status(404).json({ error: 'Lyrics file not found' });
      return;
    }
    
    const lrcContent = readFileSync(lrcPath, 'utf-8');
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(lrcContent);
  } catch (error: any) {
    console.error('Error reading lyrics file:', error);
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      res.status(404).json({ error: 'Lyrics file not found' });
    } else {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
});

/**
 * GET /api/lyrics/json?song=id
 * Retorna o arquivo LRC parseado em JSON
 */
router.get('/json', (req, res) => {
  try {
    const songId = req.query.song as string;
    const lrcPath = getLyricsPath(songId);
    
    if (!lrcPath) {
      res.status(404).json({ error: 'Lyrics file not found' });
      return;
    }
    
    const lrcContent = readFileSync(lrcPath, 'utf-8');
    const lines = lrcContent.split('\n').filter(line => line.trim());
    
    const lyrics = lines.map(line => {
      // Parse formato LRC: [mm:ss.xx]texto
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
      if (match) {
        const [, minutes, seconds, centiseconds, text] = match;
        const timeInSeconds = 
          parseInt(minutes, 10) * 60 + 
          parseInt(seconds, 10) + 
          parseInt(centiseconds, 10) / 100;
        
        return {
          time: timeInSeconds,
          text: text.trim()
        };
      }
      return null;
    }).filter(item => item !== null);

  res.json({
    lyrics,
    totalLines: lyrics.length
  });
} catch (error: any) {
  console.error('Error parsing lyrics:', error);
  if (error.code === 'ENOENT' || error.code === 'EISDIR') {
    res.status(404).json({ error: 'Lyrics file not found' });
  } else {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
});

/**
 * PUT /api/lyrics
 * Atualiza uma linha específica do arquivo LRC
 */
router.put('/', (req, res) => {
  try {
    const { songId, lineIndex, newText } = req.body;

    if (!songId || lineIndex === undefined || !newText) {
      res.status(400).json({ error: 'Missing required fields: songId, lineIndex, newText' });
      return;
    }

    const lrcPath = getLyricsPath(songId);
    
    if (!lrcPath) {
      res.status(404).json({ error: 'Lyrics file not found' });
      return;
    }

    // Ler arquivo atual
    const lrcContent = readFileSync(lrcPath, 'utf-8');
    const lines = lrcContent.split('\n');

    // Encontrar a linha correspondente ao índice
    let currentIndex = 0;
    let found = false;

    const updatedLines = lines.map((line, idx) => {
      // Verificar se é uma linha de letra (formato [mm:ss.xx]texto)
      const match = line.match(/^(\[(\d{2}):(\d{2})\.(\d{2})\])(.*)$/);
      if (match) {
        if (currentIndex === lineIndex) {
          found = true;
          // Manter o timestamp e atualizar apenas o texto
          return `${match[1]}${newText}`;
        }
        currentIndex++;
      }
      return line;
    });

    if (!found) {
      res.status(404).json({ error: 'Line index not found' });
      return;
    }

    // Salvar arquivo atualizado
    const updatedContent = updatedLines.join('\n');
    writeFileSync(lrcPath, updatedContent, 'utf-8');

    console.log(`[Lyrics] ✅ Linha ${lineIndex} atualizada para: "${newText}"`);

    res.json({
      success: true,
      message: 'Lyrics updated successfully',
      lineIndex,
      newText
    });
  } catch (error: any) {
    console.error('Error updating lyrics:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

export { router as lyricsRoutes };

