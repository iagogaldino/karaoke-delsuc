import { useState, useEffect } from 'react';
import AudioPlayer from './components/AudioPlayer';
import LyricsDisplay from './components/LyricsDisplay';
import AudioControls from './components/AudioControls';
import MusicProcessor from './components/MusicProcessor';
import KaraokeView from './components/KaraokeView';
import ResultsScreen from './components/ResultsScreen.js';
import HomeScreen from './components/HomeScreen.js';
import { useSyncWebSocket } from './hooks/useSyncWebSocket';
import { songsService } from './services/songsService.js';
import { lyricsService } from './services/lyricsService.js';
import { processingService } from './services/processingService.js';
import { Song, AudioMode, PlayerScore } from './types/index.js';
import './App.css';

function App() {
  const [viewMode, setViewMode] = useState<'home' | 'config' | 'presentation' | 'results'>('home');
  const [songs, setSongs] = useState<Song[]>([]);
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

  // Carregar lista de músicas do banco de dados
  useEffect(() => {
    const loadSongs = async () => {
      try {
        setIsLoadingSongs(true);
        const songs = await songsService.getAll();
        setSongs(songs);
      } catch (error) {
        console.error('Error loading songs:', error);
      } finally {
        setIsLoadingSongs(false);
      }
    };

    loadSongs();
  }, []);

  // Recarregar lista quando uma música for processada
  const handleProcessComplete = async (songId: string) => {
    setShowProcessor(false);
    try {
      // Recarregar lista de músicas
      const songs = await songsService.getAll();
      setSongs(songs);
      // Selecionar a música recém-processada
      if (songId) {
        setSelectedSong(songId);
      }
    } catch (err) {
      console.error('Error reloading songs:', err);
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
          
          <div className="song-list">
            <div className="song-list-header">
              <h3>Músicas</h3>
              <button
                className="refresh-btn"
                onClick={async () => {
                  try {
                    const songs = await songsService.getAll();
                    setSongs(songs);
                  } catch (err) {
                    console.error('Error reloading songs:', err);
                  }
                }}
                title="Atualizar lista"
              >
                <i className="fas fa-sync-alt"></i>
              </button>
            </div>
            {isLoadingSongs ? (
              <div className="songs-loading">
                <p>Carregando músicas...</p>
              </div>
            ) : songs.length === 0 ? (
              <div className="songs-empty">
                <p>Nenhuma música encontrada</p>
                <p className="songs-empty-hint">Processe uma música para começar</p>
              </div>
            ) : (
              songs.map((song) => (
                <div
                  key={song.id}
                  className={`song-item ${selectedSong === song.id ? 'active' : ''} ${song.status.ready ? 'ready' : 'processing'}`}
                  onClick={() => !editingSongName && setSelectedSong(song.id)}
                  title={song.status.ready ? 'Pronta para tocar' : 'Processamento incompleto'}
                >
                  {editingSongName === song.id ? (
                    <div className="song-name-edit" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editedSongName}
                        onChange={(e) => setEditedSongName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveSongName(song.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEditSongName();
                          }
                        }}
                        className="song-name-input"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        className="save-name-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveSongName(song.id);
                        }}
                        title="Salvar"
                      >
                        <i className="fas fa-check"></i>
                      </button>
                      <button
                        className="cancel-name-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEditSongName();
                        }}
                        title="Cancelar"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="song-name">{song.displayName || song.name}</span>
                      <button
                        className="edit-name-btn"
                        onClick={(e) => handleEditSongName(song, e)}
                        title="Editar nome"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                    </>
                  )}
                  <div className="song-actions">
                    {song.status.ready && (
                      <span className="play-icon"><i className="fas fa-play"></i></span>
                    )}
                    {!song.status.ready && (
                      <span className="processing-icon" title="Processamento incompleto">
                        <i className="fas fa-hourglass-half"></i>
                      </span>
                    )}
                    {song.status.ready && (
                      <button
                        className="video-btn"
                        onClick={(e) => handleDownloadVideo(song.id, e)}
                        title={song.files?.video ? "Reprocessar vídeo do YouTube" : "Processar vídeo do YouTube"}
                        disabled={processingVideo[song.id]}
                      >
                        {processingVideo[song.id] ? (
                          <i className="fas fa-spinner fa-spin"></i>
                        ) : song.files?.video ? (
                          <i className="fas fa-redo"></i>
                        ) : (
                          <i className="fas fa-video"></i>
                        )}
                      </button>
                    )}
                    <button
                      className="lrc-btn"
                      onClick={(e) => handleGenerateLRC(song.id, e)}
                      title={song.files?.lyrics ? "Regenerar letras LRC" : "Gerar letras LRC"}
                      disabled={generatingLRC[song.id]}
                    >
                      {generatingLRC[song.id] ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : (
                        <i className="fas fa-file-alt"></i>
                      )}
                    </button>
                    <button
                      className="delete-btn"
                      onClick={(e) => handleDeleteSong(song.id, e)}
                      title="Remover música"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
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

