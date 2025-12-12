import { useState, useEffect, useCallback, useMemo } from 'react';
import AudioPlayer from './components/AudioPlayer';
import LyricsDisplay from './components/LyricsDisplay';
import AudioControls from './components/AudioControls';
import MusicProcessor from './components/MusicProcessor';
import KaraokeView from './components/KaraokeView';
import HomeScreen from './components/HomeScreen.js';
import SongTree from './components/SongTree.js';
import AudioRecorder from './components/AudioRecorder';
import LRCComparison from './components/LRCComparison';
import RecordingTest from './components/RecordingTest';
import ResultsScreen from './components/ResultsScreen';
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
import { Song, AudioMode, Band, Category, LyricsLine, PlayerScore } from './types/index.js';
import { alignLRCLinesByTextOnly, calculateScoreFromLRCAlignment } from './utils/textUtils.js';
import './App.css';

function App() {
  const [viewMode, setViewMode] = useState<'home' | 'config' | 'presentation' | 'results'>('home');
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
  const [editingSongName, setEditingSongName] = useState<string | null>(null);
  const [editedSongName, setEditedSongName] = useState<string>('');
  const [showLRCComparison, setShowLRCComparison] = useState(false);
  const [lrcRefreshKey, setLrcRefreshKey] = useState(0);
  const [showRecordingTest, setShowRecordingTest] = useState(false);
  const [songDuration, setSongDuration] = useState<number>(0);
  const [finalScore, setFinalScore] = useState<{ score: PlayerScore; maxPoints: number; userName?: string; userPhoto?: string } | null>(null);
  const [isCalculatingScore, setIsCalculatingScore] = useState(false);
  const [recordingIdForScore, setRecordingIdForScore] = useState<string | null>(null);
  const { currentTime, isPlaying, play, pause, seek } = useSyncWebSocket();
  const { alert, confirm, AlertComponent, ConfirmComponent } = useAlert();
  const { uploadRecording, generateLRC, error: recordingError, isUploading, isProcessing } = useAudioRecorder();

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

  // Recarregar lista quando uma música for processada
  const handleProcessComplete = useCallback(async (songId: string) => {
    setShowProcessor(false);
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
  }, []);

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

  // Atualização granular: atualiza apenas uma música específica
  const updateSongInList = useCallback(async (songId: string) => {
    try {
      const updatedSong = await songsService.getById(songId);
      if (updatedSong) {
        setSongs(prev => prev.map(s => s.id === songId ? updatedSong : s));
      }
    } catch (error) {
      console.error('Error updating song:', error);
      // Se falhar, recarrega tudo como fallback
      reloadAllData();
    }
  }, [reloadAllData]);

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
      await processingService.pollStatus(processId, (status) => {
        console.log(`Geração de LRC: ${status.step} (${status.progress}%)`);
      });

      // Atualização granular em vez de reload completo
      await updateSongInList(songId);
      
      await alert('Letras LRC geradas com sucesso!', { type: 'success', title: 'Sucesso' });
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
      return;
    }

    setIsReady(false);

    // Carregar informações da música incluindo audioMode
    songsService.getById(selectedSong)
      .then(song => {
        // Carregar audioMode salvo ou usar padrão
        if (song.audioMode) {
          setAudioMode(song.audioMode);
        } else {
          setAudioMode('both');
        }
      })
      .catch(err => console.error('Error loading song:', err));

    // Carregar letras
    lyricsService.getJson(selectedSong)
      .then(data => {
        setLyrics(data.lyrics || []);
      })
      .catch(err => console.error('Error loading lyrics:', err));
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

  // Função helper para parse LRC (mesma do LRCComparison)
  const parseLRC = useCallback((lrcContent: string): LyricsLine[] => {
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
  }, []);

  // Função para calcular pontuação do LRC gravado (mesma forma que LRCComparison)
  const calculateScoreFromRecordedLRC = useCallback(async (
    songId: string,
    recordingId?: string
  ): Promise<{ results: Array<{ lyric: string; score: number; percentage: number; totalWords: number }>; totalScore: number } | null> => {
    try {
      // O backend agora aguarda o LRC ser criado antes de retornar sucesso,
      // então não precisamos mais fazer retry aqui
      const recordedLRCContent = await recordingService.getRecordingLRC(songId, recordingId);

      // Carregar letras originais
      const originalLyricsData = await lyricsService.getJson(songId);

      const recordedLyrics = parseLRC(recordedLRCContent);
      const originalLyrics = originalLyricsData.lyrics || [];

      if (originalLyrics.length === 0 || recordedLyrics.length === 0) {
        console.warn('⚠️ Não há letras originais ou gravadas para comparar');
        return null;
      }

      // Usar alinhamento apenas por texto (mesma forma que LRCComparison)
      const alignments = alignLRCLinesByTextOnly(originalLyrics, recordedLyrics, 0.3);

      // Calcular pontuação
      const scoreResult = calculateScoreFromLRCAlignment(alignments);

      return scoreResult;
    } catch (error: any) {
      console.error('❌ Erro ao calcular pontuação do LRC:', error);
      return null;
    }
  }, [parseLRC]);

  // Handler para quando gravação for completada
  const handleRecordingComplete = useCallback(async (audioBlob: Blob, startTime: number) => {
    if (!selectedSong) {
      console.warn('⚠️ Nenhuma música selecionada, ignorando gravação');
      return;
    }

    try {
      console.log('📤 Iniciando upload da gravação...');
      // Fazer upload da gravação
      const recordingId = await uploadRecording(audioBlob, selectedSong, startTime);
      
      if (!recordingId) {
        console.error('❌ Upload falhou: recordingId é null');
        await alert('Erro ao fazer upload da gravação', {
          type: 'error',
          title: 'Erro'
        });
        return;
      }

      console.log('✅ Upload concluído, recordingId:', recordingId);
      console.log('🔄 Iniciando geração de LRC...');
      
      // Aguardar um pouco para garantir que o arquivo foi salvo
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Gerar LRC da gravação, passando o recordingId explicitamente
      const lrcPath = await generateLRC(selectedSong, recordingId);
      
      if (lrcPath) {
        console.log('✅ LRC gerado com sucesso:', lrcPath);
        
        // Guardar recordingId para calcular pontuação depois
        setRecordingIdForScore(recordingId);
        
        // O backend agora aguarda o LRC ser criado antes de retornar sucesso,
        // então não precisamos mais aguardar aqui
        
        // Se estiver no modo presentation, calcular pontuação e mostrar resultados
        // Se estiver no modo config, apenas mostrar comparação
        if (viewMode === 'presentation') {
          // Redirecionar imediatamente para resultados com loading
          setIsCalculatingScore(true);
          setFinalScore({
            score: { total: 0, average: 0, count: 0, points: 0 },
            maxPoints: 0
          });
          setViewMode('results');
          
          // Calcular pontuação em background
          try {
            const scoreResult = await calculateScoreFromRecordedLRC(selectedSong, recordingId);
            
            if (scoreResult) {
              // Calcular maxPossiblePoints (total de palavras * 100)
              const maxPossiblePoints = scoreResult.results.reduce((sum, r) => sum + r.totalWords * 100, 0);
              
              // Gerar sessionId único (ou usar algum ID do usuário se disponível)
              const sessionId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
              
              // Salvar pontuação
              console.log('💾 Salvando pontuação...');
              const savedScore = await scoresService.saveScore(
                selectedSong,
                scoreResult.results,
                maxPossiblePoints,
                sessionId
              );
              
              // Converter para PlayerScore
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
            } else {
              // Se não conseguiu calcular, voltar para home
              setIsCalculatingScore(false);
              setViewMode('home');
              setFinalScore(null);
              await alert('Não foi possível calcular a pontuação. Comparação de letras disponível na tela de configuração.', {
                type: 'warning',
                title: 'Aviso'
              });
            }
          } catch (scoreError: any) {
            console.error('❌ Erro ao calcular pontuação:', scoreError);
            setIsCalculatingScore(false);
            setViewMode('home');
            setFinalScore(null);
            await alert('Erro ao calcular pontuação: ' + scoreError.message, {
              type: 'error',
              title: 'Erro'
            });
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
      } else {
        console.error('❌ Geração de LRC falhou: lrcPath é null');
        await alert('Gravação salva, mas houve erro ao gerar o LRC. Verifique o console do backend.', {
          type: 'warning',
          title: 'Aviso'
        });
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar gravação:', error);
      setIsCalculatingScore(false);
      await alert('Erro ao processar gravação: ' + error.message, {
        type: 'error',
        title: 'Erro'
      });
    }
  }, [selectedSong, uploadRecording, generateLRC, alert, calculateScoreFromRecordedLRC, viewMode]);

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

  // Se estiver no modo de apresentação, mostrar a tela de karaokê
  if (viewMode === 'presentation') {
    return (
      <>
        {/* Componente de gravação para LRC (invisível, gerencia gravação em background) */}
        <AudioRecorder
          isPlaying={isPlaying}
          songId={selectedSong}
          currentTime={currentTime}
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
            {selectedSong && (
              <button
                className="presentation-btn"
                onClick={() => setViewMode('presentation')}
                title="Ir para tela de apresentação"
              >
                <i className="fas fa-tv"></i>
                <span>Apresentação</span>
              </button>
            )}
          </div>

          {showProcessor && (
            <div className="processor-wrapper">
              <MusicProcessor 
                onProcessComplete={handleProcessComplete} 
              />
            </div>
          )}
          
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
          {/* Botão para mostrar/esconder teste de gravação (apenas em modo config) */}
          {viewMode === 'config' && (
            <div className="recording-test-controls">
              <button
                className="btn-toggle-recording-test"
                onClick={() => setShowRecordingTest(!showRecordingTest)}
                title={showRecordingTest ? 'Ocultar teste de gravação' : 'Mostrar teste de gravação'}
              >
                <i className={`fas ${showRecordingTest ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                {showRecordingTest ? 'Ocultar Teste de Gravação' : 'Teste de Gravação'}
              </button>
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
                onRecordingComplete={handleRecordingComplete}
                onError={(error) => {
                  console.error('Erro na gravação:', error);
                  alert(error, { type: 'error', title: 'Erro na Gravação' });
                }}
              />

              {/* Indicador de gravação/processamento */}
              {(isUploading || isProcessing) && (
                <div className="recording-status">
                  {isUploading && <span>📤 Enviando gravação...</span>}
                  {isProcessing && <span>🔄 Gerando LRC...</span>}
                </div>
              )}

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
                    />
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
      {AlertComponent}
      {ConfirmComponent}
    </div>
  );
}

export default App;

