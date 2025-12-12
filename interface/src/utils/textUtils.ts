/**
 * Normalize text (remove accents, convert to lowercase, remove punctuation)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .trim();
}

/**
 * Count correct words between expected and actual text
 */
export function countCorrectWords(
  expected: string,
  actual: string
): { correct: number; total: number; percentage: number } {
  const expectedWords = normalizeText(expected)
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const actualWords = normalizeText(actual)
    .split(/\s+/)
    .filter((w) => w.length > 0);

  let correctCount = 0;

  // Compare words (order doesn't matter for now)
  for (const expectedWord of expectedWords) {
    if (actualWords.includes(expectedWord)) {
      correctCount++;
    }
  }

  const percentage =
    expectedWords.length > 0
      ? Math.round((correctCount / expectedWords.length) * 100)
      : 0;

  return {
    correct: correctCount,
    total: expectedWords.length,
    percentage,
  };
}

/**
 * Extract filename without extension
 */
export function getFileNameWithoutExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Calculate Levenshtein distance between two strings (similarity metric)
 * Lower distance = more similar
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate text similarity (0-1, where 1 = identical)
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const normalized1 = normalizeText(text1);
  const normalized2 = normalizeText(text2);

  if (normalized1 === normalized2) return 1.0;
  if (normalized1.length === 0 || normalized2.length === 0) return 0.0;

  const maxLength = Math.max(normalized1.length, normalized2.length);
  const distance = levenshteinDistance(normalized1, normalized2);
  return 1 - (distance / maxLength);
}

/**
 * Result of matching a recorded line to an original line (SEM TIMESTAMP)
 */
export interface LRCAlignment {
  originalIndex: number;
  recordedIndex: number | null;
  originalTime: number | null;
  recordedTime: number | null;
  originalText: string;
  recordedText: string;
  similarity: number;
  score: number;
  percentage: number;
}

/**
 * Align recorded LRC with original LRC for scoring
 * COMPARAÇÃO APENAS POR TEXTO - IGNORA TIMESTAMPS
 * Similar to how other karaoke systems work
 */
export function alignLRCLinesByTextOnly(
  originalLyrics: Array<{ time: number; text: string }>,
  recordedLyrics: Array<{ time: number; text: string }>,
  minSimilarity: number = 0.3 // minimum similarity threshold (30%)
): LRCAlignment[] {
  const alignments: LRCAlignment[] = [];
  const usedRecordedIndices = new Set<number>();

  // For each original line, find best matching recorded line by text similarity only
  for (let origIdx = 0; origIdx < originalLyrics.length; origIdx++) {
    const original = originalLyrics[origIdx];
    let bestMatch: { index: number; similarity: number } | null = null;

    // Search for best text match (IGNORANDO TIMESTAMP)
    for (let recIdx = 0; recIdx < recordedLyrics.length; recIdx++) {
      if (usedRecordedIndices.has(recIdx)) continue;

      const recorded = recordedLyrics[recIdx];
      const similarity = calculateTextSimilarity(original.text, recorded.text);

      // Check if this is a better match
      if (similarity >= minSimilarity) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { index: recIdx, similarity };
        }
      }
    }

    // Create alignment
    if (bestMatch) {
      usedRecordedIndices.add(bestMatch.index);
      const recorded = recordedLyrics[bestMatch.index];
      const wordMatch = countCorrectWords(original.text, recorded.text);

      alignments.push({
        originalIndex: origIdx,
        recordedIndex: bestMatch.index,
        originalTime: original.time,
        recordedTime: recorded.time,
        originalText: original.text,
        recordedText: recorded.text,
        similarity: bestMatch.similarity,
        score: wordMatch.correct,
        percentage: wordMatch.percentage,
      });
    } else {
      // No match found for this original line
      alignments.push({
        originalIndex: origIdx,
        recordedIndex: null,
        originalTime: original.time,
        recordedTime: null,
        originalText: original.text,
        recordedText: '',
        similarity: 0,
        score: 0,
        percentage: 0,
      });
    }
  }

  // Add unmatched recorded lines (lines sung but not in original)
  for (let recIdx = 0; recIdx < recordedLyrics.length; recIdx++) {
    if (!usedRecordedIndices.has(recIdx)) {
      const recorded = recordedLyrics[recIdx];
      alignments.push({
        originalIndex: -1,
        recordedIndex: recIdx,
        originalTime: null,
        recordedTime: recorded.time,
        originalText: '',
        recordedText: recorded.text,
        similarity: 0,
        score: 0,
        percentage: 0,
      });
    }
  }

  // Sort by original index to maintain order
  alignments.sort((a, b) => {
    // Original lines first (ordered by index)
    if (a.originalIndex >= 0 && b.originalIndex >= 0) {
      return a.originalIndex - b.originalIndex;
    }
    // Unmatched recorded lines at the end
    if (a.originalIndex < 0) return 1;
    if (b.originalIndex < 0) return -1;
    return 0;
  });

  return alignments;
}

/**
 * Calculate score from LRC alignment results (SEM TIMESTAMP)
 * Converts alignments to LyricResult format for scoring system
 */
export function calculateScoreFromLRCAlignment(
  alignments: LRCAlignment[]
): { results: Array<{ lyric: string; score: number; percentage: number; totalWords: number }>; totalScore: number } {
  const results = alignments
    .filter(a => a.originalIndex >= 0) // Only count original lines
    .map(alignment => {
      const totalWords = normalizeText(alignment.originalText)
        .split(/\s+/)
        .filter(w => w.length > 0).length;

      return {
        lyric: alignment.originalText,
        score: alignment.score,
        percentage: alignment.percentage,
        totalWords: totalWords || 1,
      };
    });

  const totalScore = results.reduce((sum, r) => sum + r.score * 100, 0);

  return { results, totalScore };
}

/**
 * Parse LRC content into LyricsLine array
 * Format: [mm:ss.xx]text
 */
export function parseLRC(lrcContent: string): Array<{ time: number; text: string }> {
  const lines: Array<{ time: number; text: string }> = [];
  const lrcLines = lrcContent.split('\n');

  for (const line of lrcLines) {
    // Formato LRC: [mm:ss.xx]texto
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centiseconds = parseInt(match[3], 10);
      const time = minutes * 60 + seconds + centiseconds / 100;
      const text = match[4].trim();

      if (text) {
        lines.push({ time, text });
      }
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}
