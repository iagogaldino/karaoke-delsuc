import { useState, useEffect } from 'react';
import AudioPlayer from './components/AudioPlayer';
import LyricsDisplay from './components/LyricsDisplay';
import AudioControls, { AudioMode } from './components/AudioControls';
import MusicProcessor from './components/MusicProcessor';
import KaraokeView from './components/KaraokeView';
import { useSyncWebSocket } from './hooks/useSyncWebSocket';
import './App.css';

interface Song {
  id: string;
  name: string;
  displayName: string;
  artist: string;
  duration: number;
  status: {
    ready: boolean;
    vocals: boolean;
    instrumental: boolean;
    waveform: boolean;
    lyrics: boolean;
  };
  files?: {
    video?: string;
  };
}

function App() {
  const [viewMode, setViewMode] = useState<'config' | 'presentation'>('presentation');
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
  const [editingSongName, setEditingSongName] = useState<string | null>(null);
  const [editedSongName, setEditedSongName] = useState<string>('');
  const { currentTime, isPlaying, play, pause, seek } = useSyncWebSocket();

  // Carregar lista de músicas do banco de dados
  useEffect(() => {
    const loadSongs = async () => {
      try {
        setIsLoadingSongs(true);
        const response = await fetch('/api/songs');
        if (!response.ok) {
          throw new Error('Erro ao carregar músicas');
        }
        const data = await response.json();
        setSongs(data.songs || []);
      } catch (error) {
        console.error('Error loading songs:', error);
      } finally {
        setIsLoadingSongs(false);
      }
    };

    loadSongs();
  }, []);

  // Recarregar lista quando uma música for processada
  const handleProcessComplete = (songId: string) => {
    setShowProcessor(false);
    // Recarregar lista de músicas
    fetch('/api/songs')
      .then(res => res.json())
      .then(data => {
        setSongs(data.songs || []);
        // Selecionar a música recém-processada
        if (songId) {
          setSelectedSong(songId);
        }
      })
      .catch(err => console.error('Error reloading songs:', err));
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
      const response = await fetch(`/api/songs/${songId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: editedSongName.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar nome');
      }

      // Recarregar lista de músicas
      fetch('/api/songs')
        .then(res => res.json())
        .then(data => setSongs(data.songs || []))
        .catch(err => console.error('Error reloading songs:', err));

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

  // Função para processar vídeo de uma música
  const handleDownloadVideo = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevenir que o clique selecione a música
    
    if (processingVideo[songId]) {
      return; // Já está processando
    }

    try {
      setProcessingVideo(prev => ({ ...prev, [songId]: true }));
      
      const response = await fetch(`/api/processing/download-video/${songId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao processar vídeo');
      }

      const data = await response.json();
      alert('Processamento de vídeo iniciado! Acompanhe o progresso no console do backend.');
      
      // Recarregar lista de músicas após um tempo
      setTimeout(() => {
        fetch('/api/songs')
          .then(res => res.json())
          .then(data => setSongs(data.songs || []))
          .catch(err => console.error('Error reloading songs:', err));
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
  const handleDeleteSong = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevenir que o clique selecione a música
    
    if (!window.confirm(`Tem certeza que deseja remover esta música?\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/songs/${songId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao remover música');
      }

      // Se a música removida estava selecionada, limpar seleção
      if (selectedSong === songId) {
        setSelectedSong(null);
        setIsReady(false);
        setLyrics([]);
      }

      // Recarregar lista de músicas
      const songsResponse = await fetch('/api/songs');
      const songsData = await songsResponse.json();
      setSongs(songsData.songs || []);

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
      return;
    }

    setIsReady(false);

    // Carregar letras
    fetch(`/api/lyrics/json?song=${selectedSong}`)
      .then(res => res.json())
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
                onClick={() => {
                  fetch('/api/songs')
                    .then(res => res.json())
                    .then(data => setSongs(data.songs || []))
                    .catch(err => console.error('Error reloading songs:', err));
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
                  onModeChange={setAudioMode}
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

