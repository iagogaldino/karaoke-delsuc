import { useEffect, useState, useRef } from 'react';
import { songsService } from '../services/songsService.js';
import { API_CONFIG } from '../config/index.js';
import './VideoTestView.css';

interface VideoTestViewProps {
  songId: string | null;
  onBack: () => void;
}

export default function VideoTestView({ songId, onBack }: VideoTestViewProps) {
  const [hasVideo, setHasVideo] = useState(false);
  const [videoFilename, setVideoFilename] = useState<string | null>(null);
  const [songName, setSongName] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!songId) {
      setHasVideo(false);
      setVideoFilename(null);
      setSongName('');
      return;
    }

    // Carregar informações da música
    songsService.getById(songId)
      .then(song => {
        setSongName(song.displayName || song.name || '');
        if (song && song.files?.video) {
          setHasVideo(true);
          setVideoFilename(song.files.video);
        } else {
          setHasVideo(false);
          setVideoFilename(null);
        }
      })
      .catch(() => {
        setHasVideo(false);
        setVideoFilename(null);
      });
  }, [songId]);

  return (
    <div className="video-test-view">
      <div className="video-test-header">
        <button className="video-test-back-btn" onClick={onBack} title="Voltar">
          <i className="fas fa-arrow-left"></i>
          <span>Voltar</span>
        </button>
        <h2>Teste de Vídeo</h2>
        {songName && <p className="video-test-song-name">{songName}</p>}
      </div>

      <div className="video-test-content">
        {!songId ? (
          <div className="video-test-empty">
            <i className="fas fa-video"></i>
            <p>Nenhuma música selecionada</p>
          </div>
        ) : !hasVideo ? (
          <div className="video-test-empty">
            <i className="fas fa-video-slash"></i>
            <p>Esta música não possui vídeo</p>
          </div>
        ) : videoFilename ? (
          <div className="video-test-player">
            <video
              ref={videoRef}
              src={`${API_CONFIG.BASE_URL}/music/${songId}/${videoFilename}`}
              className="video-test-video"
              controls
              autoPlay
              muted={false}
              playsInline
              preload="auto"
            />
          </div>
        ) : (
          <div className="video-test-empty">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Carregando vídeo...</p>
          </div>
        )}
      </div>
    </div>
  );
}
