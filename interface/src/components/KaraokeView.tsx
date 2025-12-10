import { useEffect, useState, useRef } from 'react';
import LyricsDisplay from './LyricsDisplay';
import { useSyncWebSocket } from '../hooks/useSyncWebSocket';
import AudioPlayer from './AudioPlayer';
import SongSelectorModal from './SongSelectorModal';
import MusicAnimation from './MusicAnimation';
import StageLights from './StageLights';
import { AudioMode, SpeechRecognition, SpeechRecognitionEvent, LyricsLine, WordMatchResult, LyricResult, PlayerScore, SongScore, SyncMessage } from '../types/index.js';
import { songsService } from '../services/songsService.js';
import { lyricsService } from '../services/lyricsService.js';
import { scoresService } from '../services/scoresService.js';
import { normalizeText, countCorrectWords } from '../utils/textUtils.js';
import { formatNumber, formatTime } from '../utils/formatters.js';
import { WEBSOCKET_CONFIG } from '../config/index.js';
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
  instrumentalVolume,
  onGameOver
}: KaraokeViewProps) {
  const [lyrics, setLyrics] = useState<LyricsLine[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [showSongSelector, setShowSongSelector] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentTime, isPlaying, play, pause, seek } = useSyncWebSocket();
  
  // Estados para captura de áudio
  const [isRecording, setIsRecording] = useState(false);
  const [recordedText, setRecordedText] = useState<string>('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef<boolean>(false);
  const fullTranscriptRef = useRef<string>('');
  const previousActiveIndexRef = useRef<number>(-1);
  const previousLyricTextRef = useRef<string>('');
  const resultsHistoryRef = useRef<LyricResult[]>([]);
  const [playerScore, setPlayerScore] = useState<PlayerScore>({ total: 0, average: 0, count: 0, points: 0 });
  const [maxPossiblePoints, setMaxPossiblePoints] = useState<number>(0);
  const [scoreAnimation, setScoreAnimation] = useState<'none' | 'increase' | 'celebration'>('none');
  const previousAverageRef = useRef<number>(0);
  const previousPointsRef = useRef<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string>(Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9));
  const [songDuration, setSongDuration] = useState<number>(0);
  const hasShownGameOverRef = useRef<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onGameOverRef = useRef(onGameOver);
  const pauseRef = useRef(pause);
  const playerScoreRef = useRef<PlayerScore>(playerScore);
  const maxPossiblePointsRef = useRef<number>(maxPossiblePoints);

  // Atualizar refs quando as funções e valores mudarem
  useEffect(() => {
    onGameOverRef.current = onGameOver;
    pauseRef.current = pause;
    playerScoreRef.current = playerScore;
    maxPossiblePointsRef.current = maxPossiblePoints;
  }, [onGameOver, pause, playerScore, maxPossiblePoints]);

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
          
          // Parar música e chamar onGameOver com pontuação atual
          pauseRef.current();
          if (onGameOverRef.current) {
            // Buscar informações do usuário
            (async () => {
              let userName: string | undefined;
              let userPhoto: string | undefined;
              try {
                const userInfo = await scoresService.getUserInfo(sessionIdRef.current);
                if (userInfo) {
                  userName = userInfo.userName;
                  userPhoto = userInfo.userPhoto;
                }
              } catch (error) {
                // Ignorar erros ao buscar informações do usuário
              }
              
              // Usar valores atuais via refs
              setTimeout(() => {
                onGameOverRef.current?.(playerScoreRef.current, maxPossiblePointsRef.current, userName, userPhoto);
              }, 300);
            })();
          }
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
      
      // Calcular pontuação máxima possível (todas as palavras de todos os trechos)
      const totalWords = lyrics.reduce((sum, lyric) => {
        const words = normalizeText(lyric.text).split(/\s+/).filter(w => w.length > 0);
        return sum + words.length;
      }, 0);
      
      // Cada palavra vale 100 pontos
      const maxPoints = totalWords * 100;
      setMaxPossiblePoints(maxPoints);
      
      // Se não tiver duração da música, estimar pela última letra (será sobrescrita pela duração real do áudio quando disponível)
      if (songDuration === 0 && lyrics.length > 0) {
        const lastLyric = lyrics[lyrics.length - 1];
        // Estimar duração: tempo da última letra + 5 segundos
        setSongDuration(lastLyric.time + 5);
      }
      
      // Resetar flag de game over quando mudar de música
      hasShownGameOverRef.current = false;
      
      // Carregar pontuação salva do backend
      loadScoreFromBackend();
    }
  }, [lyrics, songId]);
  
  // Função para carregar pontuação do backend
  const loadScoreFromBackend = async () => {
    if (!songId) return;
    
    try {
      const savedScore = await scoresService.getScore(songId, sessionIdRef.current);
      if (savedScore) {
        resultsHistoryRef.current = savedScore.results;
        setPlayerScore(savedScore.score);
        setMaxPossiblePoints(savedScore.maxPossiblePoints);
        previousAverageRef.current = savedScore.score.average;
        previousPointsRef.current = savedScore.score.points;
      } else {
        // Resetar se não houver pontuação salva
        resultsHistoryRef.current = [];
        setPlayerScore({ total: 0, average: 0, count: 0, points: 0 });
        previousAverageRef.current = 0;
        previousPointsRef.current = 0;
      }
    } catch (error) {
      console.error('Error loading score from backend:', error);
      // Continuar sem pontuação salva
      resultsHistoryRef.current = [];
      setPlayerScore({ total: 0, average: 0, count: 0, points: 0 });
    }
  };

  // Limitar currentTime para não ultrapassar a duração
  useEffect(() => {
    if (songDuration > 0 && currentTime > songDuration && isPlaying) {
      // Se o tempo ultrapassou a duração, fazer seek para a duração e pausar
      seek(songDuration);
      pause();
    }
  }, [currentTime, songDuration, isPlaying, seek, pause]);

  // Detectar fim da música e redirecionar para tela de resultados
  useEffect(() => {
    if (songDuration > 0 && currentTime >= songDuration - 0.5 && !hasShownGameOverRef.current && isPlaying) {
      // Música terminou
      hasShownGameOverRef.current = true;
      
      // Parar gravação se estiver gravando (antes de pausar)
      if (isRecording) {
        stopRecording().then(async () => {
          // Após parar gravação, pausar música e redirecionar
          pause();
          
          // Buscar informações do usuário
          let userName: string | undefined;
          let userPhoto: string | undefined;
          try {
            console.log('Buscando informações do usuário para sessionId:', sessionIdRef.current);
            const userInfo = await scoresService.getUserInfo(sessionIdRef.current);
            console.log('Informações do usuário recebidas:', userInfo);
            if (userInfo) {
              userName = userInfo.userName;
              userPhoto = userInfo.userPhoto;
              console.log('userName:', userName, 'userPhoto:', userPhoto);
            }
          } catch (error) {
            console.error('Erro ao buscar informações do usuário:', error);
          }
          
          setTimeout(() => {
            if (onGameOver) {
              onGameOver(playerScore, maxPossiblePoints, userName, userPhoto);
            }
          }, 500);
        }).catch(async () => {
          // Se houver erro ao parar gravação, continuar mesmo assim
          pause();
          
          // Buscar informações do usuário
          let userName: string | undefined;
          let userPhoto: string | undefined;
          try {
            console.log('Buscando informações do usuário para sessionId:', sessionIdRef.current);
            const userInfo = await scoresService.getUserInfo(sessionIdRef.current);
            console.log('Informações do usuário recebidas:', userInfo);
            if (userInfo) {
              userName = userInfo.userName;
              userPhoto = userInfo.userPhoto;
              console.log('userName:', userName, 'userPhoto:', userPhoto);
            }
          } catch (error) {
            console.error('Erro ao buscar informações do usuário:', error);
          }
          
          setTimeout(() => {
            if (onGameOver) {
              onGameOver(playerScore, maxPossiblePoints, userName, userPhoto);
            }
          }, 500);
        });
      } else {
        // Se não estiver gravando, apenas pausar e redirecionar
        pause();
        
        // Buscar informações do usuário
        (async () => {
          let userName: string | undefined;
          let userPhoto: string | undefined;
          try {
            const userInfo = await scoresService.getUserInfo(sessionIdRef.current);
            if (userInfo) {
              userName = userInfo.userName;
              userPhoto = userInfo.userPhoto;
            }
          } catch (error) {
            // Ignorar erros ao buscar informações do usuário
          }
          
          setTimeout(() => {
            if (onGameOver) {
              onGameOver(playerScore, maxPossiblePoints, userName, userPhoto);
            }
          }, 500);
        })();
      }
    }
  }, [currentTime, songDuration, isPlaying, isRecording, pause, playerScore, maxPossiblePoints, onGameOver]);

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

  // Detectar mudança de trecho e analisar automaticamente
  useEffect(() => {
    const handleUpdate = async () => {
      if (!isRecording || lyrics.length === 0) {
        previousActiveIndexRef.current = -1;
        return;
      }

      const activeLyricData = getActiveLyric();
      const currentActiveIndex = activeLyricData ? activeLyricData.index : -1;
      const previousActiveIndex = previousActiveIndexRef.current;

      // Se o trecho mudou e havia um trecho anterior
      if (previousActiveIndex >= 0 && currentActiveIndex !== previousActiveIndex) {
        const previousLyricText = previousLyricTextRef.current;
        const currentCapturedText = fullTranscriptRef.current.trim() || recordedText;

        // Se havia texto capturado do trecho anterior, analisar
        if (currentCapturedText && previousLyricText) {
          const result = countCorrectWords(previousLyricText, currentCapturedText);
          
          // Contar palavras totais no trecho
          const totalWords = normalizeText(previousLyricText).split(/\s+/).filter(w => w.length > 0).length;
          
          // Adicionar ao histórico de resultados
          const newResult: LyricResult = {
            lyric: previousLyricText,
            score: result.correct,
            percentage: result.percentage,
            totalWords: totalWords
          };
          
          resultsHistoryRef.current.push(newResult);

          // Salvar resultado individual no backend
          if (songId) {
            try {
              await scoresService.addResult(songId, newResult, maxPossiblePoints, sessionIdRef.current);
            } catch (error) {
              console.error('Error saving result to backend:', error);
            }
          }

          // Atualizar pontuação do jogador
          await updatePlayerScore();

          // Limpar o texto capturado para o novo trecho
          fullTranscriptRef.current = '';
          setRecordedText('');
        }
      }

      // Atualizar referências para o próximo ciclo
      if (activeLyricData) {
        previousActiveIndexRef.current = activeLyricData.index;
        previousLyricTextRef.current = activeLyricData.lyric.text;
      } else {
        previousActiveIndexRef.current = -1;
        previousLyricTextRef.current = '';
      }
    };
    
    handleUpdate();
  }, [currentTime, lyrics, isRecording, recordedText, songId, maxPossiblePoints]);

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

  // Função para calcular e atualizar a pontuação do jogador (acumulada)
  const updatePlayerScore = async () => {
    const history = resultsHistoryRef.current;
    
    if (history.length === 0) {
      setPlayerScore({ total: 0, average: 0, count: 0, points: 0 });
      previousAverageRef.current = 0;
      previousPointsRef.current = 0;
      
      // Salvar pontuação vazia no backend
      if (songId) {
        try {
          await scoresService.saveScore(songId, [], maxPossiblePoints, sessionIdRef.current);
        } catch (error) {
          console.error('Error saving score to backend:', error);
        }
      }
      return;
    }

    // Calcular pontos acumulados: cada palavra acertada vale 100 pontos
    // Cada trecho pode dar até (número de palavras × 100) pontos
    const totalPoints = history.reduce((sum, result) => {
      // Cada palavra acertada vale 100 pontos
      const trechoPoints = result.score * 100;
      return sum + trechoPoints;
    }, 0);

    // Calcular média para referência (não exibida)
    const totalPercentage = history.reduce((sum, result) => sum + result.percentage, 0);
    const average = Math.round(totalPercentage / history.length);

    // Verificar se a pontuação aumentou para animação
    const previousPoints = previousPointsRef.current;
    if (totalPoints > previousPoints) {
      // Calcular média atual para verificar se atingiu 90%+
      if (average >= 90) {
        setScoreAnimation('celebration');
      } else {
        setScoreAnimation('increase');
      }
      
      // Resetar animação após um tempo
      setTimeout(() => {
        setScoreAnimation('none');
      }, 1500);
    }

    previousAverageRef.current = average;
    previousPointsRef.current = totalPoints;

    const newScore: PlayerScore = {
      total: totalPercentage,
      average,
      count: history.length,
      points: totalPoints
    };
    
    setPlayerScore(newScore);
    
    // Salvar pontuação no backend
    if (songId) {
      try {
        await scoresService.saveScore(songId, history, maxPossiblePoints, sessionIdRef.current);
      } catch (error) {
        console.error('Error saving score to backend:', error);
      }
    }
  };

  // countCorrectWords is now imported from utils

  // Iniciar captura de áudio
  const startRecording = async () => {
    try {
      // Solicitar permissão do microfone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      // Inicializar MediaRecorder para backup (caso SpeechRecognition não funcione)
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start();
      
      // Tentar usar Web Speech API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true; // Ativar resultados intermediários para atualização em tempo real
        recognition.lang = 'pt-BR';
        
        fullTranscriptRef.current = '';
        
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          // Processar resultados de forma mais eficiente para reduzir delay
          let interimText = '';
          
          // Processar apenas os novos resultados (a partir do resultIndex) para melhor performance
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            const isFinal = event.results[i].isFinal;
            
            if (isFinal) {
              // Texto final - adicionar ao texto permanente
              fullTranscriptRef.current += transcript + ' ';
            } else {
              // Texto intermediário - usar diretamente para atualização em tempo real
              interimText = transcript;
            }
          }
          
          // Combinar texto permanente com o intermediário atual de forma otimizada
          const currentText = fullTranscriptRef.current.trim() + (interimText ? ' ' + interimText : '');
          
          // Atualizar estado imediatamente (sem delay adicional)
          setRecordedText(currentText);
        };
        
        recognition.onerror = () => {
          // Erro silencioso
        };
        
        recognition.onend = () => {
          if (isRecordingRef.current) {
            // Se ainda está gravando, reiniciar
            try {
              recognition.start();
            } catch (err) {
              // Erro silencioso
            }
          }
        };
        
        recognition.start();
        recognitionRef.current = recognition;
      }
      
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordedText('');
      fullTranscriptRef.current = '';
      previousActiveIndexRef.current = -1;
      previousLyricTextRef.current = '';
      
      // Criar nova sessão ao iniciar gravação
      sessionIdRef.current = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
      resultsHistoryRef.current = [];
      setPlayerScore({ total: 0, average: 0, count: 0, points: 0 });
      previousAverageRef.current = 0;
      previousPointsRef.current = 0;
      setScoreAnimation('none');
      
      // Salvar pontuação inicial no backend
      if (songId) {
        try {
          await scoresService.saveScore(songId, [], maxPossiblePoints, sessionIdRef.current);
        } catch (error) {
          console.error('Error initializing score in backend:', error);
        }
      }
      
    } catch (error) {
      alert('Erro ao acessar o microfone. Verifique as permissões.');
    }
  };

  // Parar captura de áudio e analisar
  const stopRecording = async () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    
    // Parar MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Parar reconhecimento de voz
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // Erro silencioso
      }
      recognitionRef.current = null;
    }
    
    // Parar stream de áudio
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      audioStreamRef.current = null;
    }
    
    // Aguardar um pouco para garantir que o texto foi processado
    // Usar o texto completo da ref
    setTimeout(async () => {
      const finalText = fullTranscriptRef.current.trim() || recordedText;
      await analyzeRecording(finalText);
    }, 500);
  };

  // Analisar gravação (usado quando para manualmente)
  const analyzeRecording = async (capturedText: string) => {
    const activeLyricData = getActiveLyric();
    
    if (!activeLyricData) {
      alert('Nenhuma letra ativa no momento. Selecione uma música e aguarde o trecho.');
      return;
    }
    
    const activeLyric = activeLyricData.lyric;
    
    if (!capturedText || capturedText.trim() === '') {
      return;
    }
    
    const result = countCorrectWords(activeLyric.text, capturedText);
    
    // Contar palavras totais no trecho
    const totalWords = normalizeText(activeLyric.text).split(/\s+/).filter(w => w.length > 0).length;
    
    // Adicionar ao histórico
    const newResult: LyricResult = {
      lyric: activeLyric.text,
      score: result.correct,
      percentage: result.percentage,
      totalWords: totalWords
    };
    
    resultsHistoryRef.current.push(newResult);
    
    // Salvar resultado no backend
    if (songId) {
      try {
        await scoresService.addResult(songId, newResult, maxPossiblePoints, sessionIdRef.current);
      } catch (error) {
        console.error('Error saving result to backend:', error);
      }
    }
    
    // Atualizar pontuação do jogador
    await updatePlayerScore();
    
    // Mostrar resumo de todos os trechos analisados
    const historySummary = resultsHistoryRef.current
      .map((r, idx) => `${idx + 1}. ${r.percentage}% (${r.score} palavras)`)
      .join('\n');
    
    alert(
      `Análise do trecho:\n\n` +
      `Trecho esperado: "${activeLyric.text}"\n` +
      `Texto capturado: "${capturedText}"\n\n` +
      `Palavras acertadas: ${result.correct} de ${result.total}\n` +
      `Porcentagem: ${result.percentage}%\n\n` +
      (resultsHistoryRef.current.length > 1 ? `Histórico:\n${historySummary}` : '')
    );
    
    // Limpar texto capturado
    setRecordedText('');
    fullTranscriptRef.current = '';
  };

  // Função para iniciar reprodução com contagem regressiva
  const handlePlayWithCountdown = async () => {
    if (countdown !== null) return; // Já está em contagem
    
    // Preparar captura em paralelo (não esperar, apenas iniciar)
    startRecording().catch(() => {
      // Se falhar, continuar mesmo assim
    });
    
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
    
    // Parar captura se estiver gravando
    if (isRecording) {
      await stopRecording();
    }
    
    // Pausar música
    pause();
  };

  // Limpar intervalo de contagem ao desmontar
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          // Erro silencioso
        }
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
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
          src={`/api/video?song=${songId}`}
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
        {/* Pontuação do jogador */}
        <div className={`karaoke-score-display ${scoreAnimation !== 'none' ? `score-${scoreAnimation}` : ''}`}>
          <div className="score-max-points">
            Máximo: {maxPossiblePoints.toLocaleString('pt-BR')}
          </div>
          <div className="score-label">Pontuação</div>
          <div className="score-value">
            <span className={`score-average ${scoreAnimation !== 'none' ? 'score-pulse' : ''}`}>
              {formatNumber(playerScore.points)}
            </span>
            <span className="score-details">
              {playerScore.count > 0 && `${playerScore.count} trecho${playerScore.count !== 1 ? 's' : ''}`}
            </span>
          </div>
          {scoreAnimation === 'celebration' && (
            <div className="score-celebration">
              <span className="celebration-text">🎉 Excelente!</span>
            </div>
          )}
        </div>
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
        <button
          className={`karaoke-mic-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? 'Parar captura e analisar' : 'Iniciar captura de áudio'}
        >
          {isRecording ? (
            <i className="fas fa-pause"></i>
          ) : (
            <i className="fas fa-microphone"></i>
          )}
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
        <LyricsDisplay
          lyrics={lyrics}
          currentTime={currentTime}
          songId={songId}
          capturedText={recordedText}
          isRecording={isRecording}
          allowEdit={false}
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

