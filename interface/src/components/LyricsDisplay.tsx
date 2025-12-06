import { useEffect, useRef, useState } from 'react';
import './LyricsDisplay.css';

interface Lyric {
  time: number;
  text: string;
}

interface LyricsDisplayProps {
  lyrics: Lyric[];
  currentTime: number;
  songId: string | null;
  onLyricsUpdate?: (updatedLyrics: Lyric[]) => void;
}

export default function LyricsDisplay({ lyrics, currentTime, songId, onLyricsUpdate }: LyricsDisplayProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [localLyrics, setLocalLyrics] = useState<Lyric[]>(lyrics);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Atualizar letras locais quando props mudarem
  useEffect(() => {
    setLocalLyrics(lyrics);
  }, [lyrics]);

  // Encontrar linha ativa baseada no tempo atual
  useEffect(() => {
    if (lyrics.length === 0) return;

    // Encontrar a última linha que já passou
    let newActiveIndex = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        newActiveIndex = i;
        break;
      }
    }

    if (newActiveIndex !== activeIndex) {
      setActiveIndex(newActiveIndex);
    }
  }, [currentTime, lyrics, activeIndex]);

  // Scroll automático para linha ativa
  useEffect(() => {
    if (activeRef.current && lyricsRef.current && activeIndex >= 0 && editingIndex === null) {
      const container = lyricsRef.current;
      const activeElement = activeRef.current;

      const containerRect = container.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();

      const offsetTop = activeRect.top - containerRect.top;
      const scrollPosition = container.scrollTop + offsetTop - containerRect.height / 2 + activeRect.height / 2;

      // Usar requestAnimationFrame para scroll mais suave
      requestAnimationFrame(() => {
        container.scrollTo({
          top: Math.max(0, scrollPosition),
          behavior: 'smooth'
        });
      });
    }
  }, [activeIndex, editingIndex]);

  // Focar no input quando entrar em modo de edição
  useEffect(() => {
    if (editingIndex !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingIndex]);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditText(localLyrics[index].text);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditText('');
  };

  const handleSave = async (index: number) => {
    if (!songId || editText.trim() === '') {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/lyrics', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          songId,
          lineIndex: index,
          newText: editText.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar letra');
      }

      // Atualizar letras locais
      const updatedLyrics = [...localLyrics];
      updatedLyrics[index] = { ...updatedLyrics[index], text: editText.trim() };
      setLocalLyrics(updatedLyrics);

      // Notificar componente pai
      if (onLyricsUpdate) {
        onLyricsUpdate(updatedLyrics);
      }

      setEditingIndex(null);
      setEditText('');
    } catch (error: any) {
      console.error('Error saving lyrics:', error);
      alert('Erro ao salvar letra: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave(index);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (lyrics.length === 0) {
    return (
      <div className="lyrics-display">
        <h3>Letras</h3>
        <p className="no-lyrics">Nenhuma letra disponível</p>
      </div>
    );
  }

  return (
    <div className="lyrics-display">
      <h3>Letras</h3>
      <div className="lyrics-container" ref={lyricsRef}>
        {localLyrics.map((lyric, index) => {
          const isActive = index === activeIndex;
          const isPast = index < activeIndex;
          const isFuture = index > activeIndex;
          const isEditing = editingIndex === index;

          return (
            <div
              key={index}
              ref={isActive ? activeRef : null}
              className={`lyric-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''} ${isEditing ? 'editing' : ''}`}
            >
              {isEditing ? (
                <div className="lyric-edit-container">
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className="lyric-edit-input"
                    disabled={isSaving}
                  />
                  <div className="lyric-edit-actions">
                    <button
                      className="lyric-save-btn"
                      onClick={() => handleSave(index)}
                      disabled={isSaving || editText.trim() === ''}
                      title="Salvar (Enter)"
                    >
                      {isSaving ? (
                        <i className="fas fa-hourglass-half"></i>
                      ) : (
                        <i className="fas fa-check"></i>
                      )}
                    </button>
                    <button
                      className="lyric-cancel-btn"
                      onClick={handleCancel}
                      disabled={isSaving}
                      title="Cancelar (Esc)"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="lyric-text">{lyric.text}</span>
                  <button
                    className="lyric-edit-btn"
                    onClick={() => handleEdit(index)}
                    title="Editar linha"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

