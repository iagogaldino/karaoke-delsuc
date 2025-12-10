import { useState, useEffect } from 'react';
import AudioPlayer from './components/AudioPlayer';
import LyricsDisplay from './components/LyricsDisplay';
import AudioControls from './components/AudioControls';
import MusicProcessor from './components/MusicProcessor';
import KaraokeView from './components/KaraokeView';
import ResultsScreen from './components/ResultsScreen.js';
import HomeScreen from './components/HomeScreen.js';
import SongTree from './components/SongTree.js';
import { useSyncWebSocket } from './hooks/useSyncWebSocket';
import { songsService } from './services/songsService.js';
import { lyricsService } from './services/lyricsService.js';
import { processingService } from './services/processingService.js';
import { bandsService } from './services/bandsService.js';
import { categoriesService } from './services/categoriesService.js';
import { Song, AudioMode, PlayerScore, Band, Category } from './types/index.js';
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
  const [finalScore, setFinalScore] = useState<{ score: PlayerScore; maxPoints: number; userName?: string; userPhoto?: string } | null>(null);
  const { currentTime, isPlaying, play, pause, seek } = useSyncWebSocket();

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
  const handleProcessComplete = async (songId: string) => {
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
  };

  // Função para recarregar todas as músicas, categorias e bandas
  const reloadAllData = async () => {
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
  };

  // Atualização granular: atualiza apenas uma música específica
  const updateSongInList = async (songId: string) => {
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
  };

  // Atualização granular: atualiza apenas uma banda específica
  const updateBandInList = async (bandId: string) => {
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
  };

  // Atualização granular: atualiza músicas que mudaram de categoria/banda
  const updateSongsAfterMove = async (songIds: string[]) => {
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
  };

  // Função para editar nome da música
  const handleEditSongName = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSongName(song.id);
    setEditedSongName(song.displayName || song.name);
  };

  const handleSaveSongName = async (songId: string) => {
    if (!editedSongName || editedSongName.trim() === '') {
      alert('Nome não pode estar vazio');
      return;
    }

    try {
      await songsService.update(songId, {
        displayName: editedSongName.trim()
      });

      // Recarregar lista de músicas
      const songs = await songsService.getAll();
      setSongs(songs);

      setEditingSongName(null);
      setEditedSongName('');
    } catch (error: any) {
      console.error('Error updating song name:', error);
      alert('Erro ao atualizar nome: ' + error.message);
    }
  };

  const handleCancelEditSongName = () => {
    setEditingSongName(null);
    setEditedSongName('');
  };

  // Função para salvar audioMode quando alterado
  const handleAudioModeChange = async (mode: AudioMode) => {
    setAudioMode(mode);
    
    // Salvar no banco de dados se houver música selecionada
    if (selectedSong) {
      try {
        await songsService.update(selectedSong, {
          audioMode: mode
        });
        
        // Atualizar a lista de músicas para refletir a mudança
        const songs = await songsService.getAll();
        setSongs(songs);
      } catch (error: any) {
        console.error('Error saving audio mode:', error);
        // Não mostrar alerta para não interromper a experiência do usuário
      }
    }
  };

  // Função para processar vídeo de uma música
  const handleDownloadVideo = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevenir que o clique selecione a música
    
    if (processingVideo[songId]) {
      return; // Já está processando
    }

    try {
      setProcessingVideo(prev => ({ ...prev, [songId]: true }));
      
      await processingService.downloadVideo(songId);
      alert('Processamento de vídeo iniciado! Acompanhe o progresso no console do backend.');
      
      // Recarregar lista de músicas após um tempo
      setTimeout(async () => {
        try {
          const songs = await songsService.getAll();
          setSongs(songs);
        } catch (err) {
          console.error('Error reloading songs:', err);
        }
      }, 5000);
    } catch (error: any) {
      console.error('Error processing video:', error);
      alert('Erro ao processar vídeo: ' + error.message);
    } finally {
      setProcessingVideo(prev => {
        const newState = { ...prev };
        delete newState[songId];
        return newState;
      });
    }
  };

  // Função para remover uma música
  const handleGenerateLRC = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (generatingLRC[songId]) {
      return;
    }

    if (!confirm('Deseja gerar/regenerar as letras LRC para esta música?')) {
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

      // Recarregar lista de músicas
      const songs = await songsService.getAll();
      setSongs(songs);
      
      alert('Letras LRC geradas com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar LRC:', error);
      alert('Erro ao gerar LRC: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setGeneratingLRC(prev => {
        const newState = { ...prev };
        delete newState[songId];
        return newState;
      });
    }
  };

  const handleDeleteSong = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevenir que o clique selecione a música
    
    if (!window.confirm(`Tem certeza que deseja remover esta música?\n\nEsta ação não pode ser desfeita.`)) {
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

      // Recarregar lista de músicas
      const songs = await songsService.getAll();
      setSongs(songs);

      alert('Música removida com sucesso!');
    } catch (error: any) {
      console.error('Error deleting song:', error);
      alert('Erro ao remover música: ' + error.message);
    }
  };

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
      if (isPlaying) {
        pause();
      }
    }
  }, [selectedSong]); // eslint-disable-line react-hooks/exhaustive-deps

  // Se estiver no modo de resultados, mostrar a tela de resultados
  if (viewMode === 'results' && finalScore) {
    return (
      <ResultsScreen
        score={finalScore.score}
        maxPossiblePoints={finalScore.maxPoints}
        userName={finalScore.userName}
        userPhoto={finalScore.userPhoto}
        onBack={() => {
          setViewMode('home');
          setFinalScore(null);
          setSelectedSong(null);
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
      <KaraokeView
        songId={selectedSong}
        onSettingsClick={() => setViewMode('config')}
        onSelectSong={(songId) => setSelectedSong(songId)}
        audioMode={audioMode}
        vocalsVolume={vocalsVolume}
        instrumentalVolume={instrumentalVolume}
        onGameOver={(score, maxPoints, userName, userPhoto) => {
          setFinalScore({ score, maxPoints, userName, userPhoto });
          setViewMode('results');
        }}
      />
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
        </main>
      </div>
    </div>
  );
}

export default App;

