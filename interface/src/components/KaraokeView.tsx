import { useEffect, useState, useRef } from 'react';
import LyricsDisplay from './LyricsDisplay';
import { useSyncWebSocket } from '../hooks/useSyncWebSocket';
import AudioPlayer from './AudioPlayer';
import SongSelectorModal from './SongSelectorModal';
import MusicAnimation from './MusicAnimation';
import StageLights from './StageLights';
import FallingMusicSymbols from './FallingMusicSymbols';
import { AudioMode, LyricsLine, SyncMessage } from '../types/index.js';
import { songsService } from '../services/songsService.js';
import { lyricsService } from '../services/lyricsService.js';
import { formatNumber, formatTime } from '../utils/formatters.js';
import { WEBSOCKET_CONFIG, API_CONFIG } from '../config/index.js';
import './KaraokeView.css';

interface KaraokeViewProps {
  songId: string | null;
  onSettingsClick: () => void;
  onSelectSong: (songId: string) => void;
  audioMode: AudioMode;
  vocalsVolume: number;
  instrumentalVolume: number;
  onGameOver?: (score: PlayerScore, maxPoints: number, userName?: string, userPhoto?: string) => void;
}

export default function KaraokeView({
  songId,
  onSettingsClick,
  onSelectSong,
  audioMode,
  vocalsVolume,
  instrumentalVolume
}: KaraokeViewProps) {
  const [lyrics, setLyrics] = useState<LyricsLine[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [showSongSelector, setShowSongSelector] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentTime, isPlaying, play, pause, seek } = useSyncWebSocket();
  
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [songDuration, setSongDuration] = useState<number>(0);
  const hasShownGameOverRef = useRef<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pauseRef = useRef(pause);

  // Atualizar refs quando as funções mudarem
  useEffect(() => {
    pauseRef.current = pause;
  }, [pause]);

  // Escutar mensagens de desistência via WebSocket (apenas uma vez ao montar)
  useEffect(() => {
    // Se já existe uma conexão WebSocket, não criar outra
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${WEBSOCKET_CONFIG.PATH}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connected for QR code give up notifications');
    };

    ws.onmessage = (event) => {
      try {
        const message: SyncMessage = JSON.parse(event.data);
        
        // Se receber mensagem de desistência, finalizar o jogo
        if (message.type === 'qrcodeGiveUp') {
          console.log('🚫 QR code give up received:', message.userName);
          
          // Parar música
          pauseRef.current();
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected for QR code give up');
      wsRef.current = null;
    };

    return () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []); // Sem dependências - executa apenas uma vez ao montar

  // Carregar letras e verificar vídeo quando a música mudar
  useEffect(() => {
    if (!songId) {
      setIsReady(false);
      setLyrics([]);
      setHasVideo(false);
      setSongDuration(0);
      hasShownGameOverRef.current = false;
      return;
    }

    setIsReady(false);
    setHasVideo(false);
    setSongDuration(0);
    hasShownGameOverRef.current = false;

    // Carregar informações da música para verificar se tem vídeo e obter duração
    songsService.getById(songId)
      .then(song => {
        if (song && song.files?.video) {
          setHasVideo(true);
        }
        // Usar duração da música se disponível
        if (song.duration && song.duration > 0) {
          setSongDuration(song.duration);
        }
      })
      .catch(() => {});

    // Carregar letras
    lyricsService.getJson(songId)
      .then(data => {
        setLyrics(data.lyrics || []);
      })
      .catch(() => {});
  }, [songId]);

  useEffect(() => {
    if (songId && lyrics.length > 0) {
      setIsReady(true);
      
      // Se não tiver duração da música, estimar pela última letra (será sobrescrita pela duração real do áudio quando disponível)
      if (songDuration === 0 && lyrics.length > 0) {
        const lastLyric = lyrics[lyrics.length - 1];
        // Estimar duração: tempo da última letra + 5 segundos
        setSongDuration(lastLyric.time + 5);
      }
      
      // Resetar flag de game over quando mudar de música
      hasShownGameOverRef.current = false;
    }
  }, [lyrics, songId]);
  

  // Detectar fim da música e notificar App.tsx para calcular pontuação
  useEffect(() => {
    if (songDuration > 0 && isPlaying && !hasShownGameOverRef.current) {
      // Usar tolerância muito pequena (0.05s) para detectar quando está praticamente no fim
      // Ou se o tempo ultrapassou a duração por mais de 0.1s (para dar margem para pequenas imprecisões)
      const tolerance = 0.05; // 50ms de tolerância
      const isVeryNearEnd = currentTime >= songDuration - tolerance;
      const hasSignificantlyPassedDuration = currentTime >= songDuration + 0.1;
      
      // Só marcar como terminado se estiver muito próximo do fim ou se passou significativamente
      if (isVeryNearEnd || hasSignificantlyPassedDuration) {
        // Música terminou - marcar flag ANTES de qualquer outra ação
        hasShownGameOverRef.current = true;
        
        // Parar música IMEDIATAMENTE (sem delay) para evitar que recomece
        pause();
        
        // Se passou da duração, fazer seek para o fim exato para garantir que a barra de progresso mostre 100%
        // Mas só fazer seek se realmente passou, não se estiver apenas próximo
        if (currentTime > songDuration) {
          seek(songDuration);
        }
      }
    }
  }, [currentTime, songDuration, isPlaying, pause, seek]);

  // Sincronizar vídeo com o áudio
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasVideo) return;

    // Garantir que o vídeo está muted (sem áudio)
    video.muted = true;

    // Sincronizar tempo
    const timeDiff = Math.abs(video.currentTime - currentTime);
    if (timeDiff > 0.5 && timeDiff < 5) { // Tolerância de 0.5s, mas evitar grandes saltos
      video.currentTime = currentTime;
    }

    // Sincronizar play/pause
    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [currentTime, isPlaying, hasVideo]);

  // Lidar com seek do vídeo
  const handleVideoSeek = () => {
    const video = videoRef.current;
    if (video && Math.abs(video.currentTime - currentTime) > 0.5) {
      seek(video.currentTime);
    }
  };

  // normalizeText is now imported from utils

  // Abrir modal automaticamente quando não houver música selecionada
  useEffect(() => {
    if (!songId) {
      setShowSongSelector(true);
    } else {
      setShowSongSelector(false);
    }
  }, [songId]);

  // Encontrar linha ativa baseada no tempo atual
  const getActiveLyric = () => {
    if (lyrics.length === 0) return null;
    
    let activeIndex = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        activeIndex = i;
        break;
      }
    }
    
    if (activeIndex >= 0) {
      return { lyric: lyrics[activeIndex], index: activeIndex };
    }
    return null;
  };


  // Função para avançar para o próximo trecho
  const goToNextLyric = () => {
    if (lyrics.length === 0) {
      return;
    }

    const activeLyricData = getActiveLyric();
    let nextIndex = -1;

    if (activeLyricData) {
      const activeIndex = activeLyricData.index;
      
      // Se encontrou e não é a última, avançar para a próxima
      if (activeIndex >= 0 && activeIndex < lyrics.length - 1) {
        nextIndex = activeIndex + 1;
      } else {
        // Se já está na última, não fazer nada
        return;
      }
    } else {
      // Se não há letra ativa, ir para a primeira
      nextIndex = 0;
    }

    if (nextIndex >= 0 && nextIndex < lyrics.length) {
      const nextLyric = lyrics[nextIndex];
      
      // Fazer seek para o tempo do próximo trecho
      seek(nextLyric.time);
    }
  };

  // Função para voltar para o trecho anterior
  const goToPreviousLyric = () => {
    if (lyrics.length === 0) {
      return;
    }

    const activeLyricData = getActiveLyric();
    let previousIndex = -1;

    if (activeLyricData) {
      const activeIndex = activeLyricData.index;
      
      // Se encontrou e não é a primeira, voltar para a anterior
      if (activeIndex > 0) {
        previousIndex = activeIndex - 1;
      } else {
        // Se já está na primeira, não fazer nada
        return;
      }
    } else {
      // Se não há letra ativa, ir para a primeira
      previousIndex = 0;
    }

    if (previousIndex >= 0 && previousIndex < lyrics.length) {
      const previousLyric = lyrics[previousIndex];
      
      // Fazer seek para o tempo do trecho anterior
      seek(previousLyric.time);
    }
  };



  // Função para iniciar reprodução com contagem regressiva
  const handlePlayWithCountdown = async () => {
    if (countdown !== null) return; // Já está em contagem
    
    // A gravação será iniciada automaticamente pelo AudioRecorder quando a música começar
    // Não precisamos chamar startRecording aqui para evitar conflito
    
    // Iniciar contagem regressiva
    setCountdown(3);
    
    let currentCount = 3;
    countdownIntervalRef.current = setInterval(() => {
      currentCount--;
      if (currentCount > 0) {
        setCountdown(currentCount);
      } else {
        // Contagem terminou, iniciar reprodução
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdown(null);
        play();
      }
    }, 1000);
  };

  // Função para pausar (cancelar contagem e parar captura)
  const handlePause = async () => {
    // Cancelar contagem se estiver rodando
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
      setCountdown(null);
    }
    
    // Pausar música (a gravação é gerenciada pelo AudioRecorder)
    pause();
  };

  // Limpar intervalo de contagem ao desmontar
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Se não houver música selecionada, mostrar o modal de seleção
  if (!songId || !isReady) {
    return (
      <div className="karaoke-view">
        <MusicAnimation />
        <div className="karaoke-view-empty">
          <i className="fas fa-music"></i>
          <p>Mostre o seu talento</p>
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
      {/* Vídeo como background */}
      {hasVideo && songId && (
        <video
          ref={videoRef}
          src={`${API_CONFIG.BASE_URL}/api/video?song=${songId}`}
          className="karaoke-video-background"
          onTimeUpdate={handleVideoSeek}
          onLoadedMetadata={() => {
            const video = videoRef.current;
            if (video) {
              video.muted = true; // Garantir que está muted
              video.currentTime = currentTime;
            }
          }}
          playsInline
          muted={true}
        />
      )}
      
      {/* Holofotes no topo disparando luzes */}
      <StageLights isPlaying={isPlaying} variant="top" />
      
      {/* Holofotes sobre o vídeo */}
      <StageLights isPlaying={isPlaying} variant="video" />

      {/* Caixas de som nas extremidades */}
      <div className="speaker speaker-left">
        <div className="speaker-body">
          <div className={`speaker-cone ${isPlaying ? 'speaker-cone-active' : ''}`}>
            {isPlaying && <div className="speaker-cone-center"></div>}
          </div>
          <div className={`speaker-cone speaker-cone-small ${isPlaying ? 'speaker-cone-active' : ''}`}></div>
        </div>
      </div>
      <div className="speaker speaker-right">
        <div className="speaker-body">
          <div className={`speaker-cone ${isPlaying ? 'speaker-cone-active' : ''}`}>
            {isPlaying && <div className="speaker-cone-center"></div>}
          </div>
          <div className={`speaker-cone speaker-cone-small ${isPlaying ? 'speaker-cone-active' : ''}`}></div>
        </div>
      </div>

      {/* Contagem regressiva */}
      {countdown !== null && (
        <div className="countdown-overlay">
          <div className="countdown-number">{countdown}</div>
        </div>
      )}
      {/* Controles superiores */}
      <div className="karaoke-controls">
        <button
          className="karaoke-play-btn"
          onClick={isPlaying ? handlePause : handlePlayWithCountdown}
          title={isPlaying ? 'Pausar' : 'Reproduzir'}
          disabled={countdown !== null}
        >
          {isPlaying ? (
            <i className="fas fa-pause"></i>
          ) : (
            <i className="fas fa-play"></i>
          )}
        </button>
        {currentTime > 0 && (
          <button
            className="karaoke-restart-btn"
            onClick={() => {
              seek(0);
            }}
            title="Reiniciar música"
          >
            <i className="fas fa-redo"></i>
          </button>
        )}
        <button
          className="karaoke-back-btn"
          onClick={goToPreviousLyric}
          title="Voltar para o trecho anterior"
        >
          <i className="fas fa-backward"></i>
        </button>
        {/* Botão de microfone desabilitado - gravação automática via AudioRecorder */}
        <button
          className="karaoke-mic-btn"
          disabled
          title="Gravação automática ativa (gerenciada pelo sistema)"
          style={{ opacity: 0.5, cursor: 'not-allowed' }}
        >
          <i className="fas fa-microphone"></i>
        </button>
        <button
          className="karaoke-test-btn"
          onClick={goToNextLyric}
          title="Avançar para o próximo trecho"
        >
          <i className="fas fa-forward"></i>
        </button>
        <button
          className="karaoke-settings-btn"
          onClick={onSettingsClick}
          title="Configurações"
        >
          <i className="fas fa-cog"></i>
        </button>
      </div>

      {/* Área de letras */}
      <div className="karaoke-lyrics-area">
        <StageLights isPlaying={isPlaying} variant="lyrics" />
        <FallingMusicSymbols isPlaying={isPlaying} />
        <LyricsDisplay
          lyrics={lyrics}
          currentTime={currentTime}
          songId={songId}
          allowEdit={false}
          showUpcomingLines={true}
          onLyricsUpdate={(updatedLyrics) => {
            setLyrics(updatedLyrics);
          }}
        />
      </div>

      {/* Barra de progresso no bottom */}
      {songDuration > 0 && (
        <div className="karaoke-progress-container">
          <div className="karaoke-progress-bar">
            <div
              className="karaoke-progress-filled"
              style={{ width: `${Math.min((Math.min(currentTime, songDuration) / songDuration) * 100, 100)}%` }}
            />
          </div>
          <input
            type="range"
            min="0"
            max={songDuration}
            value={Math.min(currentTime, songDuration)}
            onChange={(e) => {
              const newTime = parseFloat(e.target.value);
              seek(Math.min(newTime, songDuration));
            }}
            className="karaoke-progress-slider"
            step="0.1"
          />
        </div>
      )}

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
          onDurationChange={(duration) => {
            // Atualizar duração real do áudio quando disponível
            if (duration > 0 && isFinite(duration)) {
              setSongDuration(duration);
            }
          }}
        />
      </div>

    </div>
  );
}

