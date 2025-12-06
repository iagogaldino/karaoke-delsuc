import { useEffect, useState } from 'react';
import LyricsDisplay from './LyricsDisplay';
import { useSyncWebSocket } from '../hooks/useSyncWebSocket';
import AudioPlayer from './AudioPlayer';
import SongSelectorModal from './SongSelectorModal';
import MusicAnimation from './MusicAnimation';
import { AudioMode } from './AudioControls';
import './KaraokeView.css';

interface KaraokeViewProps {
  songId: string | null;
  onSettingsClick: () => void;
  onSelectSong: (songId: string) => void;
  audioMode: AudioMode;
  vocalsVolume: number;
  instrumentalVolume: number;
}

export default function KaraokeView({
  songId,
  onSettingsClick,
  onSelectSong,
  audioMode,
  vocalsVolume,
  instrumentalVolume
}: KaraokeViewProps) {
  const [lyrics, setLyrics] = useState<any[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [showSongSelector, setShowSongSelector] = useState(false);
  const { currentTime, isPlaying, play, pause, seek } = useSyncWebSocket();

  // Carregar letras quando a música mudar
  useEffect(() => {
    if (!songId) {
      setIsReady(false);
      setLyrics([]);
      return;
    }

    setIsReady(false);

    fetch(`/api/lyrics/json?song=${songId}`)
      .then(res => res.json())
      .then(data => {
        setLyrics(data.lyrics || []);
      })
      .catch(err => console.error('Error loading lyrics:', err));
  }, [songId]);

  useEffect(() => {
    if (songId && lyrics.length > 0) {
      setIsReady(true);
    }
  }, [lyrics, songId]);

  // Abrir modal automaticamente quando não houver música selecionada
  useEffect(() => {
    if (!songId) {
      setShowSongSelector(true);
    } else {
      setShowSongSelector(false);
    }
  }, [songId]);

  // Se não houver música selecionada, mostrar o modal de seleção
  if (!songId || !isReady) {
    return (
      <div className="karaoke-view">
        <MusicAnimation />
        <div className="karaoke-view-empty">
          <i className="fas fa-music"></i>
          <p>Nenhuma música selecionada</p>
          <button
            className="karaoke-select-song-btn"
            onClick={() => setShowSongSelector(true)}
          >
            <i className="fas fa-list"></i>
            Selecionar Música
          </button>
        </div>
        <SongSelectorModal
          isOpen={showSongSelector}
          onClose={() => setShowSongSelector(false)}
          onSelectSong={(id) => {
            onSelectSong(id);
            setShowSongSelector(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="karaoke-view">
      {/* Controles superiores */}
      <div className="karaoke-controls">
        <button
          className="karaoke-play-btn"
          onClick={isPlaying ? pause : play}
          title={isPlaying ? 'Pausar' : 'Reproduzir'}
        >
          {isPlaying ? (
            <i className="fas fa-pause"></i>
          ) : (
            <i className="fas fa-play"></i>
          )}
        </button>
        <button
          className="karaoke-settings-btn"
          onClick={onSettingsClick}
          title="Configurações"
        >
          <i className="fas fa-cog"></i>
        </button>
      </div>

      {/* Área de vídeo/imagem */}
      <div className="karaoke-media-area">
        <div className="media-placeholder">
          <i className="fas fa-image"></i>
          <p>Área de vídeo da música ou imagem</p>
        </div>
      </div>

      {/* Área de letras */}
      <div className="karaoke-lyrics-area">
        <LyricsDisplay
          lyrics={lyrics}
          currentTime={currentTime}
          songId={songId}
          onLyricsUpdate={(updatedLyrics) => {
            setLyrics(updatedLyrics);
          }}
        />
      </div>

      {/* Player de áudio oculto (para controle) */}
      <div className="karaoke-audio-hidden">
        <AudioPlayer
          isPlaying={isPlaying}
          currentTime={currentTime}
          onPlay={play}
          onPause={pause}
          onSeek={seek}
          audioMode={audioMode}
          vocalsVolume={vocalsVolume}
          instrumentalVolume={instrumentalVolume}
          songId={songId}
        />
      </div>
    </div>
  );
}

