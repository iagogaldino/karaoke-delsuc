import { useEffect, useRef, useState } from 'react';
import './AudioPlayer.css';
import { AudioMode } from './AudioControls';

interface AudioPlayerProps {
  isPlaying: boolean;
  currentTime: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  audioMode: AudioMode;
  vocalsVolume: number;
  instrumentalVolume: number;
  songId: string | null;
}

export default function AudioPlayer({
  isPlaying,
  currentTime,
  onPlay,
  onPause,
  onSeek,
  audioMode,
  vocalsVolume,
  instrumentalVolume,
  songId
}: AudioPlayerProps) {
  const vocalsRef = useRef<HTMLAudioElement>(null);
  const instrumentalRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);

  // Carregar áudios
  useEffect(() => {
    const vocals = vocalsRef.current;
    const instrumental = instrumentalRef.current;

    if (!vocals || !instrumental || !songId) return;

    const vocalsUrl = songId ? `/api/audio/vocals?song=${songId}` : '/api/audio/vocals';
    const instrumentalUrl = songId ? `/api/audio/instrumental?song=${songId}` : '/api/audio/instrumental';
    
    vocals.src = vocalsUrl;
    instrumental.src = instrumentalUrl;

    // Forçar carregamento do buffer
    vocals.load();
    instrumental.load();

    const handleLoadedMetadata = () => {
      if (vocals.duration && instrumental.duration && isFinite(vocals.duration) && isFinite(instrumental.duration)) {
        const maxDuration = Math.max(vocals.duration, instrumental.duration);
        if (maxDuration > 0 && isFinite(maxDuration)) {
          setDuration(maxDuration);
        }
      }
    };
    
    // Atualizar duração quando mudar
    const updateDuration = () => {
      if (vocals.duration && instrumental.duration && isFinite(vocals.duration) && isFinite(instrumental.duration)) {
        const maxDuration = Math.max(vocals.duration, instrumental.duration);
        if (maxDuration > 0 && isFinite(maxDuration)) {
          setDuration(maxDuration);
        }
      }
    };

    const checkBuffer = () => {
      // Verificar se ambos têm buffer suficiente (3-5 segundos)
      const minBuffer = 3;
      
      if (vocals.buffered.length > 0 && instrumental.buffered.length > 0) {
        const vocalsBuffered = vocals.buffered.end(0);
        const instrumentalBuffered = instrumental.buffered.end(0);
        
        // Atualizar buffered para exibição
        setBuffered(Math.min(vocalsBuffered, instrumentalBuffered));
        
        if (vocalsBuffered >= minBuffer && instrumentalBuffered >= minBuffer) {
          setIsBuffering(false);
          return true;
        }
      }
      return false;
    };

    const handleCanPlay = () => {
      checkBuffer();
    };

    const handleProgress = () => {
      checkBuffer();
    };

    const handleLoadedData = () => {
      checkBuffer();
    };

    // Verificar buffer periodicamente
    let lastBufferingState = true;
    const bufferCheckInterval = setInterval(() => {
      const hasBuffer = checkBuffer();
      if (!hasBuffer && !lastBufferingState) {
        // Se estava pronto mas perdeu buffer, voltar a buffering
        setIsBuffering(true);
        lastBufferingState = true;
      } else if (hasBuffer) {
        lastBufferingState = false;
      }
    }, 500);

    // Timeout de segurança: permitir play após 10 segundos mesmo sem buffer completo
    const bufferTimeout = setTimeout(() => {
      if (vocals.readyState >= 2 && instrumental.readyState >= 2) {
        // HAVE_CURRENT_DATA ou superior
        setIsBuffering(false);
      }
    }, 10000);

    vocals.addEventListener('loadedmetadata', handleLoadedMetadata);
    instrumental.addEventListener('loadedmetadata', handleLoadedMetadata);
    vocals.addEventListener('durationchange', updateDuration);
    instrumental.addEventListener('durationchange', updateDuration);
    vocals.addEventListener('canplay', handleCanPlay);
    instrumental.addEventListener('canplay', handleCanPlay);
    vocals.addEventListener('progress', handleProgress);
    instrumental.addEventListener('progress', handleProgress);
    vocals.addEventListener('loadeddata', handleLoadedData);
    instrumental.addEventListener('loadeddata', handleLoadedData);

    return () => {
      clearInterval(bufferCheckInterval);
      clearTimeout(bufferTimeout);
      vocals.removeEventListener('loadedmetadata', handleLoadedMetadata);
      instrumental.removeEventListener('loadedmetadata', handleLoadedMetadata);
      vocals.removeEventListener('durationchange', updateDuration);
      instrumental.removeEventListener('durationchange', updateDuration);
      vocals.removeEventListener('canplay', handleCanPlay);
      instrumental.removeEventListener('canplay', handleCanPlay);
      vocals.removeEventListener('progress', handleProgress);
      instrumental.removeEventListener('progress', handleProgress);
      vocals.removeEventListener('loadeddata', handleLoadedData);
      instrumental.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [songId]);

  // Aplicar volumes e modo de áudio
  useEffect(() => {
    const vocals = vocalsRef.current;
    const instrumental = instrumentalRef.current;

    if (!vocals || !instrumental) return;

    // Aplicar volumes
    vocals.volume = vocalsVolume;
    instrumental.volume = instrumentalVolume;

    // Aplicar modo (mute baseado no modo)
    switch (audioMode) {
      case 'vocals-only':
        vocals.muted = false;
        instrumental.muted = true;
        break;
      case 'instrumental-only':
        vocals.muted = true;
        instrumental.muted = false;
        break;
      case 'both':
      default:
        vocals.muted = false;
        instrumental.muted = false;
        break;
    }
  }, [audioMode, vocalsVolume, instrumentalVolume]);

  // Sincronizar play/pause
  useEffect(() => {
    const vocals = vocalsRef.current;
    const instrumental = instrumentalRef.current;

    if (!vocals || !instrumental) return;

    if (isPlaying) {
      // Sempre tocar ambos para manter sincronização, mas o mute controla o que é ouvido
      vocals.play().catch(console.error);
      instrumental.play().catch(console.error);
    } else {
      vocals.pause();
      instrumental.pause();
    }
  }, [isPlaying]);

  // Sincronizar seek
  useEffect(() => {
    const vocals = vocalsRef.current;
    const instrumental = instrumentalRef.current;

    if (!vocals || !instrumental) return;

    // Só atualizar se a diferença for significativa (> 0.1s)
    const diff = Math.abs(vocals.currentTime - currentTime);
    if (diff > 0.1) {
      vocals.currentTime = currentTime;
      instrumental.currentTime = currentTime;
    }
  }, [currentTime]);

  // Atualizar buffered continuamente
  useEffect(() => {
    const vocals = vocalsRef.current;
    const instrumental = instrumentalRef.current;
    if (!vocals || !instrumental) return;

    const updateBuffered = () => {
      if (vocals.buffered.length > 0 && instrumental.buffered.length > 0) {
        const vocalsBuffered = vocals.buffered.end(0);
        const instrumentalBuffered = instrumental.buffered.end(0);
        setBuffered(Math.min(vocalsBuffered, instrumentalBuffered));
      }
    };

    const interval = setInterval(updateBuffered, 200);

    vocals.addEventListener('progress', updateBuffered);
    instrumental.addEventListener('progress', updateBuffered);

    return () => {
      clearInterval(interval);
      vocals.removeEventListener('progress', updateBuffered);
      instrumental.removeEventListener('progress', updateBuffered);
    };
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    onSeek(newTime);
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-player">
      <audio ref={vocalsRef} preload="auto" />
      <audio ref={instrumentalRef} preload="auto" />

      <div className="player-header">
        <div className="player-thumbnail">
          <i className="fas fa-music"></i>
        </div>
        <div className="player-info">
          <button
            className="play-pause-btn"
            onClick={isPlaying ? onPause : onPlay}
            disabled={isBuffering}
            data-playing={isPlaying ? 'true' : 'false'}
          >
            {isBuffering ? (
              <i className="fas fa-hourglass-half"></i>
            ) : isPlaying ? (
              <i className="fas fa-pause"></i>
            ) : (
              <i className="fas fa-play"></i>
            )}
          </button>
          <div className="time-display">
            <span>{formatTime(Math.min(currentTime, duration > 0 ? duration : currentTime))}</span>
            <span className="time-separator">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <div className="progress-container">
        <div className="progress-bar">
          <div
            className="progress-buffered"
            style={{ width: `${duration > 0 ? Math.min((buffered / duration) * 100, 100) : 0}%` }}
          />
          <div
            className="progress-filled"
            style={{ width: `${duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0}%` }}
          />
        </div>
        <input
          type="range"
          min="0"
          max={duration > 0 ? duration : 0}
          value={Math.min(currentTime, duration > 0 ? duration : 0)}
          onChange={handleSeek}
          className="progress-slider"
          disabled={isBuffering || duration <= 0}
          step="0.1"
        />
      </div>

      {isBuffering && (
        <div className="buffering-indicator">
          <p>Carregando buffer... ({formatTime(buffered)})</p>
        </div>
      )}
    </div>
  );
}

