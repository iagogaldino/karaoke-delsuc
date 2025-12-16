import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AudioPlayer from './components/AudioPlayer';
import LyricsDisplay from './components/LyricsDisplay';
import AudioControls from './components/AudioControls';
import MusicProcessor from './components/MusicProcessor';
import ProcessingNotification from './components/ProcessingNotification';
import KaraokeView from './components/KaraokeView';
import HomeScreen from './components/HomeScreen.js';
import SongTree from './components/SongTree.js';
import AudioRecorder from './components/AudioRecorder';
import LRCComparison from './components/LRCComparison';
import LRCRegenerationComparison from './components/LRCRegenerationComparison';
import LRCSegmentRegenerator from './components/LRCSegmentRegenerator';
import RecordingTest from './components/RecordingTest';
import ResultsScreen from './components/ResultsScreen';
import VideoTestView from './components/VideoTestView';
import { useSyncWebSocket } from './hooks/useSyncWebSocket';
import { useAlert } from './hooks/useAlert';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { songsService } from './services/songsService.js';
import { lyricsService } from './services/lyricsService.js';
import { processingService } from './services/processingService.js';
import { bandsService } from './services/bandsService.js';
import { categoriesService } from './services/categoriesService.js';
import { recordingService } from './services/recordingService.js';
import { scoresService } from './services/scoresService.js';
import { Song, AudioMode, Band, Category, PlayerScore, ProcessingStatus } from './types/index.js';
import { useScoreCalculation } from './hooks/useScoreCalculation.js';
import './App.css';

function App() {
  const [viewMode, setViewMode] = useState<'home' | 'config' | 'presentation' | 'results' | 'videoTest'>('home');
  const [songs, setSongs] = useState<Song[]>([]);
  const [bands, setBands] = useState<Band[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [lyrics, setLyrics] = useState<any[]>([]);
  const [audioMode, setAudioMode] = useState<AudioMode>('both');
  const [vocalsVolume, setVocalsVolume] = useState(1);
  const [instrumentalVolume, setInstrumentalVolume] = useState(1);
  const [showProcessor, setShowProcessor] = useState(false);
  const [isLoadingSongs, setIsLoadingSongs] = useState(true);
  const [processingVideo, setProcessingVideo] = useState<{ [songId: string]: boolean }>({});
  const [generatingLRC, setGeneratingLRC] = useState<{ [songId: string]: boolean }>({});
  const [activeProcessings, setActiveProcessings] = useState<{ [fileId: string]: { status: ProcessingStatus; songId?: string; musicName?: string } }>({});
  const processingIntervalsRef = useRef<{ [fileId: string]: NodeJS.Timeout }>({});
  const [editingSongName, setEditingSongName] = useState<string | null>(null);
  const [editedSongName, setEditedSongName] = useState<string>('');
  const [showLRCComparison, setShowLRCComparison] = useState(false);
  const [lrcRefreshKey, setLrcRefreshKey] = useState(0);
  const [showLRCRegenerationComparison, setShowLRCRegenerationComparison] = useState(false);
  const [lrcRegenerationData, setLrcRegenerationData] = useState<{ songId: string; oldLyrics: string; newLyrics: string } | null>(null);
  const [showLRCSegmentRegenerator, setShowLRCSegmentRegenerator] = useState(false);
  const [segmentRegeneratorSongId, setSegmentRegeneratorSongId] = useState<string | null>(null);
  const [showRecordingTest, setShowRecordingTest] = useState(false);
  const [songDuration, setSongDuration] = useState<number>(0);
  const [generateLRCAfterRecording, setGenerateLRCAfterRecording] = useState(true);
  const [finalScore, setFinalScore] = useState<{ score: PlayerScore; maxPoints: number; userName?: string; userPhoto?: string } | null>(null);
  const [isCalculatingScore, setIsCalculatingScore] = useState(false);
  const [recordingIdForScore, setRecordingIdForScore] = useState<string | null>(null);
  const { currentTime, isPlaying, play, pause, seek } = useSyncWebSocket();
  const { alert, confirm, AlertComponent, ConfirmComponent } = useAlert();
  const { uploadRecording, generateLRC, error: recordingError, isUploading, isProcessing } = useAudioRecorder();
  const { calculateScoreFromRecordedLRC } = useScoreCalculation();

  // Verificar se a música selecionada tem vídeo
  const selectedSongHasVideo = useMemo(() => {
    if (!selectedSong) return false;
    const song = songs.find(s => s.id === selectedSong);
    return !!(song && song.files?.video);
  }, [selectedSong, songs]);

  // Carregar lista de músicas, categorias e bandas do banco de dados
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoadingSongs(true);
        const [songsData, categoriesData, bandsData] = await Promise.all([
          songsService.getAll(),
          categoriesService.getAll(),
          bandsService.getAll()
        ]);
        setSongs(songsData);
        setCategories(categoriesData);
        setBands(bandsData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoadingSongs(false);
      }
    };

    loadData();

    // Não mais usar eventos globais para recarregar tudo
    // As atualizações serão feitas de forma granular via callbacks
  }, []);

  // Atualização granular: atualiza apenas uma música específica
  const updateSongInList = useCallback(async (songId: string) => {
    try {
      const updatedSong = await songsService.getById(songId);
      if (updatedSong) {
        setSongs(prevSongs => {
          const index = prevSongs.findIndex(s => s.id === songId);
          if (index >= 0) {
            const newSongs = [...prevSongs];
            newSongs[index] = updatedSong;
            return newSongs;
          }
          return prevSongs;
        });
      }
    } catch (error) {
      console.error('Error updating song in list:', error);
      // Em caso de erro, recarregar todos os dados como fallback
      try {
        const [songsData] = await Promise.all([
          songsService.getAll()
        ]);
        setSongs(songsData);
      } catch (fallbackError) {
        console.error('Error in fallback reload:', fallbackError);
      }
    }
  }, []);

  // Handler para quando o processamento iniciar
  const handleProcessingStart = useCallback(async (fileId: string, songId: string, musicName: string) => {
    console.log('🔄 Processamento iniciado:', { fileId, songId, musicName });
    
    // Atualizar estado de processamento ativo
    setActiveProcessings(prev => {
      // Se já existe, manter o status atualizado
      const existing = prev[fileId];
      const newState = {
        ...prev,
        [fileId]: {
          status: existing?.status || {
            status: 'processing',
            step: 'Iniciando processamento...',
            progress: 0
          },
          songId: songId,
          musicName: musicName
        }
      };
      console.log('📊 activeProcessings atualizado:', newState);
      return newState;
    });

    // Recarregar lista de músicas para garantir que a nova música apareça na lista
    // e o indicador de processamento seja visível
    try {
      const updatedSongs = await songsService.getAll();
      console.log('📝 Lista de músicas recarregada:', updatedSongs.length, 'músicas');
      setSongs(updatedSongs);
    } catch (error) {
      console.error('❌ Erro ao recarregar lista:', error);
      // Se falhar, tentar buscar apenas a música específica após um delay
      setTimeout(async () => {
        try {
          await updateSongInList(songId);
        } catch (err) {
          console.error('❌ Erro ao atualizar música:', err);
        }
      }, 1000);
    }
  }, [updateSongInList]);

  // Polling em background para processamentos ativos
  useEffect(() => {
    const fileIds = Object.keys(activeProcessings);
    
    // Limpar intervalos de fileIds que não estão mais em activeProcessings
    Object.keys(processingIntervalsRef.current).forEach(fileId => {
      if (!activeProcessings[fileId]) {
        if (processingIntervalsRef.current[fileId]) {
          clearInterval(processingIntervalsRef.current[fileId]);
          delete processingIntervalsRef.current[fileId];
        }
      }
    });

    // Criar intervalos para novos processamentos
    fileIds.forEach(fileId => {
      const processing = activeProcessings[fileId];
      if (!processing || processing.status.status === 'completed' || processing.status.status === 'error') {
        return; // Pular processamentos já finalizados ou inválidos
      }

      // Se já existe intervalo para este fileId, não criar outro
      if (processingIntervalsRef.current[fileId]) {
        return;
      }

      processingIntervalsRef.current[fileId] = setInterval(async () => {
        try {
          const status = await processingService.getStatus(fileId);
          
          setActiveProcessings(prev => {
            const current = prev[fileId];
            if (!current) return prev; // Se foi removido, não atualizar
            
            return {
              ...prev,
              [fileId]: {
                status: status,
                songId: status.songId || current.songId,
                musicName: current.musicName
              }
            };
          });

          // Atualizar songId se ainda não tiver sido definido
          if (status.songId && !current?.songId) {
            setActiveProcessings(prevUpdate => ({
              ...prevUpdate,
              [fileId]: {
                ...prevUpdate[fileId],
                songId: status.songId,
                musicName: prevUpdate[fileId]?.musicName
              }
            }));

            // Tentar atualizar a lista quando o songId for identificado
            updateSongInList(status.songId).catch(() => {
              // Ignorar erro - tentará novamente quando completar
            });
          }

          // Se completou ou teve erro, limpar interval
          if (status.status === 'completed' || status.status === 'error') {
            if (processingIntervalsRef.current[fileId]) {
              clearInterval(processingIntervalsRef.current[fileId]);
              delete processingIntervalsRef.current[fileId];
            }

            // Atualizar lista de músicas
            if (status.songId) {
              updateSongInList(status.songId);
            }

            // Remover do rastreamento após um tempo
            setTimeout(() => {
              setActiveProcessings(prev => {
                const next = { ...prev };
                delete next[fileId];
                return next;
              });
            }, 3000);
          }
        } catch (error) {
          console.error(`Error checking status for ${fileId}:`, error);
        }
      }, 2000); // Verificar a cada 2 segundos
    });

    return () => {
      // Cleanup será feito quando activeProcessings mudar
    };
  }, [activeProcessings, updateSongInList]);

  // Recarregar lista quando uma música for processada
  const handleProcessComplete = useCallback(async (songId: string) => {
    // Limpar processamento do rastreamento se existir
    setActiveProcessings(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(fileId => {
        if (next[fileId].songId === songId) {
          delete next[fileId];
        }
      });
      return next;
    });

    try {
      // Recarregar lista de músicas, categorias e bandas
      const [updatedSongs, updatedCategories, updatedBands] = await Promise.all([
        songsService.getAll(),
        categoriesService.getAll(),
        bandsService.getAll()
      ]);
      setSongs(updatedSongs);
      setCategories(updatedCategories);
      setBands(updatedBands);
      // Selecionar a música recém-processada
      if (songId) {
        setSelectedSong(songId);
      }
    } catch (err) {
      console.error('Error reloading data:', err);
    }
  }, [updateSongInList]);

  // Função para recarregar todas as músicas, categorias e bandas
  const reloadAllData = useCallback(async () => {
    try {
      setIsLoadingSongs(true);
      const [songsData, categoriesData, bandsData] = await Promise.all([
        songsService.getAll(),
        categoriesService.getAll(),
        bandsService.getAll()
      ]);
      setSongs(songsData);
      setCategories(categoriesData);
      setBands(bandsData);
    } catch (error) {
      console.error('Error reloading all data:', error);
    } finally {
      setIsLoadingSongs(false);
    }
  }, []);

  // Atualização granular: atualiza apenas uma banda específica
  const updateBandInList = useCallback(async (bandId: string) => {
    try {
      const updatedBand = await bandsService.getById(bandId);
      if (updatedBand) {
        setBands(prev => prev.map(b => b.id === bandId ? updatedBand : b));
      }
    } catch (error) {
      console.error('Error updating band:', error);
      // Se falhar, recarrega tudo como fallback
      reloadAllData();
    }
  }, [reloadAllData]);

  // Atualização granular: atualiza músicas que mudaram de categoria/banda
  const updateSongsAfterMove = useCallback(async (songIds: string[]) => {
    try {
      // Buscar apenas as músicas que mudaram
      const updatedSongs = await Promise.all(
        songIds.map(id => songsService.getById(id))
      );
      const validSongs = updatedSongs.filter((s): s is Song => s !== null);
      
      setSongs(prev => {
        const updated = [...prev];
        validSongs.forEach(newSong => {
          const index = updated.findIndex(s => s.id === newSong.id);
          if (index >= 0) {
            updated[index] = newSong;
          }
        });
        return updated;
      });
      
      // Se alguma banda foi afetada, atualizar também
      const affectedBands = new Set(validSongs.map(s => s.band).filter(Boolean));
      if (affectedBands.size > 0) {
        const updatedBands = await Promise.all(
          Array.from(affectedBands).map(id => bandsService.getById(id!))
        );
        const validBands = updatedBands.filter((b): b is Band => b !== null);
        setBands(prev => {
          const updated = [...prev];
          validBands.forEach(newBand => {
            const index = updated.findIndex(b => b.id === newBand.id);
            if (index >= 0) {
              updated[index] = newBand;
            }
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Error updating songs after move:', error);
      // Se falhar, recarrega tudo como fallback
      reloadAllData();
    }
  }, [reloadAllData]);

  // Função para editar nome da música
  const handleEditSongName = useCallback((song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSongName(song.id);
    setEditedSongName(song.displayName || song.name);
  }, []);

  const handleSaveSongName = useCallback(async (songId: string) => {
    if (!editedSongName || editedSongName.trim() === '') {
      await alert('Nome não pode estar vazio', { type: 'warning', title: 'Atenção' });
      return;
    }

    try {
      await songsService.update(songId, {
        displayName: editedSongName.trim()
      });

      // Atualização granular em vez de reload completo
      await updateSongInList(songId);

      setEditingSongName(null);
      setEditedSongName('');
    } catch (error: any) {
      console.error('Error updating song name:', error);
      await alert('Erro ao atualizar nome: ' + error.message, { type: 'error', title: 'Erro' });
    }
  }, [editedSongName, updateSongInList, alert]);

  const handleCancelEditSongName = useCallback(() => {
    setEditingSongName(null);
    setEditedSongName('');
  }, []);

  // Função para salvar audioMode quando alterado
  const handleAudioModeChange = useCallback(async (mode: AudioMode) => {
    setAudioMode(mode);
    
    // Salvar no banco de dados se houver música selecionada
    if (selectedSong) {
      try {
        await songsService.update(selectedSong, {
          audioMode: mode
        });
        
        // Atualização granular em vez de reload completo
        await updateSongInList(selectedSong);
      } catch (error: any) {
        console.error('Error saving audio mode:', error);
        // Não mostrar alerta para não interromper a experiência do usuário
      }
    }
  }, [selectedSong, updateSongInList]);

  // Função para processar vídeo de uma música
  const handleDownloadVideo = useCallback(async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevenir que o clique selecione a música
    
    if (processingVideo[songId]) {
      return; // Já está processando
    }

    try {
      setProcessingVideo(prev => ({ ...prev, [songId]: true }));
      
      await processingService.downloadVideo(songId);
      await alert('Processamento de vídeo iniciado! Acompanhe o progresso no console do backend.', { 
        type: 'success', 
        title: 'Sucesso' 
      });
      
      // Atualização granular após um tempo
      setTimeout(async () => {
        try {
          await updateSongInList(songId);
        } catch (err) {
          console.error('Error reloading songs:', err);
        }
      }, 5000);
    } catch (error: any) {
      console.error('Error processing video:', error);
      await alert('Erro ao processar vídeo: ' + error.message, { type: 'error', title: 'Erro' });
    } finally {
      setProcessingVideo(prev => {
        const newState = { ...prev };
        delete newState[songId];
        return newState;
      });
    }
  }, [alert, updateSongInList]);

  // Função para remover uma música
  const handleGenerateLRC = useCallback(async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (generatingLRC[songId]) {
      return;
    }

    const confirmed = await confirm('Deseja gerar/regenerar as letras LRC para esta música?', {
      title: 'Confirmar ação',
      type: 'info',
      confirmText: 'Sim',
      cancelText: 'Não'
    });
    
    if (!confirmed) {
      return;
    }

    try {
      setGeneratingLRC(prev => ({ ...prev, [songId]: true }));
      
      const response = await processingService.generateLRC(songId);
      const processId = response.processId;

      // Polling do status
      const finalStatus = await processingService.pollStatus(processId, (status) => {
        console.log(`Geração de LRC: ${status.step} (${status.progress}%)`);
      });

      // Verificar se precisa mostrar comparação
      if (finalStatus.needsComparison && finalStatus.oldLyrics && finalStatus.newLyrics) {
        // Mostrar modal de comparação
        setLrcRegenerationData({
          songId,
          oldLyrics: finalStatus.oldLyrics,
          newLyrics: finalStatus.newLyrics,
        });
        setShowLRCRegenerationComparison(true);
      } else {
        // Não havia LRC antigo, apenas atualizar
        await updateSongInList(songId);
        await alert('Letras LRC geradas com sucesso!', { type: 'success', title: 'Sucesso' });
      }
    } catch (error: any) {
      console.error('Erro ao gerar LRC:', error);
      await alert('Erro ao gerar LRC: ' + (error.message || 'Erro desconhecido'), { type: 'error', title: 'Erro' });
    } finally {
      setGeneratingLRC(prev => {
        const newState = { ...prev };
        delete newState[songId];
        return newState;
      });
    }
  }, [confirm, alert, updateSongInList]);

  // Função para abrir modal de regeneração de trecho
  const handleOpenSegmentRegenerator = useCallback(async (songId: string) => {
    setSegmentRegeneratorSongId(songId);
    setShowLRCSegmentRegenerator(true);
    
    // Carregar letras da música se ainda não estiverem carregadas ou se for uma música diferente
    if (selectedSong !== songId) {
      const song = songs.find(s => s.id === songId);
      if (song?.files?.lyrics) {
        try {
          const lyricsJson = await lyricsService.getJson(songId);
          setLyrics(lyricsJson.lyrics);
        } catch (error: any) {
          // Se o arquivo não existir, não é um erro crítico - apenas logar
          if (error.message?.includes('not found') || error.message?.includes('Lyrics file not found')) {
            console.log(`Arquivo de letras não encontrado para ${songId}`);
            setLyrics([]); // Definir array vazio para evitar erros
          } else {
            console.error('Erro ao carregar letras:', error);
          }
        }
      } else {
        // Se não houver arquivo de letras, definir array vazio
        setLyrics([]);
      }
    }
  }, [selectedSong, songs]);

  // Função para regenerar trecho de LRC
  const handleRegenerateSegment = useCallback(async (
    songId: string,
    selectedIndices: number[],
    startTime: number,
    endTime: number
  ) => {
    try {
      const response = await processingService.regenerateLRCSegment(songId, selectedIndices, startTime, endTime);
      const processId = response.processId;

      // Polling do status
      await processingService.pollStatus(processId, (status) => {
        console.log(`Regeneração de trecho: ${status.step} (${status.progress}%)`);
      });

      // Atualizar letras na interface
      await updateSongInList(songId);
      
      // Recarregar letras se a música estiver selecionada
      if (selectedSong === songId && lyrics.length > 0) {
        const updatedSong = songs.find(s => s.id === songId);
        if (updatedSong?.files?.lyrics) {
          const updatedLyricsJson = await lyricsService.getJson(songId);
          setLyrics(updatedLyricsJson.lyrics);
        }
      }

      setShowLRCSegmentRegenerator(false);
      setSegmentRegeneratorSongId(null);
      await alert('Trecho de LRC regenerado com sucesso!', { type: 'success', title: 'Sucesso' });
    } catch (error: any) {
      console.error('Erro ao regenerar trecho:', error);
      await alert('Erro ao regenerar trecho: ' + (error.message || 'Erro desconhecido'), { type: 'error', title: 'Erro' });
    }
  }, [alert, updateSongInList, selectedSong, lyrics, songs]);

  // Função para remover linhas de LRC
  const handleRemoveSegment = useCallback(async (
    songId: string,
    selectedIndices: number[]
  ) => {
    try {
      await processingService.removeLRCLines(songId, selectedIndices);

      // Atualizar letras na interface
      await updateSongInList(songId);
      
      // Recarregar letras sempre (tanto se a música estiver selecionada quanto se o modal estiver aberto)
      const updatedSong = songs.find(s => s.id === songId);
      if (updatedSong?.files?.lyrics) {
        const updatedLyricsJson = await lyricsService.getJson(songId);
        const newLyrics = updatedLyricsJson.lyrics;
        
        // Se o modal de regeneração estiver aberto para esta música, atualizar as letras
        // para que o componente seja atualizado automaticamente
        if (segmentRegeneratorSongId === songId) {
          setLyrics(newLyrics);
        }
        
        // Atualizar letras se a música estiver selecionada (mesmo que não seja a do modal)
        if (selectedSong === songId) {
          setLyrics(newLyrics);
        }
      }

      await alert(`${selectedIndices.length} linha(s) removida(s) com sucesso!`, { type: 'success', title: 'Sucesso' });
    } catch (error: any) {
      console.error('Erro ao remover linhas:', error);
      await alert('Erro ao remover linhas: ' + (error.message || 'Erro desconhecido'), { type: 'error', title: 'Erro' });
    }
  }, [alert, updateSongInList, selectedSong, songs, segmentRegeneratorSongId]);

  // Função para editar linhas de LRC
  const handleEditSegment = useCallback(async (
    songId: string,
    edits: Array<{ lineIndex: number; newText: string }>
  ) => {
    try {
      await processingService.editLRCLines(songId, edits);

      // Atualizar letras na interface
      await updateSongInList(songId);
      
      // Recarregar letras sempre (tanto se a música estiver selecionada quanto se o modal estiver aberto)
      const updatedSong = songs.find(s => s.id === songId);
      if (updatedSong?.files?.lyrics) {
        const updatedLyricsJson = await lyricsService.getJson(songId);
        const newLyrics = updatedLyricsJson.lyrics;
        
        // Se o modal de regeneração estiver aberto para esta música, atualizar as letras
        // para que o componente seja atualizado automaticamente
        if (segmentRegeneratorSongId === songId) {
          setLyrics(newLyrics);
        }
        
        // Atualizar letras se a música estiver selecionada (mesmo que não seja a do modal)
        if (selectedSong === songId) {
          setLyrics(newLyrics);
        }
      }

      await alert(`${edits.length} linha(s) editada(s) com sucesso!`, { type: 'success', title: 'Sucesso' });
    } catch (error: any) {
      console.error('Erro ao editar linhas:', error);
      await alert('Erro ao editar linhas: ' + (error.message || 'Erro desconhecido'), { type: 'error', title: 'Erro' });
    }
  }, [alert, updateSongInList, selectedSong, songs, segmentRegeneratorSongId]);

  const handleDeleteSong = useCallback(async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevenir que o clique selecione a música
    
    const confirmed = await confirm(
      'Tem certeza que deseja remover esta música?\n\nEsta ação não pode ser desfeita.',
      {
        title: 'Confirmar exclusão',
        type: 'danger',
        confirmText: 'Remover',
        cancelText: 'Cancelar',
        isDestructive: true
      }
    );
    
    if (!confirmed) {
      return;
    }

    try {
      await songsService.delete(songId);

      // Se a música removida estava selecionada, limpar seleção
      if (selectedSong === songId) {
        setSelectedSong(null);
        setIsReady(false);
        setLyrics([]);
      }

      // Remover da lista local em vez de reload completo
      setSongs(prev => prev.filter(s => s.id !== songId));

      await alert('Música removida com sucesso!', { type: 'success', title: 'Sucesso' });
    } catch (error: any) {
      console.error('Error deleting song:', error);
      await alert('Erro ao remover música: ' + error.message, { type: 'error', title: 'Erro' });
    }
  }, [confirm, alert, selectedSong]);

  // Carregar dados quando uma música for selecionada
  useEffect(() => {
    if (!selectedSong) {
      setIsReady(false);
      setLyrics([]);
      setAudioMode('both'); // Reset para padrão quando não há música selecionada
      setGenerateLRCAfterRecording(true); // Reset para padrão
      return;
    }

    setIsReady(false);

    // Carregar informações da música incluindo audioMode e generateLRCAfterRecording
    songsService.getById(selectedSong)
      .then(song => {
        // Carregar audioMode salvo ou usar padrão
        if (song.audioMode) {
          setAudioMode(song.audioMode);
        } else {
          setAudioMode('both');
        }
        // Carregar generateLRCAfterRecording salvo ou usar padrão (true)
        if (song.generateLRCAfterRecording !== undefined) {
          setGenerateLRCAfterRecording(song.generateLRCAfterRecording);
        } else {
          setGenerateLRCAfterRecording(true);
        }
      })
      .catch(err => console.error('Error loading song:', err));

    // Carregar letras
    lyricsService.getJson(selectedSong)
      .then(data => {
        setLyrics(data.lyrics || []);
      })
      .catch(err => {
        // Se o arquivo não existir, não é um erro crítico - apenas definir array vazio
        if (err.message?.includes('not found') || err.message?.includes('Lyrics file not found')) {
          console.log(`Arquivo de letras não encontrado para ${selectedSong}`);
          setLyrics([]);
        } else {
          console.error('Error loading lyrics:', err);
          setLyrics([]); // Definir array vazio em caso de erro
        }
      });
  }, [selectedSong]);

  useEffect(() => {
    // Quando letras estiverem carregadas, marcar como pronto
    if (selectedSong && lyrics.length > 0) {
      setIsReady(true);
    }
  }, [lyrics, selectedSong]);

  // Resetar tempo quando trocar de música
  useEffect(() => {
    if (selectedSong) {
      // Resetar tempo para 0 e pausar quando trocar de música
      seek(0);
      setSongDuration(0);
      if (isPlaying) {
        pause();
      }
    }
  }, [selectedSong]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detectar quando a música termina no modo config
  useEffect(() => {
    if (songDuration > 0 && currentTime >= songDuration - 0.1 && isPlaying) {
      console.log('🎵 Música terminou no modo config, pausando e resetando para o início...');
      // Resetar tempo para 0 quando a música terminar
      seek(0);
      pause();
    }
  }, [currentTime, songDuration, isPlaying, pause, seek]);


  // Helper para tratamento de erro e navegação no modo presentation
  const handlePresentationError = useCallback(async (errorMessage: string, errorTitle: string = 'Erro') => {
    setIsCalculatingScore(false);
    setViewMode('home');
    setFinalScore(null);
    await alert(errorMessage, {
      type: errorTitle === 'Erro' ? 'error' : 'warning',
      title: errorTitle
    });
  }, [alert]);

  // Handler para quando gravação for completada
  const handleRecordingComplete = useCallback(async (audioBlob: Blob, startTime: number) => {
    if (!selectedSong) {
      console.warn('⚠️ Nenhuma música selecionada, ignorando gravação');
      return;
    }

    const isPresentationMode = viewMode === 'presentation';
    
    // Se estiver no modo presentation, redirecionar IMEDIATAMENTE para resultados com loading
    if (isPresentationMode) {
      console.log('🎯 Redirecionando imediatamente para tela de resultados com loading...');
      setIsCalculatingScore(true);
      setFinalScore({
        score: { total: 0, average: 0, count: 0, points: 0 },
        maxPoints: 0
      });
      setViewMode('results');
    }

    // Processar tudo em background (upload, LRC, cálculo de pontuação)
    try {
      console.log('📤 Iniciando upload da gravação...');
      const recordingId = await uploadRecording(audioBlob, selectedSong, startTime);
      
      if (!recordingId) {
        console.error('❌ Upload falhou: recordingId é null');
        if (isPresentationMode) {
          await handlePresentationError('Erro ao fazer upload da gravação');
        } else {
          await alert('Erro ao fazer upload da gravação', { type: 'error', title: 'Erro' });
        }
        return;
      }

      console.log('✅ Upload concluído, recordingId:', recordingId);
      
      // No modo config, gerar LRC apenas se a opção estiver habilitada
      // No modo presentation, sempre gerar LRC para calcular pontuação
      const shouldGenerateLRC = isPresentationMode || generateLRCAfterRecording;
      
      if (!shouldGenerateLRC) {
        console.log('ℹ️ LRC não será gerado (opção desmarcada no modo config)');
        // Modo config sem gerar LRC - apenas mostrar mensagem
        await alert('Gravação enviada com sucesso! LRC não foi gerado (opção desmarcada).', {
          type: 'success',
          title: 'Sucesso'
        });
        return;
      }

      console.log('🔄 Iniciando geração de LRC...');
      const lrcPath = await generateLRC(selectedSong, recordingId);
      
      if (!lrcPath) {
        console.error('❌ Geração de LRC falhou: lrcPath é null');
        if (isPresentationMode) {
          await handlePresentationError('Erro ao gerar o LRC. Verifique o console do backend.', 'Aviso');
        } else {
          await alert('Gravação salva, mas houve erro ao gerar o LRC. Verifique o console do backend.', {
            type: 'warning',
            title: 'Aviso'
          });
        }
        return;
      }

      console.log('✅ LRC gerado com sucesso:', lrcPath);
      setRecordingIdForScore(recordingId);
      
      if (isPresentationMode) {
        // Calcular pontuação em background
        try {
          const scoreResult = await calculateScoreFromRecordedLRC(selectedSong, recordingId);
          
          if (!scoreResult) {
            await handlePresentationError(
              'Não foi possível calcular a pontuação. Comparação de letras disponível na tela de configuração.',
              'Aviso'
            );
            return;
          }

          // Calcular maxPossiblePoints (total de palavras * 100)
          const maxPossiblePoints = scoreResult.results.reduce((sum, r) => sum + r.totalWords * 100, 0);
          
          // Gerar sessionId único
          const sessionId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
          
          // Salvar pontuação
          console.log('💾 Salvando pontuação...');
          const savedScore = await scoresService.saveScore(
            selectedSong,
            scoreResult.results,
            maxPossiblePoints,
            sessionId
          );
          
          const playerScore: PlayerScore = savedScore.score;
          
          console.log('✅ Pontuação salva:', {
            pontos: playerScore.points,
            maxPontos: maxPossiblePoints,
            porcentagem: maxPossiblePoints > 0 ? Math.round((playerScore.points / maxPossiblePoints) * 100) : 0
          });
          
          // Atualizar pontuação final e parar loading
          setFinalScore({
            score: playerScore,
            maxPoints: maxPossiblePoints
          });
          setIsCalculatingScore(false);
        } catch (scoreError: any) {
          console.error('❌ Erro ao calcular pontuação:', scoreError);
          await handlePresentationError('Erro ao calcular pontuação: ' + scoreError.message);
        }
      } else {
        // Modo config: apenas mostrar comparação
        setLrcRefreshKey(prev => prev + 1);
        setShowLRCComparison(true);
        await alert('Gravação processada! Comparação de letras disponível.', {
          type: 'success',
          title: 'Sucesso'
        });
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar gravação:', error);
      if (isPresentationMode) {
        await handlePresentationError('Erro ao processar gravação: ' + error.message);
      } else {
        await alert('Erro ao processar gravação: ' + error.message, {
          type: 'error',
          title: 'Erro'
        });
      }
    }
  }, [selectedSong, uploadRecording, generateLRC, alert, calculateScoreFromRecordedLRC, viewMode, handlePresentationError, generateLRCAfterRecording]);

  // Se estiver no modo de resultados, mostrar a tela de resultados
  if (viewMode === 'results' && finalScore) {
    return (
      <ResultsScreen
        score={finalScore.score}
        maxPossiblePoints={finalScore.maxPoints}
        userName={finalScore.userName}
        userPhoto={finalScore.userPhoto}
        isLoading={isCalculatingScore}
        onBack={() => {
          setViewMode('home');
          setFinalScore(null);
          setSelectedSong(null);
          setIsCalculatingScore(false);
          setRecordingIdForScore(null);
        }}
      />
    );
  }

  // Se estiver no modo home, mostrar a tela inicial
  if (viewMode === 'home') {
    return (
      <HomeScreen
        onSelectSong={async (songId) => {
          setSelectedSong(songId);
          // Carregar audioMode da música antes de ir para apresentação
          try {
            const song = await songsService.getById(songId);
            if (song.audioMode) {
              setAudioMode(song.audioMode);
            } else {
              setAudioMode('both');
            }
          } catch (err) {
            console.error('Error loading song audio mode:', err);
            setAudioMode('both');
          }
          setViewMode('presentation');
        }}
        onSettingsClick={() => setViewMode('config')}
      />
    );
  }

  // Se estiver no modo de teste de vídeo, mostrar a tela de teste
  if (viewMode === 'videoTest') {
    return (
      <VideoTestView
        songId={selectedSong}
        onBack={() => setViewMode('config')}
      />
    );
  }

  // Se estiver no modo de apresentação, mostrar a tela de karaokê
  if (viewMode === 'presentation') {
    return (
      <>
        {/* Componente de gravação para LRC (invisível, gerencia gravação em background) */}
        <AudioRecorder
          isPlaying={isPlaying}
          songId={selectedSong}
          currentTime={currentTime}
          generateLRCAfterRecording={generateLRCAfterRecording}
          onRecordingComplete={handleRecordingComplete}
          onError={(error) => {
            console.error('Erro na gravação:', error);
            // Não mostrar alerta no modo presentation para não interromper a experiência
          }}
        />
        
        {/* Indicador de gravação/processamento (apenas se estiver processando) */}
        {(isUploading || isProcessing) && (
          <div className="recording-status" style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000 }}>
            {isUploading && <span>📤 Enviando gravação...</span>}
            {isProcessing && <span>🔄 Gerando LRC...</span>}
          </div>
        )}

        <KaraokeView
          songId={selectedSong}
          onSettingsClick={() => setViewMode('config')}
          onSelectSong={(songId) => setSelectedSong(songId)}
          audioMode={audioMode}
          vocalsVolume={vocalsVolume}
          instrumentalVolume={instrumentalVolume}
        />
      </>
    );
  }

  // Modo de configuração (tela atual)
  return (
    <div className="app">
      <div className="app-container">
        {/* Sidebar Esquerda - Lista de Músicas e Processador */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <button
              className="add-music-btn"
              onClick={() => setShowProcessor(!showProcessor)}
              title={showProcessor ? "Ocultar processador" : "Processar nova música"}
            >
              <i className={`fas ${showProcessor ? 'fa-times' : 'fa-plus'}`}></i>
            </button>
            {showProcessor && <span className="add-music-label">Processar Nova Música</span>}
            {viewMode === 'config' && (
              <div className="sidebar-header-buttons">
                <button
                  className="recording-test-btn"
                  onClick={() => setShowRecordingTest(!showRecordingTest)}
                  title={showRecordingTest ? 'Ocultar teste de gravação' : 'Mostrar teste de gravação'}
                >
                  <i className={`fas ${showRecordingTest ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                  <span>{showRecordingTest ? 'Ocultar Teste' : 'Teste de Gravação'}</span>
                </button>
              </div>
            )}
          </div>

          {isLoadingSongs ? (
            <div className="songs-loading">
              <p>Carregando músicas...</p>
            </div>
          ) : (
            <SongTree
              songs={songs}
              categories={categories}
              bands={bands}
              onBandsUpdate={reloadAllData}
              onCategoriesUpdate={reloadAllData}
              onSongMoved={updateSongInList}
              onSongsMoved={updateSongsAfterMove}
              onBandUpdated={updateBandInList}
              selectedSong={selectedSong}
              editingSongName={editingSongName}
              editedSongName={editedSongName}
              processingVideo={processingVideo}
              generatingLRC={generatingLRC}
              activeProcessings={activeProcessings}
              onSongSelect={setSelectedSong}
              onEditSongName={handleEditSongName}
              onSaveSongName={handleSaveSongName}
              onCancelEditSongName={handleCancelEditSongName}
              onEditedSongNameChange={setEditedSongName}
              onDownloadVideo={handleDownloadVideo}
              onGenerateLRC={handleGenerateLRC}
              onDeleteSong={handleDeleteSong}
            />
          )}
        </aside>

        {/* Divisor Vertical */}
        <div className="divider"></div>

        {/* Área Principal - Karaokê */}
        <main className="karaoke-area">
          {/* Modal de Processar Nova Música */}
          {showProcessor && (
            <div className="music-processor-modal-overlay" onClick={() => {
              // Permitir fechar mesmo se estiver processando (continua em background)
              setShowProcessor(false);
            }}>
              <div className="music-processor-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="music-processor-modal-header">
                  <h3>Processar Nova Música</h3>
                  <button
                    className="music-processor-close-btn"
                    onClick={() => setShowProcessor(false)}
                    title="Fechar (o processamento continuará em background)"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <MusicProcessor 
                  onProcessComplete={(songId) => {
                    handleProcessComplete(songId);
                    setShowProcessor(false); // Fechar modal quando completar
                  }}
                  onProcessingStart={handleProcessingStart}
                  activeProcessings={activeProcessings}
                />
              </div>
            </div>
          )}

          {/* Componente de Teste de Gravação */}
          {viewMode === 'config' && showRecordingTest && <RecordingTest />}

          {!selectedSong ? (
            <div className="empty-state">
              <div className="empty-icon">
                <i className="fas fa-microphone"></i>
              </div>
              <h2>Selecione uma música</h2>
              <p>Escolha uma música da lista ao lado para começar</p>
            </div>
          ) : !isReady ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>Carregando dados...</p>
            </div>
          ) : (
            <>
              {/* Componente de gravação (invisível, gerencia gravação em background) */}
              <AudioRecorder
                isPlaying={isPlaying}
                songId={selectedSong}
                currentTime={currentTime}
                generateLRCAfterRecording={generateLRCAfterRecording}
                onRecordingComplete={handleRecordingComplete}
                onError={(error) => {
                  console.error('Erro na gravação:', error);
                  alert(error, { type: 'error', title: 'Erro na Gravação' });
                }}
              />


              {recordingError && (
                <div className="recording-error">
                  ⚠️ {recordingError}
                </div>
              )}

              {showLRCComparison ? (
                <div className="lrc-comparison-wrapper">
                  <LRCComparison
                    songId={selectedSong}
                    originalLyrics={lyrics}
                    onClose={() => setShowLRCComparison(false)}
                    refreshKey={lrcRefreshKey}
                  />
                </div>
              ) : (
                <>
                  <div className="player-section">
                    <AudioControls
                      mode={audioMode}
                      onModeChange={handleAudioModeChange}
                      vocalsVolume={vocalsVolume}
                      instrumentalVolume={instrumentalVolume}
                      onVocalsVolumeChange={setVocalsVolume}
                      onInstrumentalVolumeChange={setInstrumentalVolume}
                      generateLRCAfterRecording={generateLRCAfterRecording}
                      showPresentationButton={!!selectedSong}
                      onPresentationClick={() => setViewMode('presentation')}
                      hasVideo={selectedSongHasVideo}
                      onVideoTestClick={() => setViewMode('videoTest')}
                      onGenerateLRCChange={async (enabled: boolean) => {
                        setGenerateLRCAfterRecording(enabled);
                        
                        // Salvar no banco de dados se houver música selecionada
                        if (selectedSong) {
                          try {
                            await songsService.update(selectedSong, {
                              generateLRCAfterRecording: enabled
                            });
                            
                            // Atualização granular em vez de reload completo
                            await updateSongInList(selectedSong);
                          } catch (error: any) {
                            console.error('Error saving generateLRCAfterRecording:', error);
                            // Não mostrar alerta para não interromper a experiência do usuário
                          }
                        }
                      }}
                    />
                    <AudioPlayer
                      isPlaying={isPlaying}
                      currentTime={currentTime}
                      onPlay={play}
                      onPause={pause}
                      onSeek={seek}
                      audioMode={audioMode}
                      vocalsVolume={vocalsVolume}
                      instrumentalVolume={instrumentalVolume}
                      songId={selectedSong}
                      onDurationChange={(duration) => {
                        if (duration > 0 && isFinite(duration)) {
                          setSongDuration(duration);
                        }
                      }}
                    />
                  </div>

                  <div className="lyrics-section">
                    <LyricsDisplay
                      lyrics={lyrics}
                      currentTime={currentTime}
                      songId={selectedSong}
                      onLyricsUpdate={(updatedLyrics) => {
                        setLyrics(updatedLyrics);
                      }}
                      onRegenerateSegment={handleOpenSegmentRegenerator}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
      
      {/* Notificação de processamento em background */}
      <ProcessingNotification 
        activeProcessings={activeProcessings}
        songs={songs}
      />
      
      {AlertComponent}
      {ConfirmComponent}

      {/* Modal de comparação de regeneração de LRC */}
      {showLRCRegenerationComparison && lrcRegenerationData && (
        <div className="modal-overlay" onClick={() => {}}>
          <div className="modal-content lrc-comparison-modal" onClick={(e) => e.stopPropagation()}>
            <LRCRegenerationComparison
              songId={lrcRegenerationData.songId}
              oldLyrics={lrcRegenerationData.oldLyrics}
              newLyrics={lrcRegenerationData.newLyrics}
              onSave={async (useNew: boolean) => {
                try {
                  await processingService.saveLRC(lrcRegenerationData.songId, useNew);
                  await updateSongInList(lrcRegenerationData.songId);
                  setShowLRCRegenerationComparison(false);
                  setLrcRegenerationData(null);
                  await alert(
                    useNew ? 'Novo LRC salvo com sucesso!' : 'LRC antigo mantido.',
                    { type: 'success', title: 'Sucesso' }
                  );
                } catch (error: any) {
                  await alert('Erro ao salvar LRC: ' + (error.message || 'Erro desconhecido'), {
                    type: 'error',
                    title: 'Erro',
                  });
                }
              }}
              onClose={() => {
                setShowLRCRegenerationComparison(false);
                setLrcRegenerationData(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Modal de regeneração de trecho de LRC */}
      {showLRCSegmentRegenerator && segmentRegeneratorSongId && (
        <div className="modal-overlay" onClick={() => {}}>
          <div className="modal-content lrc-segment-modal" onClick={(e) => e.stopPropagation()}>
            <LRCSegmentRegenerator
              songId={segmentRegeneratorSongId}
              lyrics={lyrics}
              onRegenerate={handleRegenerateSegment}
              onRemove={handleRemoveSegment}
              onEdit={handleEditSegment}
              onClose={() => {
                setShowLRCSegmentRegenerator(false);
                setSegmentRegeneratorSongId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

