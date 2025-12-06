import { useEffect, useState } from 'react';
import './SongSelectorModal.css';

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
}

interface SongSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSong: (songId: string) => void;
}

export default function SongSelectorModal({
  isOpen,
  onClose,
  onSelectSong
}: SongSelectorModalProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSongs();
    }
  }, [isOpen]);

  const loadSongs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/songs');
      if (!response.ok) {
        throw new Error('Erro ao carregar músicas');
      }
      const data = await response.json();
      setSongs(data.songs || []);
    } catch (error) {
      console.error('Error loading songs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSong = (songId: string) => {
    onSelectSong(songId);
    onClose();
  };

  const filteredSongs = songs.filter(song => {
    const search = searchTerm.toLowerCase();
    return (
      song.displayName?.toLowerCase().includes(search) ||
      song.name?.toLowerCase().includes(search) ||
      song.artist?.toLowerCase().includes(search)
    );
  });

  const readySongs = filteredSongs.filter(song => song.status.ready);
  const processingSongs = filteredSongs.filter(song => !song.status.ready);

  if (!isOpen) return null;

  return (
    <div className="song-selector-modal-overlay" onClick={onClose}>
      <div className="song-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="song-selector-header">
          <h2>
            <i className="fas fa-music"></i>
            Selecionar Música
          </h2>
          <button className="song-selector-close" onClick={onClose} title="Fechar">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="song-selector-search">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Buscar música..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        <div className="song-selector-content">
          {isLoading ? (
            <div className="song-selector-loading">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Carregando músicas...</p>
            </div>
          ) : readySongs.length === 0 && processingSongs.length === 0 ? (
            <div className="song-selector-empty">
              <i className="fas fa-music"></i>
              <p>Nenhuma música encontrada</p>
              {searchTerm && (
                <p className="song-selector-empty-hint">Tente uma busca diferente</p>
              )}
            </div>
          ) : (
            <>
              {readySongs.length > 0 && (
                <div className="song-selector-section">
                  <h3>
                    <i className="fas fa-check-circle"></i>
                    Prontas ({readySongs.length})
                  </h3>
                  <div className="song-selector-list">
                    {readySongs.map((song) => (
                      <div
                        key={song.id}
                        className="song-selector-item ready"
                        onClick={() => handleSelectSong(song.id)}
                      >
                        <div className="song-selector-item-info">
                          <i className="fas fa-play-circle"></i>
                          <div>
                            <span className="song-selector-item-name">
                              {song.displayName || song.name}
                            </span>
                            {song.artist && (
                              <span className="song-selector-item-artist">
                                {song.artist}
                              </span>
                            )}
                          </div>
                        </div>
                        <i className="fas fa-chevron-right"></i>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {processingSongs.length > 0 && (
                <div className="song-selector-section">
                  <h3>
                    <i className="fas fa-hourglass-half"></i>
                    Processando ({processingSongs.length})
                  </h3>
                  <div className="song-selector-list">
                    {processingSongs.map((song) => (
                      <div
                        key={song.id}
                        className="song-selector-item processing"
                        title="Processamento incompleto"
                      >
                        <div className="song-selector-item-info">
                          <i className="fas fa-hourglass-half"></i>
                          <div>
                            <span className="song-selector-item-name">
                              {song.displayName || song.name}
                            </span>
                            {song.artist && (
                              <span className="song-selector-item-artist">
                                {song.artist}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="song-selector-item-status">Processando...</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

