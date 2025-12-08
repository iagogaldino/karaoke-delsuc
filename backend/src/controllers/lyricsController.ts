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
export const getLyricsJson = asyncHandler(async (req: Request, res: Response) => {
  const songId = req.query.song as string;
  const lrcPath = getLyricsPath(songId);
  
  if (!lrcPath) {
    return res.status(404).json({ error: 'Lyrics file not found' });
  }
  
  const lrcContent = readFileSync(lrcPath, 'utf-8');
  const lines = lrcContent.split('\n').filter(line => line.trim());
  
  const lyrics = lines.map(line => {
    // Parse LRC format: [mm:ss.xx]text
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
  const { songId, lineIndex, newText, newTime } = req.body;

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
        // Update this line
        const newTimestamp = newTime !== undefined ? secondsToLrcTimestamp(newTime) : match[1];
        allLyrics.push({ 
          line: `${newTimestamp}${newText}`, 
          time: newTime !== undefined ? newTime : timeInSeconds, 
          originalLineIndex: lineIdx 
        });
      } else {
        allLyrics.push({ line, time: timeInSeconds, originalLineIndex: lineIdx });
      }
      lyricIndex++;
    }
  });

  if (!found) {
    return res.status(404).json({ error: 'Line index not found' });
  }

  // If newTime is provided, validate it's not a duplicate
  if (newTime !== undefined) {
    const TOLERANCE = 0.01;
    const duplicateLine = allLyrics.find((lyric, idx) => 
      idx !== lineIndex && Math.abs(lyric.time - newTime) < TOLERANCE
    );
    if (duplicateLine) {
      return res.status(400).json({ 
        error: `Já existe uma linha com o tempo ${secondsToLrcTimestamp(newTime)}. Não é possível usar o mesmo timestamp.` 
      });
    }
  }

  // If time changed, reorder all lyrics by time
  if (newTime !== undefined && newTime !== currentTime) {
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

  console.log(`[Lyrics] ✅ Linha ${lineIndex} atualizada para: "${newText}"${newTime !== undefined ? ` (tempo: ${secondsToLrcTimestamp(newTime)})` : ''}`);

  res.json({
    success: true,
    message: 'Lyrics updated successfully',
    lineIndex,
    newText,
    newTime: newTime !== undefined ? newTime : currentTime
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
