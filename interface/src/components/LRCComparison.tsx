import { useEffect, useState, useRef } from 'react';
import './LRCComparison.css';
import { LyricsLine } from '../types/index.js';
import { recordingService } from '../services/recordingService.js';
import { formatTime } from '../utils/formatters.js';
import { alignLRCLinesByTextOnly } from '../utils/textUtils.js';

interface LRCComparisonProps {
  songId: string;
  originalLyrics: LyricsLine[];
  onClose?: () => void;
  refreshKey?: number | string; // Chave para forçar recarregamento
}

interface ComparisonLine {
  time: number;
  originalText: string;
  recordedText: string;
  hasDifference: boolean;
  timeDifference?: number; // Deprecated - mantido apenas para compatibilidade de exibição
  similarity?: number; // Similaridade entre textos (0-1)
}

export default function LRCComparison({
  songId,
  originalLyrics,
  onClose,
  refreshKey,
}: LRCComparisonProps) {
  const [recordedLyrics, setRecordedLyrics] = useState<LyricsLine[]>([]);
  const [comparisonLines, setComparisonLines] = useState<ComparisonLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollSync, setScrollSync] = useState(true);
  const originalRef = useRef<HTMLDivElement>(null);
  const recordedRef = useRef<HTMLDivElement>(null);

  // Carregar LRC gravado
  useEffect(() => {
    const loadRecordedLRC = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const lrcContent = await recordingService.getRecordingLRC(songId);
        const parsed = parseLRC(lrcContent);
        setRecordedLyrics(parsed);
      } catch (err: any) {
        console.error('Erro ao carregar LRC gravado:', err);
        setError(err.message || 'Erro ao carregar LRC da gravação');
      } finally {
        setIsLoading(false);
      }
    };

    if (songId) {
      loadRecordedLRC();
    }
  }, [songId, refreshKey]); // Recarregar quando refreshKey mudar

  // Criar linhas de comparação usando alinhamento apenas por texto (SEM TIMESTAMP)
  useEffect(() => {
    if (originalLyrics.length === 0 && recordedLyrics.length === 0) {
      setComparisonLines([]);
      return;
    }

    // Usar alinhamento apenas por texto - IGNORA TIMESTAMPS
    const alignments = alignLRCLinesByTextOnly(originalLyrics, recordedLyrics, 0.3);

    // Converter alinhamentos para formato de comparação
    const lines: ComparisonLine[] = alignments.map(alignment => {
      const time = alignment.originalTime ?? alignment.recordedTime ?? 0;
      const hasDifference = alignment.similarity < 0.9 || alignment.recordedText === '';

      return {
        time,
        originalText: alignment.originalText,
        recordedText: alignment.recordedText,
        hasDifference,
        timeDifference: undefined, // Removido - não usamos mais diferença de tempo para comparação
        similarity: alignment.similarity,
      };
    });

    setComparisonLines(lines);
  }, [originalLyrics, recordedLyrics]);

  // Sincronizar scroll entre os dois painéis
  useEffect(() => {
    if (!scrollSync || !originalRef.current || !recordedRef.current) {
      return;
    }

    const originalDiv = originalRef.current;
    const recordedDiv = recordedRef.current;

    const handleScroll = (source: 'original' | 'recorded') => {
      if (!scrollSync) return;

      const sourceDiv = source === 'original' ? originalDiv : recordedDiv;
      const targetDiv = source === 'original' ? recordedDiv : originalDiv;

      const scrollRatio = sourceDiv.scrollTop / (sourceDiv.scrollHeight - sourceDiv.clientHeight);
      const targetScrollTop = scrollRatio * (targetDiv.scrollHeight - targetDiv.clientHeight);

      // Temporariamente desabilitar sincronização para evitar loop
      setScrollSync(false);
      targetDiv.scrollTop = targetScrollTop;
      setTimeout(() => setScrollSync(true), 100);
    };

    originalDiv.addEventListener('scroll', () => handleScroll('original'));
    recordedDiv.addEventListener('scroll', () => handleScroll('recorded'));

    return () => {
      originalDiv.removeEventListener('scroll', () => handleScroll('original'));
      recordedDiv.removeEventListener('scroll', () => handleScroll('recorded'));
    };
  }, [scrollSync]);

  // Parse LRC content
  const parseLRC = (lrcContent: string): LyricsLine[] => {
    const lines: LyricsLine[] = [];
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
  };

  if (isLoading) {
    return (
      <div className="lrc-comparison">
        <div className="lrc-comparison-loading">
          <p>Carregando comparação...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lrc-comparison">
        <div className="lrc-comparison-error">
          <p>Erro: {error}</p>
          {onClose && (
            <button onClick={onClose} className="close-button">
              Fechar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="lrc-comparison">
      <div className="lrc-comparison-header">
        <h3>Comparação de Letras</h3>
        <div className="lrc-comparison-controls">
          <label>
            <input
              type="checkbox"
              checked={scrollSync}
              onChange={(e) => setScrollSync(e.target.checked)}
            />
            Sincronizar scroll
          </label>
          {onClose && (
            <button onClick={onClose} className="close-button">
              ✕ Fechar
            </button>
          )}
        </div>
      </div>

      <div className="lrc-comparison-content">
        <div className="lrc-panel original-panel">
          <div className="lrc-panel-header">
            <h4>Original</h4>
            <span className="line-count">{originalLyrics.length} linhas</span>
          </div>
          <div className="lrc-panel-content" ref={originalRef}>
            {comparisonLines.map((line, index) => (
              <div
                key={`original-${index}`}
                className={`lrc-line ${line.hasDifference ? 'has-difference' : ''} ${
                  line.originalText === '' ? 'missing' : ''
                }`}
              >
                <span className="lrc-time">{formatTime(line.time)}</span>
                <span className="lrc-text">
                  {line.originalText || <em className="empty-text">(sem texto)</em>}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lrc-panel recorded-panel">
          <div className="lrc-panel-header">
            <h4>Gravado</h4>
            <span className="line-count">{recordedLyrics.length} linhas</span>
          </div>
          <div className="lrc-panel-content" ref={recordedRef}>
            {comparisonLines.map((line, index) => (
              <div
                key={`recorded-${index}`}
                className={`lrc-line ${line.hasDifference ? 'has-difference' : ''} ${
                  line.recordedText === '' ? 'missing' : ''
                }`}
              >
                <span className="lrc-time">{formatTime(line.time)}</span>
                <span className="lrc-text">
                  {line.recordedText || <em className="empty-text">(sem texto)</em>}
                </span>
                {line.similarity !== undefined && line.similarity > 0 && line.similarity < 1 && (
                  <span className="time-diff" title="Similaridade de texto">
                    {Math.round(line.similarity * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lrc-comparison-stats">
        <div className="stat">
          <span className="stat-label">Linhas originais:</span>
          <span className="stat-value">{originalLyrics.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Linhas gravadas:</span>
          <span className="stat-value">{recordedLyrics.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Diferenças:</span>
          <span className="stat-value">
            {comparisonLines.filter((l) => l.hasDifference).length}
          </span>
        </div>
      </div>
    </div>
  );
}
