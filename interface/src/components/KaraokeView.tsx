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
  const [videoFilename, setVideoFilename] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentTime, isPlaying, play, pause, seek } = useSyncWebSocket();
  
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [songDuration, setSongDuration] = useState<number>(0);
  const hasShownGameOverRef = useRef<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pauseRef = useRef(pause);
  const videoPlayStateRef = useRef<boolean>(false); // Para evitar chamadas desnecessárias

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
    
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
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
        // Só logar erro se não estiver fechando intencionalmente
        if (ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
          console.error('WebSocket error:', error);
        }
      };

      ws.onclose = (event) => {
        // Só logar desconexão se não foi intencional (código 1000)
        if (event.code !== 1000) {
          console.log('🔌 WebSocket disconnected for QR code give up');
        }
        wsRef.current = null;
      };

      return () => {
        if (wsRef.current) {
          const currentWs = wsRef.current;
          // Remover listeners para evitar logs desnecessários
          currentWs.onerror = null;
          currentWs.onclose = null;
          
          if (currentWs.readyState === WebSocket.OPEN || currentWs.readyState === WebSocket.CONNECTING) {
            currentWs.close(1000, 'Component unmounting');
          }
          wsRef.current = null;
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, []); // Sem dependências - executa apenas uma vez ao montar

  // Carregar letras e verificar vídeo quando a música mudar
  useEffect(() => {
    if (!songId) {
      setIsReady(false);
      setLyrics([]);
      setHasVideo(false);
      setVideoFilename(null);
      setSongDuration(0);
      hasShownGameOverRef.current = false;
      return;
    }

    setIsReady(false);
    setHasVideo(false);
    setVideoFilename(null);
    setSongDuration(0);
    hasShownGameOverRef.current = false;
    videoPlayStateRef.current = false; // Resetar estado do vídeo

    // Carregar informações da música para verificar se tem vídeo e obter duração
    songsService.getById(songId)
      .then(song => {
        if (song && song.files?.video) {
          setHasVideo(true);
          setVideoFilename(song.files.video);
        } else {
          setHasVideo(false);
          setVideoFilename(null);
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

  // Sincronizar apenas play/pause do vídeo com o áudio (otimizado)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasVideo) return;

    // Garantir que o vídeo está muted (sem áudio)
    video.muted = true;

    // Só sincronizar se o estado mudou (evitar chamadas desnecessárias)
    if (isPlaying && video.paused && !videoPlayStateRef.current) {
      videoPlayStateRef.current = true;
      video.play().catch(() => {
        videoPlayStateRef.current = false;
      });
    } else if (!isPlaying && !video.paused && videoPlayStateRef.current) {
      videoPlayStateRef.current = false;
      video.pause();
    }
  }, [isPlaying, hasVideo]);

  // normalizeText is now imported from utils

  // Abrir modal automaticamente quando não houver música selecionada
  useEffect(() => {
    if (!songId) {
      setShowSongSelector(true);
    } else {
      setShowSongSelector(false);
    }
  }, [songId]);

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
      {/* Vídeo em tela cheia */}
      {hasVideo && songId && videoFilename && (
        <div className="karaoke-video-container">
          <video
            ref={videoRef}
            src={`${API_CONFIG.BASE_URL}/music/${songId}/${videoFilename}`}
            className="karaoke-video-player"
            preload="auto"
            playsInline
            muted={true}
            disablePictureInPicture
            onLoadedMetadata={() => {
              const video = videoRef.current;
              if (video) {
                video.muted = true; // Garantir que está muted
                videoPlayStateRef.current = false; // Resetar estado
              }
            }}
            onPlay={() => {
              videoPlayStateRef.current = true;
            }}
            onPause={() => {
              videoPlayStateRef.current = false;
            }}
            onWaiting={() => {
              // Quando o vídeo está esperando buffer, não fazer nada
              // Isso evita travamentos
            }}
            onCanPlay={() => {
              // Vídeo pode reproduzir
            }}
          />
        </div>
      )}
      
      {/* Holofotes no topo disparando luzes */}
      <StageLights isPlaying={isPlaying} variant="top" />
      
      {/* Holofotes sobre o vídeo */}
      <StageLights isPlaying={isPlaying} variant="video" />

      {/* Caixas de som nas extremidades */}
      <div className="speaker speaker-left">
        <div className={`speaker-body ${isPlaying ? 'speaker-body-active' : ''}`}>
          {/* LEDs ao redor da caixa */}
          {isPlaying && (
            <>
              <div className="speaker-led speaker-led-top"></div>
              <div className="speaker-led speaker-led-bottom"></div>
            </>
          )}
          <div className={`speaker-cone ${isPlaying ? 'speaker-cone-active' : ''}`}>
            {isPlaying && (
              <>
                <div className="speaker-cone-center"></div>
                {/* LEDs dentro do cone principal */}
                <div className="speaker-cone-led speaker-cone-led-1"></div>
                <div className="speaker-cone-led speaker-cone-led-3"></div>
                <div className="speaker-cone-led speaker-cone-led-5"></div>
              </>
            )}
          </div>
          <div className={`speaker-cone speaker-cone-small ${isPlaying ? 'speaker-cone-active' : ''}`}>
            {isPlaying && (
              <>
                {/* LED no tweeter */}
                <div className="speaker-tweeter-led"></div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="speaker speaker-right">
        <div className={`speaker-body ${isPlaying ? 'speaker-body-active' : ''}`}>
          {/* LEDs ao redor da caixa */}
          {isPlaying && (
            <>
              <div className="speaker-led speaker-led-top"></div>
              <div className="speaker-led speaker-led-bottom"></div>
            </>
          )}
          <div className={`speaker-cone ${isPlaying ? 'speaker-cone-active' : ''}`}>
            {isPlaying && (
              <>
                <div className="speaker-cone-center"></div>
                {/* LEDs dentro do cone principal */}
                <div className="speaker-cone-led speaker-cone-led-1"></div>
                <div className="speaker-cone-led speaker-cone-led-3"></div>
                <div className="speaker-cone-led speaker-cone-led-5"></div>
              </>
            )}
          </div>
          <div className={`speaker-cone speaker-cone-small ${isPlaying ? 'speaker-cone-active' : ''}`}>
            {isPlaying && (
              <>
                {/* LED no tweeter */}
                <div className="speaker-tweeter-led"></div>
              </>
            )}
          </div>
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

