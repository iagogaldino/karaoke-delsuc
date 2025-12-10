import { useEffect, useRef, useState, useMemo } from 'react';
import './LyricsDisplay.css';
import { LyricsLine } from '../types/index.js';
import { lyricsService } from '../services/lyricsService.js';

interface LyricsDisplayProps {
  lyrics: LyricsLine[];
  currentTime: number;
  songId: string | null;
  onLyricsUpdate?: (updatedLyrics: LyricsLine[]) => void;
  capturedText?: string; // Texto capturado em tempo real durante a gravação
  isRecording?: boolean; // Indica se está gravando
  allowEdit?: boolean; // Permite edição de letras (padrão: true)
}

export default function LyricsDisplay({ lyrics, currentTime, songId, onLyricsUpdate, capturedText = '', isRecording = false, allowEdit = true }: LyricsDisplayProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editTime, setEditTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [localLyrics, setLocalLyrics] = useState<LyricsLine[]>(lyrics);
  const [isEditTimeDuplicate, setIsEditTimeDuplicate] = useState(false);
  const [addingLine, setAddingLine] = useState(false);
  const [newLineText, setNewLineText] = useState('');
  const [newLineTime, setNewLineTime] = useState('');
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [timeManuallyEdited, setTimeManuallyEdited] = useState(false);
  const [isTimeDuplicate, setIsTimeDuplicate] = useState(false);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const newLineTextRef = useRef<HTMLInputElement>(null);

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
    if (!allowEdit) return; // Não permitir edição se allowEdit for false
    setEditingIndex(index);
    setEditText(localLyrics[index].text);
    setEditTime(formatTime(localLyrics[index].time));
    setIsEditTimeDuplicate(false);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditText('');
    setEditTime('');
    setIsEditTimeDuplicate(false);
  };

  const handleSave = async (index: number) => {
    if (!songId || editText.trim() === '' || !editTime.trim()) {
      return;
    }

    // Parse time input
    let timeInSeconds = 0;
    const timeMatch = editTime.trim().match(/^(\d{1,2}):(\d{2})(?:\.(\d{2}))?$/);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      const seconds = parseInt(timeMatch[2], 10);
      const centiseconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      timeInSeconds = minutes * 60 + seconds + centiseconds / 100;
    } else {
      alert('Formato de tempo inválido. Use mm:ss.xx ou mm:ss');
      return;
    }

    // Verificar se o novo tempo é duplicado (excluindo a linha atual)
    const TOLERANCE = 0.01;
    const existingLine = localLyrics.find((lyric, idx) => 
      idx !== index && Math.abs(lyric.time - timeInSeconds) < TOLERANCE
    );
    if (existingLine) {
      setIsEditTimeDuplicate(true);
      alert(`Já existe uma linha com o tempo ${formatTime(timeInSeconds)}.\n\nLinha existente: "${existingLine.text}"\n\nPor favor, escolha um tempo diferente.`);
      return;
    }

    setIsSaving(true);
    try {
      await lyricsService.updateLine(songId, index, editText.trim(), timeInSeconds);

      // Reload lyrics to get the updated order
      const data = await lyricsService.getJson(songId);
      const updatedLyrics = data.lyrics || [];
      setLocalLyrics(updatedLyrics);

      // Notificar componente pai
      if (onLyricsUpdate) {
        onLyricsUpdate(updatedLyrics);
      }

      setEditingIndex(null);
      setEditText('');
      setEditTime('');
      setIsEditTimeDuplicate(false);
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

  const handleAddLine = () => {
    if (!allowEdit) return; // Não permitir adicionar se allowEdit for false
    setAddingLine(true);
    setNewLineText('');
    setTimeManuallyEdited(false);
    setIsTimeDuplicate(false);
    // Preencher automaticamente com o tempo atual do progresso
    setNewLineTime(formatTime(currentTime));
  };

  const handleCancelAdd = () => {
      setAddingLine(false);
      setNewLineText('');
      setNewLineTime('');
      setTimeManuallyEdited(false);
      setIsTimeDuplicate(false);
    setIsTimeDuplicate(false);
  };

  const handleUpdateTimeFromProgress = () => {
    setNewLineTime(formatTime(currentTime));
    // Reativar atualização automática após sincronizar
    setTimeManuallyEdited(false);
  };

  const handleSaveNewLine = async () => {
    if (!songId || !newLineText.trim() || !newLineTime.trim()) {
      alert('Por favor, preencha o texto e o tempo (formato: mm:ss.xx ou mm:ss)');
      return;
    }

    // Parse time input (accepts mm:ss.xx or mm:ss)
    let timeInSeconds = 0;
    const timeMatch = newLineTime.trim().match(/^(\d{1,2}):(\d{2})(?:\.(\d{2}))?$/);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      const seconds = parseInt(timeMatch[2], 10);
      const centiseconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      timeInSeconds = minutes * 60 + seconds + centiseconds / 100;
    } else {
      alert('Formato de tempo inválido. Use mm:ss.xx ou mm:ss');
      return;
    }

    // Verificar se já existe uma linha com o mesmo timestamp (tolerância de 0.01 segundos)
    const TOLERANCE = 0.01;
    const existingLine = localLyrics.find(lyric => Math.abs(lyric.time - timeInSeconds) < TOLERANCE);
    if (existingLine) {
      alert(`Já existe uma linha com o tempo ${formatTime(timeInSeconds)}.\n\nLinha existente: "${existingLine.text}"\n\nPor favor, escolha um tempo diferente.`);
      return;
    }

    setIsSaving(true);
    try {
      await lyricsService.addLine(songId, timeInSeconds, newLineText.trim());

      // Reload lyrics
      const data = await lyricsService.getJson(songId);
      const updatedLyrics = data.lyrics || [];
      setLocalLyrics(updatedLyrics);

      // Notify parent component
      if (onLyricsUpdate) {
        onLyricsUpdate(updatedLyrics);
      }

      setAddingLine(false);
      setNewLineText('');
      setNewLineTime('');
    } catch (error: any) {
      console.error('Error adding lyrics line:', error);
      alert('Erro ao adicionar letra: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLine = async (index: number) => {
    if (!songId) {
      return;
    }

    if (!window.confirm(`Tem certeza que deseja remover esta linha?\n\n"${localLyrics[index].text}"`)) {
      return;
    }

    setIsDeleting(index);
    try {
      await lyricsService.deleteLine(songId, index);

      // Reload lyrics
      const data = await lyricsService.getJson(songId);
      const updatedLyrics = data.lyrics || [];
      setLocalLyrics(updatedLyrics);

      // Notify parent component
      if (onLyricsUpdate) {
        onLyricsUpdate(updatedLyrics);
      }
    } catch (error: any) {
      console.error('Error deleting lyrics line:', error);
      alert('Erro ao remover letra: ' + error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  // Focus on text input when adding line
  useEffect(() => {
    if (addingLine && newLineTextRef.current) {
      newLineTextRef.current.focus();
    }
  }, [addingLine]);

  // Atualizar o campo de tempo automaticamente quando o progresso mudar
  // Mas apenas se o usuário não tiver editado manualmente
  useEffect(() => {
    if (addingLine && !timeManuallyEdited) {
      setNewLineTime(formatTime(currentTime));
    }
  }, [currentTime, addingLine, timeManuallyEdited]);

  // Verificar se o timestamp editado é duplicado de forma reativa
  useEffect(() => {
    if (editingIndex === null || !editTime.trim()) {
      setIsEditTimeDuplicate(false);
      return;
    }

    // Parse time input
    let timeInSeconds = 0;
    const timeMatch = editTime.trim().match(/^(\d{1,2}):(\d{2})(?:\.(\d{2}))?$/);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      const seconds = parseInt(timeMatch[2], 10);
      const centiseconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      timeInSeconds = minutes * 60 + seconds + centiseconds / 100;
    } else {
      setIsEditTimeDuplicate(false);
      return;
    }

    // Verificar se já existe uma linha com o mesmo timestamp (excluindo a linha atual)
    const TOLERANCE = 0.01;
    const existingLine = localLyrics.find((lyric, idx) => 
      idx !== editingIndex && Math.abs(lyric.time - timeInSeconds) < TOLERANCE
    );
    setIsEditTimeDuplicate(!!existingLine);
  }, [editTime, localLyrics, editingIndex]);

  // Verificar se o timestamp é duplicado de forma reativa
  useEffect(() => {
    if (!addingLine || !newLineTime.trim()) {
      setIsTimeDuplicate(false);
      return;
    }

    // Parse time input (accepts mm:ss.xx or mm:ss)
    let timeInSeconds = 0;
    const timeMatch = newLineTime.trim().match(/^(\d{1,2}):(\d{2})(?:\.(\d{2}))?$/);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      const seconds = parseInt(timeMatch[2], 10);
      const centiseconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      timeInSeconds = minutes * 60 + seconds + centiseconds / 100;
    } else {
      // Se o formato não é válido, não considerar como duplicado ainda
      setIsTimeDuplicate(false);
      return;
    }

    // Verificar se já existe uma linha com o mesmo timestamp (tolerância de 0.01 segundos)
    const TOLERANCE = 0.01;
    const existingLine = localLyrics.find(lyric => Math.abs(lyric.time - timeInSeconds) < TOLERANCE);
    setIsTimeDuplicate(!!existingLine);
  }, [newLineTime, localLyrics, addingLine]);

  // Função para formatar tempo em mm:ss.xx
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const centiseconds = Math.floor((seconds % 1) * 100);
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
  };

  // Função para normalizar texto (remover acentos, converter para minúsculas, etc)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, '') // Remove pontuação
      .trim();
  };

  // Função para calcular a duração de uma linha de letra
  const getLineDuration = (index: number): number => {
    if (index < 0 || index >= localLyrics.length) return 0;
    
    const currentLine = localLyrics[index];
    const nextLine = localLyrics[index + 1];
    
    if (nextLine) {
      // Duração é a diferença entre a próxima linha e a atual
      return nextLine.time - currentLine.time;
    } else {
      // Se for a última linha, estimar duração baseada no comprimento do texto
      // Assumir aproximadamente 0.3 segundos por palavra
      const wordCount = currentLine.text.split(/\s+/).filter(w => w.length > 0).length;
      return Math.max(wordCount * 0.3, 2); // Mínimo de 2 segundos
    }
  };

  // Função para destacar letras progressivamente no estilo karaoke
  const highlightKaraokeStyle = (lyricText: string, lineIndex: number): React.ReactNode => {
    if (lineIndex < 0 || lineIndex >= localLyrics.length) {
      return <span>{lyricText}</span>;
    }

    const line = localLyrics[lineIndex];
    const lineStartTime = line.time;
    const lineDuration = getLineDuration(lineIndex);
    
    // Calcular progresso dentro da linha (0 a 1)
    const progress = Math.max(0, Math.min(1, (currentTime - lineStartTime) / lineDuration));
    
    // Dividir o texto em caracteres individuais
    const characters = lyricText.split('');
    const totalChars = characters.length;
    
    // Calcular quantos caracteres devem ser destacados
    const highlightedCharCount = Math.floor(progress * totalChars);
    
    return (
      <span>
        {characters.map((char, index) => {
          const shouldHighlight = index < highlightedCharCount;
          
          return (
            <span
              key={index}
              className={shouldHighlight ? 'karaoke-highlighted' : 'karaoke-pending'}
            >
              {char}
            </span>
          );
        })}
      </span>
    );
  };

  // Função para destacar palavras acertadas no texto (otimizada para reduzir delay)
  const highlightWords = (lyricText: string, capturedText: string): React.ReactNode => {
    if (!capturedText || !isRecording) {
      return <span>{lyricText}</span>;
    }

    // Normalizar e processar apenas uma vez
    const normalizedCaptured = normalizeText(capturedText);
    if (!normalizedCaptured) return <span>{lyricText}</span>;
    
    const capturedWords = normalizedCaptured.split(/\s+/).filter(w => w.length > 0);
    if (capturedWords.length === 0) return <span>{lyricText}</span>;
    
    // Criar um conjunto de palavras capturadas para busca rápida O(1)
    const capturedWordsSet = new Set(capturedWords);
    
    // Contar quantas vezes cada palavra aparece no texto capturado
    const wordCount: { [key: string]: number } = {};
    for (const word of capturedWords) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
    
    // Dividir o texto original preservando espaços e pontuação
    const lyricWords = lyricText.split(/(\s+)/);
    const usedCount: { [key: string]: number } = {};
    
    return (
      <span>
        {lyricWords.map((word, index) => {
          // Se for espaço, retornar como está
          if (/^\s+$/.test(word)) {
            return <span key={index}>{word}</span>;
          }
          
          const normalizedWord = normalizeText(word);
          if (!normalizedWord) {
            return <span key={index}>{word}</span>;
          }
          
          const isMatched = capturedWordsSet.has(normalizedWord);
          
          if (isMatched) {
            // Verificar se ainda há ocorrências disponíveis desta palavra
            const availableCount = (wordCount[normalizedWord] || 0) - (usedCount[normalizedWord] || 0);
            if (availableCount > 0) {
              usedCount[normalizedWord] = (usedCount[normalizedWord] || 0) + 1;
              return (
                <span key={index} className="word-matched">
                  {word}
                </span>
              );
            }
          }
          
          return <span key={index}>{word}</span>;
        })}
      </span>
    );
  };

  if (lyrics.length === 0 && !addingLine) {
    return (
      <div className="lyrics-display">
        <div className="lyrics-header">
          <h3>Letras</h3>
          {allowEdit && (
            <button
              className="add-line-btn"
              onClick={handleAddLine}
              title="Adicionar nova linha"
              disabled={!songId}
            >
              <i className="fas fa-plus"></i>
              <span>Adicionar</span>
            </button>
          )}
        </div>
        <div className="lyrics-container">
          <p className="no-lyrics">Nenhuma letra disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lyrics-display">
      <div className="lyrics-header">
        <h3>Letras</h3>
        {allowEdit && !addingLine && (
          <button
            className="add-line-btn"
            onClick={handleAddLine}
            title="Adicionar nova linha"
            disabled={!songId}
          >
            <i className="fas fa-plus"></i>
            <span>Adicionar</span>
          </button>
        )}
      </div>
      <div className="lyrics-container" ref={lyricsRef}>
        {addingLine && allowEdit && (
          <div className="lyric-line adding">
            <div className="lyric-add-container">
              <div className="lyric-add-inputs">
                <input
                  ref={newLineTextRef}
                  type="text"
                  placeholder="Texto da letra"
                  value={newLineText}
                  onChange={(e) => setNewLineText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault();
                      handleSaveNewLine();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCancelAdd();
                    }
                  }}
                  className="lyric-add-text-input"
                  disabled={isSaving}
                />
                <div className="lyric-time-input-wrapper">
                  <input
                    type="text"
                    placeholder="Tempo (mm:ss.xx)"
                    value={newLineTime}
                    onChange={(e) => {
                      setNewLineTime(e.target.value);
                      setTimeManuallyEdited(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        e.preventDefault();
                        handleSaveNewLine();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelAdd();
                      }
                    }}
                    className={`lyric-add-time-input ${isTimeDuplicate ? 'duplicate-time' : ''}`}
                    disabled={isSaving}
                    title={isTimeDuplicate ? `Já existe uma linha com este tempo!` : `Tempo atual: ${formatTime(currentTime)}`}
                  />
                  <button
                    type="button"
                    className="sync-time-btn"
                    onClick={handleUpdateTimeFromProgress}
                    title={`Sincronizar com tempo atual: ${formatTime(currentTime)}`}
                    disabled={isSaving}
                  >
                    <i className="fas fa-sync-alt"></i>
                  </button>
                </div>
              </div>
              <div className="lyric-add-actions">
                <button
                  className="lyric-save-btn"
                  onClick={handleSaveNewLine}
                  disabled={isSaving || !newLineText.trim() || !newLineTime.trim() || isTimeDuplicate}
                  title={isTimeDuplicate ? "Não é possível salvar: timestamp duplicado" : "Salvar (Ctrl+Enter)"}
                >
                  {isSaving ? (
                    <i className="fas fa-hourglass-half"></i>
                  ) : (
                    <i className="fas fa-check"></i>
                  )}
                </button>
                <button
                  className="lyric-cancel-btn"
                  onClick={handleCancelAdd}
                  disabled={isSaving}
                  title="Cancelar (Esc)"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
          </div>
        )}
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
              {isEditing && allowEdit ? (
                <div className="lyric-edit-container">
                  <div className="lyric-edit-inputs">
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className="lyric-edit-text-input"
                      disabled={isSaving}
                      placeholder="Texto da letra"
                    />
                    <div className="lyric-time-input-wrapper">
                      <input
                        type="text"
                        placeholder="Tempo (mm:ss.xx)"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSave(index);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancel();
                          }
                        }}
                        className={`lyric-edit-time-input ${isEditTimeDuplicate ? 'duplicate-time' : ''}`}
                        disabled={isSaving}
                        title={isEditTimeDuplicate ? `Já existe uma linha com este tempo!` : `Tempo da linha`}
                      />
                    </div>
                  </div>
                  <div className="lyric-edit-actions">
                    <button
                      className="lyric-save-btn"
                      onClick={() => handleSave(index)}
                      disabled={isSaving || editText.trim() === '' || !editTime.trim() || isEditTimeDuplicate}
                      title={isEditTimeDuplicate ? "Não é possível salvar: timestamp duplicado" : "Salvar (Enter)"}
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
                  <div className="lyric-content">
                    {allowEdit && <span className="lyric-timestamp">{formatTime(lyric.time)}</span>}
                    <span className="lyric-text">
                      {isActive && isRecording && capturedText ? (
                        // Modo jogador: destacar palavras acertadas
                        highlightWords(lyric.text, capturedText)
                      ) : isActive ? (
                        // Modo karaoke tradicional: destacar palavras progressivamente
                        highlightKaraokeStyle(lyric.text, index)
                      ) : (
                        lyric.text
                      )}
                    </span>
                  </div>
                  {allowEdit && (
                    <div className="lyric-actions">
                      <button
                        className="lyric-edit-btn"
                        onClick={() => handleEdit(index)}
                        title="Editar linha"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        className="lyric-delete-btn"
                        onClick={() => handleDeleteLine(index)}
                        title="Remover linha"
                        disabled={isDeleting === index}
                      >
                        {isDeleting === index ? (
                          <i className="fas fa-spinner fa-spin"></i>
                        ) : (
                          <i className="fas fa-trash-alt"></i>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

