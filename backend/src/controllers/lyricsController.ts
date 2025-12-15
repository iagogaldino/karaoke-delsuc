import { Request, Response } from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { getLyricsPath } from '../services/songPathService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { LyricsJson } from '../types/index.js';

/**
 * GET /api/lyrics?song=id
 * Returns the complete LRC file
 */
export const getLyrics = asyncHandler(async (req: Request, res: Response) => {
  const songId = req.query.song as string;
  const lrcPath = getLyricsPath(songId);
  
  if (!lrcPath) {
    return res.status(404).json({ error: 'Lyrics file not found' });
  }
  
  const lrcContent = readFileSync(lrcPath, 'utf-8');
  
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(lrcContent);
});

/**
 * GET /api/lyrics/json?song=id
 * Returns the LRC file parsed as JSON
 */
/**
 * Parse LRC timestamp to seconds
 */
function parseLrcTime(timeStr: string): number {
  const match = timeStr.match(/(\d{2}):(\d{2})\.(\d{2})/);
  if (match) {
    const [, minutes, seconds, centiseconds] = match;
    return parseInt(minutes, 10) * 60 + parseInt(seconds, 10) + parseInt(centiseconds, 10) / 100;
  }
  return 0;
}

/**
 * Parse word-by-word LRC format: [mm:ss.xx]<mm:ss.xx>palavra <mm:ss.xx>palavra
 * Returns array of words with individual timestamps
 */
function parseWordByWordLine(line: string): Array<{ word: string; time: number }> | null {
  // Match line start: [mm:ss.xx]<mm:ss.xx>palavra
  const lineMatch = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
  if (!lineMatch) {
    return null;
  }

  const [, minutes, seconds, centiseconds, rest] = lineMatch;
  const lineStartTime = parseInt(minutes, 10) * 60 + parseInt(seconds, 10) + parseInt(centiseconds, 10) / 100;
  
  // Parse words with timestamps: <mm:ss.xx>palavra
  const words: Array<{ word: string; time: number }> = [];
  const wordPattern = /<(\d{2}):(\d{2})\.(\d{2})>([^<]+)/g;
  let match;
  
  while ((match = wordPattern.exec(rest)) !== null) {
    const [, wMinutes, wSeconds, wCentiseconds, word] = match;
    const wordTime = parseInt(wMinutes, 10) * 60 + parseInt(wSeconds, 10) + parseInt(wCentiseconds, 10) / 100;
    words.push({
      word: word.trim(),
      time: wordTime
    });
  }
  
  // If no words found, fallback to old format (plain text after timestamp)
  if (words.length === 0) {
    return [{
      word: rest.trim(),
      time: lineStartTime
    }];
  }
  
  return words;
}

export const getLyricsJson = asyncHandler(async (req: Request, res: Response) => {
  const songId = req.query.song as string;
  const lrcPath = getLyricsPath(songId);
  
  if (!lrcPath) {
    return res.status(404).json({ error: 'Lyrics file not found' });
  }
  
  const lrcContent = readFileSync(lrcPath, 'utf-8');
  const lines = lrcContent.split('\n').filter(line => line.trim());
  
  const lyrics = lines.map(line => {
    // Try to parse word-by-word format first
    const words = parseWordByWordLine(line);
    
    if (words && words.length > 0) {
      // Return first word's time as line time, and include all words
      return {
        time: words[0].time,
        text: words.map(w => w.word).join(' '), // Keep text for backward compatibility
        words: words // Include individual words with timestamps
      };
    }
    
    // Fallback to old format: [mm:ss.xx]text
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
    if (match) {
      const [, minutes, seconds, centiseconds, text] = match;
      const timeInSeconds = 
        parseInt(minutes, 10) * 60 + 
        parseInt(seconds, 10) + 
        parseInt(centiseconds, 10) / 100;
      
      return {
        time: timeInSeconds,
        text: text.trim(),
        words: [{ word: text.trim(), time: timeInSeconds }] // Single word for compatibility
      };
    }
    
    return null;
  }).filter(item => item !== null);

  const response: LyricsJson = {
    lyrics,
    totalLines: lyrics.length
  };

  res.json(response);
});

/**
 * PUT /api/lyrics
 * Updates a specific line of the LRC file
 */
export const updateLyrics = asyncHandler(async (req: Request, res: Response) => {
  const { songId, lineIndex, newText, newTime, words } = req.body;

  if (!songId || lineIndex === undefined || !newText) {
    return res.status(400).json({ error: 'Missing required fields: songId, lineIndex, newText' });
  }

  const lrcPath = getLyricsPath(songId);
  
  if (!lrcPath) {
    return res.status(404).json({ error: 'Lyrics file not found' });
  }

  // Read current file
  const lrcContent = readFileSync(lrcPath, 'utf-8');
  const lines = lrcContent.split('\n');

  // Find the line to edit and collect all lyrics
  let lyricIndex = 0;
  let found = false;
  let currentTime = 0;
  const allLyrics: Array<{ line: string; time: number; originalLineIndex: number }> = [];

  lines.forEach((line, lineIdx) => {
    const match = line.match(/^(\[(\d{2}):(\d{2})\.(\d{2})\])(.*)$/);
    if (match) {
      const [, , minutes, seconds, centiseconds] = match;
      const timeInSeconds = 
        parseInt(minutes, 10) * 60 + 
        parseInt(seconds, 10) + 
        parseInt(centiseconds, 10) / 100;
      
      if (lyricIndex === lineIndex) {
        found = true;
        currentTime = timeInSeconds;
        
        // Se tiver palavras individuais, formatar no formato palavra por palavra
        if (words && Array.isArray(words) && words.length > 0) {
          const validWords = words.filter((w: any) => w.word && w.word.trim() && typeof w.time === 'number');
          if (validWords.length > 0) {
            // Ordenar palavras por tempo
            const sortedWords = [...validWords].sort((a: any, b: any) => a.time - b.time);
            const firstWordTime = sortedWords[0].time;
            const lineStartTimestamp = secondsToLrcTimestamp(firstWordTime);
            
            // Formatar: [mm:ss.xx]<mm:ss.xx>palavra <mm:ss.xx>palavra
            const wordParts = sortedWords.map((w: any) => {
              const wordTimestamp = secondsToLrcTimestamp(w.time).replace(/[\[\]]/g, '');
              return `<${wordTimestamp}>${w.word.trim()}`;
            });
            
            const newLine = `${lineStartTimestamp}${wordParts.join(' ')}`;
            allLyrics.push({ 
              line: newLine, 
              time: firstWordTime, 
              originalLineIndex: lineIdx 
            });
          } else {
            // Fallback: usar formato simples
            const newTimestamp = newTime !== undefined ? secondsToLrcTimestamp(newTime) : match[1];
            allLyrics.push({ 
              line: `${newTimestamp}${newText}`, 
              time: newTime !== undefined ? newTime : timeInSeconds, 
              originalLineIndex: lineIdx 
            });
          }
        } else {
          // Formato antigo: apenas texto com timestamp único
          const newTimestamp = newTime !== undefined ? secondsToLrcTimestamp(newTime) : match[1];
          allLyrics.push({ 
            line: `${newTimestamp}${newText}`, 
            time: newTime !== undefined ? newTime : timeInSeconds, 
            originalLineIndex: lineIdx 
          });
        }
      } else {
        allLyrics.push({ line, time: timeInSeconds, originalLineIndex: lineIdx });
      }
      lyricIndex++;
    }
  });

  if (!found) {
    return res.status(404).json({ error: 'Line index not found' });
  }

  // Se tiver palavras individuais, usar o tempo da primeira palavra para validação
  const effectiveNewTime = words && Array.isArray(words) && words.length > 0 
    ? words[0].time 
    : newTime;

  // If newTime is provided, validate it's not a duplicate
  if (effectiveNewTime !== undefined) {
    const TOLERANCE = 0.01;
    const duplicateLine = allLyrics.find((lyric, idx) => 
      idx !== lineIndex && Math.abs(lyric.time - effectiveNewTime) < TOLERANCE
    );
    if (duplicateLine) {
      return res.status(400).json({ 
        error: `Já existe uma linha com o tempo ${secondsToLrcTimestamp(effectiveNewTime)}. Não é possível usar o mesmo timestamp.` 
      });
    }
  }

  // If time changed, reorder all lyrics by time
  if (effectiveNewTime !== undefined && effectiveNewTime !== currentTime) {
    // Sort by time
    allLyrics.sort((a, b) => a.time - b.time);
    
    // Rebuild file: replace lyrics in order, keep non-lyric lines
    const result: string[] = [];
    let lyricPos = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const isLyric = lines[i].match(/^\[(\d{2}):(\d{2})\.(\d{2})\]/);
      if (isLyric) {
        if (lyricPos < allLyrics.length) {
          result.push(allLyrics[lyricPos].line);
          lyricPos++;
        }
      } else {
        result.push(lines[i]);
      }
    }
    
    const updatedContent = result.join('\n');
    writeFileSync(lrcPath, updatedContent, 'utf-8');
  } else {
    // Just update text, no reordering needed
    const updatedLines = lines.map((line) => {
      const match = line.match(/^(\[(\d{2}):(\d{2})\.(\d{2})\])(.*)$/);
      if (match) {
        let ci = 0;
        for (let i = 0; i < lines.indexOf(line); i++) {
          if (lines[i].match(/^\[(\d{2}):(\d{2})\.(\d{2})\]/)) ci++;
        }
        if (ci === lineIndex) {
          return `${match[1]}${newText}`;
        }
      }
      return line;
    });

    const updatedContent = updatedLines.join('\n');
    writeFileSync(lrcPath, updatedContent, 'utf-8');
  }

  const finalTime = effectiveNewTime !== undefined ? effectiveNewTime : currentTime;
  console.log(`[Lyrics] ✅ Linha ${lineIndex} atualizada para: "${newText}"${finalTime !== currentTime ? ` (tempo: ${secondsToLrcTimestamp(finalTime)})` : ''}${words && words.length > 0 ? ` (${words.length} palavras)` : ''}`);

  res.json({
    success: true,
    message: 'Lyrics updated successfully',
    lineIndex,
    newText,
    newTime: finalTime,
    words: words && Array.isArray(words) && words.length > 0 ? words : undefined
  });
});

/**
 * Helper function to convert seconds to LRC timestamp format [mm:ss.xx]
 */
function secondsToLrcTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);
  return `[${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}]`;
}

/**
 * POST /api/lyrics
 * Adds a new line to the LRC file
 */
export const addLyrics = asyncHandler(async (req: Request, res: Response) => {
  const { songId, time, text } = req.body;

  if (!songId || time === undefined || !text) {
    return res.status(400).json({ error: 'Missing required fields: songId, time, text' });
  }

  const lrcPath = getLyricsPath(songId);
  
  if (!lrcPath) {
    return res.status(404).json({ error: 'Lyrics file not found' });
  }

  // Read current file (handle empty files)
  let lrcContent = '';
  try {
    lrcContent = readFileSync(lrcPath, 'utf-8');
  } catch (error) {
    // File might not exist or be empty, start with empty content
    lrcContent = '';
  }

  const lines = lrcContent.trim() ? lrcContent.split('\n').filter(line => line.trim() || line === '') : [];

  // Parse existing lyrics to find insertion point and check for duplicates
  const lyricsWithIndex: Array<{ line: string; time: number; index: number }> = [];
  let lyricsIndex = 0;
  const TOLERANCE = 0.01; // Tolerância de 0.01 segundos para considerar timestamps duplicados

  lines.forEach((line, lineIndex) => {
    const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2})\](.*)$/);
    if (match) {
      const [, minutes, seconds, centiseconds] = match;
      const timeInSeconds = 
        parseInt(minutes, 10) * 60 + 
        parseInt(seconds, 10) + 
        parseInt(centiseconds, 10) / 100;
      lyricsWithIndex.push({ line, time: timeInSeconds, index: lineIndex });
      lyricsIndex++;
    }
  });

  // Verificar se já existe uma linha com o mesmo timestamp
  const duplicateLine = lyricsWithIndex.find(lyric => Math.abs(lyric.time - time) < TOLERANCE);
  if (duplicateLine) {
    return res.status(400).json({ 
      error: `Já existe uma linha com o tempo ${secondsToLrcTimestamp(time)}. Não é possível adicionar duas linhas no mesmo timestamp.` 
    });
  }

  // Find insertion point (after the last line with time <= new time)
  // If no lyrics exist, insert at the beginning
  let insertIndex = 0;
  if (lyricsWithIndex.length > 0) {
    insertIndex = lines.length; // Default to end
    for (let i = lyricsWithIndex.length - 1; i >= 0; i--) {
      if (lyricsWithIndex[i].time <= time) {
        // Insert after this line
        insertIndex = lyricsWithIndex[i].index + 1;
        break;
      }
    }
  }

  // Create new line
  const timestamp = secondsToLrcTimestamp(time);
  const newLine = `${timestamp}${text.trim()}`;

  // Insert the new line
  lines.splice(insertIndex, 0, newLine);

  // Save updated file
  const updatedContent = lines.join('\n');
  writeFileSync(lrcPath, updatedContent, 'utf-8');

  console.log(`[Lyrics] ✅ Nova linha adicionada em ${timestamp}: "${text.trim()}"`);

  res.json({
    success: true,
    message: 'Lyrics line added successfully',
    time,
    text: text.trim()
  });
});

/**
 * DELETE /api/lyrics
 * Removes a line from the LRC file
 */
export const deleteLyrics = asyncHandler(async (req: Request, res: Response) => {
  const { songId, lineIndex } = req.body;

  if (!songId || lineIndex === undefined) {
    return res.status(400).json({ error: 'Missing required fields: songId, lineIndex' });
  }

  const lrcPath = getLyricsPath(songId);
  
  if (!lrcPath) {
    return res.status(404).json({ error: 'Lyrics file not found' });
  }

  // Read current file
  const lrcContent = readFileSync(lrcPath, 'utf-8');
  const lines = lrcContent.split('\n');

  // Find the line corresponding to the index
  let currentIndex = 0;
  let found = false;
  let lineToDelete = '';

  const updatedLines = lines.filter((line) => {
    // Check if it's a lyrics line (format [mm:ss.xx]text)
    const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2})\](.*)$/);
    if (match) {
      if (currentIndex === lineIndex) {
        found = true;
        lineToDelete = line;
        return false; // Remove this line
      }
      currentIndex++;
    }
    return true; // Keep this line
  });

  if (!found) {
    return res.status(404).json({ error: 'Line index not found' });
  }

  // Save updated file
  const updatedContent = updatedLines.join('\n');
  writeFileSync(lrcPath, updatedContent, 'utf-8');

  console.log(`[Lyrics] ✅ Linha ${lineIndex} removida: "${lineToDelete}"`);

  res.json({
    success: true,
    message: 'Lyrics line deleted successfully',
    lineIndex
  });
});
