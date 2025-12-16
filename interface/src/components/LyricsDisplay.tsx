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
  showUpcomingLines?: boolean; // Mostra as próximas linhas destacadas (modo apresentação)
  onRegenerateSegment?: (songId: string) => void; // Função para abrir modal de regeneração de trecho
}

export default function LyricsDisplay({ lyrics, currentTime, songId, onLyricsUpdate, capturedText = '', isRecording = false, allowEdit = true, showUpcomingLines = false, onRegenerateSegment }: LyricsDisplayProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editWords, setEditWords] = useState<Array<{ word: string; time: number }>>([]);
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
  const activeTextRef = useRef<HTMLSpanElement>(null);

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

  // Ajustar tamanho da fonte da linha ativa para caber no container
  useEffect(() => {
    if (activeRef.current && activeTextRef.current && activeIndex >= 0 && editingIndex === null) {
      const activeElement = activeRef.current;
      const textElement = activeTextRef.current;
      
      // Resetar tamanho da fonte
      textElement.style.fontSize = '';
      
      // Aguardar próximo frame para medir
      requestAnimationFrame(() => {
        // No modo de apresentação (showUpcomingLines), permitir quebra de linha
        // No modo normal, tentar ajustar para caber em uma linha
        const isPresentationMode = showUpcomingLines;
        
        if (isPresentationMode) {
          // Modo jogador: calcular tamanho proporcional ao número de palavras
          const activeLyric = localLyrics[activeIndex];
          if (activeLyric) {
            const wordCount = activeLyric.text.split(/\s+/).filter(w => w.length > 0).length;
            
            // Obter dimensões do container de letras
            const lyricsContainer = lyricsRef.current;
            const containerWidth = lyricsContainer ? lyricsContainer.offsetWidth - 80 : activeElement.offsetWidth - 80; // Margem para padding
            const containerHeight = lyricsContainer ? lyricsContainer.offsetHeight : window.innerHeight * 0.4; // Altura estimada
            
            // Calcular espaço necessário para as próximas linhas (upcoming)
            // Considerar apenas 1 linha upcoming com ~70px de altura (incluindo margin)
            const upcomingLinesHeight = 1 * 70; // ~70px para a próxima linha
            const paddingBottom = 48; // Espaço extra no bottom
            const availableHeight = Math.max(100, containerHeight - upcomingLinesHeight - paddingBottom); // Reservar espaço para próxima linha + margem
            
            // Calcular tamanho base baseado no número de palavras
            // Mais palavras = fonte menor, menos palavras = fonte maior
            const maxWords = 25; // Número máximo de palavras esperado para referência
            const minFontSize = 1.0; // Tamanho mínimo em rem
            const maxFontSize = 3.5; // Tamanho máximo em rem (para poucas palavras)
            
            // Calcular tamanho proporcional inverso ao número de palavras
            let calculatedFontSize;
            if (wordCount <= 3) {
              calculatedFontSize = maxFontSize;
            } else if (wordCount >= maxWords) {
              calculatedFontSize = minFontSize;
            } else {
              // Interpolação linear entre min e max baseada no número de palavras
              const ratio = (wordCount - 3) / (maxWords - 3);
              calculatedFontSize = maxFontSize - (maxFontSize - minFontSize) * ratio;
            }
            
            // Aplicar tamanho inicial baseado no número de palavras
            textElement.style.fontSize = `${calculatedFontSize}rem`;
            
            // Aguardar próximo frame para medir após aplicar o tamanho
            requestAnimationFrame(() => {
              const textWidth = textElement.scrollWidth;
              const textHeight = textElement.scrollHeight;
              
              // Ajustar baseado na largura
              let adjustedFontSize = calculatedFontSize;
              if (textWidth > containerWidth && containerWidth > 0) {
                const widthRatio = containerWidth / textWidth;
                adjustedFontSize = Math.max(minFontSize, calculatedFontSize * widthRatio * 0.95);
              }
              
              // Ajustar baseado na altura disponível (reservando espaço para próximas linhas)
              if (textHeight > availableHeight && availableHeight > 0) {
                const heightRatio = availableHeight / textHeight;
                adjustedFontSize = Math.max(minFontSize, Math.min(adjustedFontSize, calculatedFontSize * heightRatio * 0.9));
              }
              
              textElement.style.fontSize = `${adjustedFontSize}rem`;
              
              // Garantir que as próximas linhas sejam visíveis fazendo scroll se necessário
              if (lyricsContainer && activeElement) {
                const activeRect = activeElement.getBoundingClientRect();
                const containerRect = lyricsContainer.getBoundingClientRect();
                const activeBottom = activeRect.bottom - containerRect.top;
                const containerHeight = containerRect.height;
                
                // Se a linha ativa está ocupando muito espaço, ajustar scroll para mostrar próximas linhas
                if (activeBottom > containerHeight * 0.6) {
                  const scrollPosition = lyricsContainer.scrollTop + (activeBottom - containerHeight * 0.5);
                  lyricsContainer.scrollTo({
                    top: Math.max(0, scrollPosition),
                    behavior: 'smooth'
                  });
                }
              }
            });
          }
        } else {
          // Modo normal: tentar ajustar para caber em uma linha
          const containerWidth = activeElement.offsetWidth - 120; // Margem para padding e timestamp
          const textWidth = textElement.scrollWidth;
          if (textWidth > containerWidth && containerWidth > 0) {
            const baseFontSize = 1.4; // 1.4rem
            const ratio = containerWidth / textWidth;
            const newFontSize = Math.max(0.8, baseFontSize * ratio * 0.95); // Mínimo 0.8rem
            textElement.style.fontSize = `${newFontSize}rem`;
          }
        }
      });
    }
  }, [activeIndex, editingIndex, localLyrics, showUpcomingLines, lyricsRef]);

  // Scroll automático para linha ativa ou preview quando não há linha ativa
  useEffect(() => {
    if (lyricsRef.current && editingIndex === null) {
      const container = lyricsRef.current;
      const isPlayerMode = showUpcomingLines && !allowEdit;
      
      // Quando não há linha ativa no modo jogador, garantir que a primeira linha (preview) seja visível
      if (isPlayerMode && activeIndex === -1 && localLyrics.length > 0) {
        // Encontrar a primeira linha no DOM
        const firstLineElement = container.querySelector('.lyric-line.upcoming') || container.querySelector('.lyric-line:first-child');
        if (firstLineElement) {
          // Aguardar próximo frame para garantir que o elemento está renderizado
          requestAnimationFrame(() => {
            const containerRect = container.getBoundingClientRect();
            const lineRect = firstLineElement.getBoundingClientRect();
            const offsetTop = lineRect.top - containerRect.top;
            
            // Posicionar a linha preview na parte inferior da área visível, garantindo que apareça completamente
            // Calcular para que a linha fique visível na parte inferior, mas sem ser cortada
            const lineHeight = lineRect.height;
            const paddingBottom = 60; // Espaço extra no bottom
            const targetPosition = containerRect.height - lineHeight - paddingBottom;
            const scrollPosition = container.scrollTop + offsetTop - targetPosition;
            
            container.scrollTo({
              top: Math.max(0, scrollPosition),
              behavior: 'smooth'
            });
          });
        }
      } else if (activeRef.current && activeIndex >= 0) {
        // Quando há linha ativa, usar a lógica normal
        const activeElement = activeRef.current;
        
        requestAnimationFrame(() => {
          const containerRect = container.getBoundingClientRect();
          const activeRect = activeElement.getBoundingClientRect();
          const offsetTop = activeRect.top - containerRect.top;
          
          if (isPlayerMode) {
            // No modo jogador, posicionar a linha ativa de forma que apareça completamente
            // e deixe espaço para a preview abaixo
            const activeHeight = activeRect.height;
            const previewSpace = 100; // Espaço reservado para preview abaixo
            const topPadding = 40; // Espaço no topo para evitar corte
            
            // Calcular posição ideal: linha ativa visível + espaço para preview
            const idealTopPosition = topPadding;
            const currentTopPosition = offsetTop + container.scrollTop;
            const scrollNeeded = currentTopPosition - idealTopPosition;
            
            container.scrollTo({
              top: Math.max(0, scrollNeeded),
              behavior: 'smooth'
            });
          } else {
            // Modo normal: centralizar
            const scrollOffset = containerRect.height / 2;
            const scrollPosition = container.scrollTop + offsetTop - scrollOffset + activeRect.height / 2;
            
            container.scrollTo({
              top: Math.max(0, scrollPosition),
              behavior: 'smooth'
            });
          }
        });
      }
    }
  }, [activeIndex, editingIndex, showUpcomingLines, allowEdit, localLyrics]);

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
    const lyric = localLyrics[index];
    setEditText(lyric.text);
    setEditTime(formatTime(lyric.time));
    
    // Se tiver palavras individuais, inicializar com elas
    if (lyric.words && lyric.words.length > 0) {
      setEditWords(lyric.words.map(w => ({ word: w.word, time: w.time })));
    } else {
      // Fallback: criar uma palavra única
      setEditWords([{ word: lyric.text, time: lyric.time }]);
    }
    
    setIsEditTimeDuplicate(false);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditText('');
    setEditTime('');
    setEditWords([]);
    setIsEditTimeDuplicate(false);
  };

  const handleSave = async (index: number) => {
    if (!songId || editText.trim() === '') {
      return;
    }

    // Se tiver palavras individuais editadas, usar elas
    const hasWords = editWords.length > 0 && editWords.some(w => w.word.trim());
    
    if (hasWords) {
      // Validar que todas as palavras têm timestamps válidos
      const invalidWords = editWords.filter(w => !w.word.trim() || w.time < 0);
      if (invalidWords.length > 0) {
        alert('Todas as palavras devem ter texto e timestamp válido');
        return;
      }
    } else {
      // Fallback: usar formato antigo com timestamp único
      if (!editTime.trim()) {
        return;
      }
    }

    setIsSaving(true);
    try {
      // Se tiver palavras individuais, enviar com palavras
      if (hasWords) {
        await lyricsService.updateLine(songId, index, editText.trim(), editWords[0].time, editWords);
      } else {
        // Parse time input para formato antigo
        let timeInSeconds = 0;
        const timeMatch = editTime.trim().match(/^(\d{1,2}):(\d{2})(?:\.(\d{2}))?$/);
        if (timeMatch) {
          const minutes = parseInt(timeMatch[1], 10);
          const seconds = parseInt(timeMatch[2], 10);
          const centiseconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
          timeInSeconds = minutes * 60 + seconds + centiseconds / 100;
        } else {
          alert('Formato de tempo inválido. Use mm:ss.xx ou mm:ss');
          setIsSaving(false);
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
          setIsSaving(false);
          return;
        }

        await lyricsService.updateLine(songId, index, editText.trim(), timeInSeconds);
      }

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
      setEditWords([]);
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

  // Função auxiliar para verificar se uma linha já terminou há tempo suficiente para desaparecer
  const isLinePast = (index: number): boolean => {
    if (index < 0 || index >= localLyrics.length) return false;
    if (activeIndex < 0) return false;
    
    // Uma linha só é considerada "past" se:
    // 1. Ela não é a linha ativa
    // 2. Ela já terminou há pelo menos X segundos
    const line = localLyrics[index];
    const lineDuration = getLineDuration(index);
    const lineEndTime = line.time + lineDuration;
    
    // Delay adicional antes de marcar como "past" (2 segundos)
    const DISAPPEAR_DELAY = 2.0;
    const shouldDisappear = currentTime > (lineEndTime + DISAPPEAR_DELAY);
    
    // Também considerar como "past" se já passou para outra linha há tempo suficiente
    if (index < activeIndex) {
      const nextLine = localLyrics[index + 1];
      if (nextLine) {
        // Se já passou do início da próxima linha + delay, considerar como past
        return currentTime > (nextLine.time + DISAPPEAR_DELAY);
      } else {
        // Última linha: usar duração estimada + delay
        return shouldDisappear;
      }
    }
    
    return false;
  };

  // Função para destacar letras progressivamente no estilo karaoke
  const highlightKaraokeStyle = (lyricText: string, lineIndex: number): React.ReactNode => {
    if (lineIndex < 0 || lineIndex >= localLyrics.length) {
      return <span>{lyricText}</span>;
    }

    const line = localLyrics[lineIndex];
    
    // Se tiver palavras individuais com timestamps, usar destaque palavra por palavra
    if (line.words && line.words.length > 0) {
      // Configurações para modo jogador (showUpcomingLines)
      const isPlayerMode = showUpcomingLines && !allowEdit;
      const PREVIEW_COUNT = 4; // Número de palavras para mostrar como prévia
      
      // Encontrar índice da palavra atual
      let currentWordIndex = -1;
      for (let i = 0; i < line.words.length; i++) {
        if (currentTime >= line.words[i].time) {
          currentWordIndex = i;
        } else {
          break;
        }
      }
      
      return (
        <span>
          {line.words.map((word, wordIndex) => {
            const wordStartTime = word.time;
            const wordEndTime = wordIndex < line.words!.length - 1 
              ? line.words![wordIndex + 1].time 
              : wordStartTime + 0.5; // Fallback: 0.5s se for última palavra
            
            const isHighlighted = currentTime >= wordStartTime;
            const isActive = currentTime >= wordStartTime && currentTime < wordEndTime;
            
            // Lógica para modo jogador: esconder palavras antigas e mostrar prévia
            if (isPlayerMode) {
              // Delay antes de esconder palavras cantadas (2 segundos)
              const WORD_DISAPPEAR_DELAY = 2.0;
              
              // Uma palavra já foi cantada se passou do tempo de término
              const wordHasEnded = currentTime > wordEndTime;
              // Uma palavra deve desaparecer apenas após o delay adicional
              const shouldDisappear = currentTime > (wordEndTime + WORD_DISAPPEAR_DELAY);
              const isOldWord = shouldDisappear && wordIndex <= currentWordIndex;
              const isPreviewWord = wordIndex > currentWordIndex && wordIndex <= currentWordIndex + PREVIEW_COUNT;
              const isFutureWord = wordIndex > currentWordIndex + PREVIEW_COUNT;
              
              // Esconder palavras já cantadas apenas após o delay completo (exceto a palavra ativa que ainda está sendo cantada)
              if (isOldWord && !isActive) {
                return null;
              }
              
              // Mostrar prévia das próximas palavras
              if (isPreviewWord) {
                return (
                  <span
                    key={wordIndex}
                    className="karaoke-preview-word"
                  >
                    {word.word}
                    {wordIndex < line.words!.length - 1 && ' '}
                  </span>
                );
              }
              
              // Esconder palavras futuras que não são prévia
              if (isFutureWord) {
                return null;
              }
              
              // Para palavras que já foram cantadas mas ainda não devem desaparecer, mostrar com opacidade reduzida
              if (wordHasEnded && !isActive && !isOldWord) {
                return (
                  <span
                    key={wordIndex}
                    className="karaoke-highlighted karaoke-fading"
                  >
                    {word.word}
                    {wordIndex < line.words!.length - 1 && ' '}
                  </span>
                );
              }
            }
            
            // Comportamento padrão para modo normal
            return (
              <span
                key={wordIndex}
                className={isHighlighted ? (isActive ? 'karaoke-active-word' : 'karaoke-highlighted') : 'karaoke-pending'}
              >
                {word.word}
                {wordIndex < line.words!.length - 1 && ' '}
              </span>
            );
          })}
        </span>
      );
    }
    
    // Fallback para formato antigo: destacar por caracteres
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
          <div className="lyrics-header-actions">
            {allowEdit && onRegenerateSegment && songId && (
              <button
                className="regenerate-segment-btn"
                onClick={() => onRegenerateSegment(songId)}
                title="Regenerar trecho selecionado"
                disabled={true}
              >
                <i className="fas fa-cut"></i>
                <span>Regenerar Trecho</span>
              </button>
            )}
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
        <div className="lyrics-header-actions">
          {allowEdit && !addingLine && (
            <>
              {onRegenerateSegment && songId && lyrics.length > 0 && (
                <button
                  className="regenerate-segment-btn"
                  onClick={() => onRegenerateSegment(songId)}
                  title="Regenerar trecho selecionado"
                >
                  <i className="fas fa-cut"></i>
                  <span>Regenerar Trecho</span>
                </button>
              )}
              <button
                className="add-line-btn"
                onClick={handleAddLine}
                title="Adicionar nova linha"
                disabled={!songId}
              >
                <i className="fas fa-plus"></i>
                <span>Adicionar</span>
              </button>
            </>
          )}
        </div>
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
          const isPast = isLinePast(index);
          const isFuture = index > activeIndex;
          const isEditing = editingIndex === index;
          
          // Calcular se é uma das próximas linhas (modo apresentação)
          const isPlayerMode = showUpcomingLines && !allowEdit;
          let upcomingOffset = index - activeIndex;
          let isUpcoming = false;
          
          // No modo jogador, quando não há linha ativa (activeIndex === -1), mostrar a primeira linha como preview
          if (isPlayerMode && activeIndex === -1 && index === 0) {
            isUpcoming = true;
            upcomingOffset = 1;
          } else if (isPlayerMode && activeIndex >= 0) {
            // Quando há linha ativa, mostrar apenas a próxima linha como preview
            isUpcoming = upcomingOffset > 0 && upcomingOffset <= 1;
          }
          
          const upcomingClass = isUpcoming ? `upcoming upcoming-${Math.min(upcomingOffset, 1)}` : '';

          // No modo jogador, esconder linhas antigas (já cantadas) e linhas futuras que não são prévia
          if (isPlayerMode) {
            // Quando não há linha ativa (antes de começar a cantar), mostrar apenas a primeira linha como preview
            if (activeIndex === -1) {
              if (index !== 0) {
                return null; // Esconder todas as linhas exceto a primeira
              }
            } else {
              // Quando há linha ativa, esconder linhas antigas (já cantadas)
              if (isPast && !isActive) {
                return null;
              }
              // Esconder linhas futuras que não são prévia
              if (isFuture && !isUpcoming) {
                return null;
              }
            }
          }

          return (
            <div
              key={index}
              ref={isActive ? activeRef : null}
              className={`lyric-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''} ${isEditing ? 'editing' : ''} ${upcomingClass}`}
            >
              {isEditing && allowEdit ? (
                <div className="lyric-edit-container">
                  {/* Se tiver palavras individuais, mostrar edição palavra por palavra */}
                  {editWords.length > 0 && localLyrics[index].words && localLyrics[index].words!.length > 0 ? (
                    <div className="word-by-word-edit">
                      <div className="word-edit-list">
                        {editWords.map((word, wordIndex) => (
                          <div key={wordIndex} className="word-edit-item">
                            <input
                              type="text"
                              value={word.word}
                              onChange={(e) => {
                                const newWords = [...editWords];
                                newWords[wordIndex].word = e.target.value;
                                setEditWords(newWords);
                                setEditText(newWords.map(w => w.word).join(' '));
                              }}
                              className="word-edit-text-input"
                              placeholder="Palavra"
                              disabled={isSaving}
                            />
                            <input
                              type="text"
                              value={formatTime(word.time)}
                              onChange={(e) => {
                                const timeMatch = e.target.value.trim().match(/^(\d{1,2}):(\d{2})(?:\.(\d{2}))?$/);
                                if (timeMatch) {
                                  const minutes = parseInt(timeMatch[1], 10);
                                  const seconds = parseInt(timeMatch[2], 10);
                                  const centiseconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
                                  const timeInSeconds = minutes * 60 + seconds + centiseconds / 100;
                                  
                                  const newWords = [...editWords];
                                  newWords[wordIndex].time = timeInSeconds;
                                  setEditWords(newWords);
                                  setEditTime(formatTime(newWords[0].time));
                                } else if (e.target.value.trim() === '') {
                                  // Permitir campo vazio temporariamente
                                }
                              }}
                              className="word-edit-time-input"
                              placeholder="mm:ss.xx"
                              disabled={isSaving}
                            />
                            {editWords.length > 1 && (
                              <button
                                type="button"
                                className="word-remove-btn"
                                onClick={() => {
                                  const newWords = editWords.filter((_, i) => i !== wordIndex);
                                  setEditWords(newWords);
                                  setEditText(newWords.map(w => w.word).join(' '));
                                }}
                                disabled={isSaving}
                                title="Remover palavra"
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="word-add-btn"
                        onClick={() => {
                          const lastWord = editWords[editWords.length - 1];
                          const newTime = lastWord ? lastWord.time + 0.5 : localLyrics[index].time;
                          setEditWords([...editWords, { word: '', time: newTime }]);
                        }}
                        disabled={isSaving}
                        title="Adicionar palavra"
                      >
                        <i className="fas fa-plus"></i> Adicionar palavra
                      </button>
                    </div>
                  ) : (
                    /* Fallback: edição simples (formato antigo) */
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
                  )}
                  <div className="lyric-edit-actions">
                    <button
                      className="lyric-save-btn"
                      onClick={() => handleSave(index)}
                      disabled={isSaving || editText.trim() === '' || (editWords.length === 0 && !editTime.trim()) || isEditTimeDuplicate}
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
                    <span 
                      className="lyric-text"
                      ref={isActive ? activeTextRef : null}
                    >
                      {isActive && isRecording && capturedText ? (
                        // Modo jogador: destacar palavras acertadas
                        highlightWords(lyric.text, capturedText)
                      ) : isActive ? (
                        // Modo karaoke tradicional: destacar palavras progressivamente
                        highlightKaraokeStyle(lyric.text, index)
                      ) : isUpcoming && isPlayerMode ? (
                        // Linha preview no modo jogador: mostrar texto completo (sem preview de palavras)
                        lyric.text
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
                  {/* Onda sonora abaixo da linha upcoming */}
                  {isUpcoming && isPlayerMode && (
                    <div className="sound-wave-container">
                      <div className="sound-wave-bar sound-wave-bar-1"></div>
                      <div className="sound-wave-bar sound-wave-bar-2"></div>
                      <div className="sound-wave-bar sound-wave-bar-3"></div>
                      <div className="sound-wave-bar sound-wave-bar-4"></div>
                      <div className="sound-wave-bar sound-wave-bar-5"></div>
                      <div className="sound-wave-bar sound-wave-bar-6"></div>
                      <div className="sound-wave-bar sound-wave-bar-7"></div>
                      <div className="sound-wave-bar sound-wave-bar-8"></div>
                      <div className="sound-wave-bar sound-wave-bar-9"></div>
                      <div className="sound-wave-bar sound-wave-bar-10"></div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        {(() => {
          const isPlayerMode = showUpcomingLines && !allowEdit;
          
          // Se não houver letras ou não estiver no modo jogador, não mostrar mensagem
          if (localLyrics.length === 0 || !isPlayerMode) {
            return null;
          }
          
          // Se já passou da última linha
          const lastLineIndex = localLyrics.length - 1;
          const isPastLastLine = activeIndex >= lastLineIndex;
          
          if (isPastLastLine && activeIndex >= 0) {
            // Verificar se a última linha já terminou completamente
            const lastLine = localLyrics[lastLineIndex];
            const lastLineDuration = getLineDuration(lastLineIndex);
            const lastLineEndTime = lastLine.time + lastLineDuration;
            const DISAPPEAR_DELAY = 2.0; // Mesmo delay usado em isLinePast
            
            // Se já passou do fim da última linha + delay, mostrar mensagem
            if (currentTime > (lastLineEndTime + DISAPPEAR_DELAY)) {
              return (
                <div className="karaoke-no-more-lyrics">
                  <div className="karaoke-no-more-lyrics-content">
                    <i className="fas fa-music"></i>
                    <h2>Parabéns!</h2>
                    <p>Você completou todas as letras desta música!</p>
                    <div className="karaoke-celebration">
                      <i className="fas fa-star"></i>
                      <i className="fas fa-star"></i>
                      <i className="fas fa-star"></i>
                    </div>
                  </div>
                </div>
              );
            }
          }
          
          return null;
        })()}
      </div>
    </div>
  );
}

