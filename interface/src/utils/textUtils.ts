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
