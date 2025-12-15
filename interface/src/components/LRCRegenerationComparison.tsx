import { useState, useRef, useEffect } from 'react';
import './LRCRegenerationComparison.css';
import { parseLRC } from '../utils/textUtils.js';
import { formatTime } from '../utils/formatters.js';

interface LRCRegenerationComparisonProps {
  songId: string;
  oldLyrics: string;
  newLyrics: string;
  onSave: (useNew: boolean) => Promise<void>;
  onClose: () => void;
}

interface ComparisonLine {
  time: number;
  oldText: string;
  newText: string;
  hasDifference: boolean;
}

export default function LRCRegenerationComparison({
  songId,
  oldLyrics,
  newLyrics,
  onSave,
  onClose,
}: LRCRegenerationComparisonProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [scrollSync, setScrollSync] = useState(true);
  const oldRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLDivElement>(null);

  // Parsear ambos os LRCs
  const oldLines = parseLRC(oldLyrics);
  const newLines = parseLRC(newLyrics);

  // Criar linhas de comparação alinhadas por tempo
  const comparisonLines: ComparisonLine[] = [];
  const allTimes = new Set<number>();
  
  oldLines.forEach(line => allTimes.add(line.time));
  newLines.forEach(line => allTimes.add(line.time));
  
  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
  
  sortedTimes.forEach(time => {
    const oldLine = oldLines.find(l => Math.abs(l.time - time) < 0.1);
    const newLine = newLines.find(l => Math.abs(l.time - time) < 0.1);
    
    const oldText = oldLine?.text || '';
    const newText = newLine?.text || '';
    const hasDifference = oldText !== newText;
    
    comparisonLines.push({
      time,
      oldText,
      newText,
      hasDifference,
    });
  });

  // Sincronizar scroll
  useEffect(() => {
    if (!scrollSync || !oldRef.current || !newRef.current) {
      return;
    }

    const oldDiv = oldRef.current;
    const newDiv = newRef.current;

    const handleScroll = (source: 'old' | 'new') => {
      if (!scrollSync) return;

      const sourceDiv = source === 'old' ? oldDiv : newDiv;
      const targetDiv = source === 'old' ? newDiv : oldDiv;

      const scrollRatio = sourceDiv.scrollTop / (sourceDiv.scrollHeight - sourceDiv.clientHeight);
      const targetScrollTop = scrollRatio * (targetDiv.scrollHeight - targetDiv.clientHeight);

      setScrollSync(false);
      targetDiv.scrollTop = targetScrollTop;
      setTimeout(() => setScrollSync(true), 100);
    };

    oldDiv.addEventListener('scroll', () => handleScroll('old'));
    newDiv.addEventListener('scroll', () => handleScroll('new'));

    return () => {
      oldDiv.removeEventListener('scroll', () => handleScroll('old'));
      newDiv.removeEventListener('scroll', () => handleScroll('new'));
    };
  }, [scrollSync]);

  const handleSave = async (useNew: boolean) => {
    setIsSaving(true);
    try {
      await onSave(useNew);
    } finally {
      setIsSaving(false);
    }
  };

  const differencesCount = comparisonLines.filter(l => l.hasDifference).length;

  return (
    <div className="lrc-regeneration-comparison">
      <div className="lrc-regeneration-header">
        <h3>Comparar Letras LRC</h3>
        <div className="lrc-regeneration-controls">
          <label>
            <input
              type="checkbox"
              checked={scrollSync}
              onChange={(e) => setScrollSync(e.target.checked)}
            />
            Sincronizar scroll
          </label>
          <button onClick={onClose} className="close-button" disabled={isSaving}>
            ✕ Fechar
          </button>
        </div>
      </div>

      <div className="lrc-regeneration-content">
        <div className="lrc-panel old-panel">
          <div className="lrc-panel-header">
            <h4>LRC Antigo</h4>
            <span className="line-count">{oldLines.length} linhas</span>
          </div>
          <div className="lrc-panel-content" ref={oldRef}>
            {comparisonLines.map((line, index) => (
              <div
                key={`old-${index}`}
                className={`lrc-line ${line.hasDifference ? 'has-difference' : ''} ${
                  line.oldText === '' ? 'missing' : ''
                }`}
              >
                <span className="lrc-time">{formatTime(line.time)}</span>
                <span className="lrc-text">
                  {line.oldText || <em className="empty-text">(sem texto)</em>}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lrc-panel new-panel">
          <div className="lrc-panel-header">
            <h4>LRC Novo</h4>
            <span className="line-count">{newLines.length} linhas</span>
          </div>
          <div className="lrc-panel-content" ref={newRef}>
            {comparisonLines.map((line, index) => (
              <div
                key={`new-${index}`}
                className={`lrc-line ${line.hasDifference ? 'has-difference' : ''} ${
                  line.newText === '' ? 'missing' : ''
                }`}
              >
                <span className="lrc-time">{formatTime(line.time)}</span>
                <span className="lrc-text">
                  {line.newText || <em className="empty-text">(sem texto)</em>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lrc-regeneration-stats">
        <div className="stat">
          <span className="stat-label">Linhas antigas:</span>
          <span className="stat-value">{oldLines.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Linhas novas:</span>
          <span className="stat-value">{newLines.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Diferenças:</span>
          <span className="stat-value">{differencesCount}</span>
        </div>
      </div>

      <div className="lrc-regeneration-actions">
        <button
          className="btn-keep-old"
          onClick={() => handleSave(false)}
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : 'Manter LRC Antigo'}
        </button>
        <button
          className="btn-save-new"
          onClick={() => handleSave(true)}
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : 'Salvar LRC Novo'}
        </button>
      </div>
    </div>
  );
}
