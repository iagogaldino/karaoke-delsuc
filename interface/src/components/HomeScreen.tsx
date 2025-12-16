import { useState, useEffect } from 'react';
import { qrcodeService } from '../services/qrcodeService.js';
import { rankingService, RankingEntry } from '../services/rankingService.js';
import { usersService, User } from '../services/usersService.js';
import { SyncMessage } from '../types/index.js';
import { WEBSOCKET_CONFIG } from '../config/index.js';
import SongSelectorModal from './SongSelectorModal';
import './HomeScreen.css';

interface HomeScreenProps {
  onSelectSong: (songId: string) => void;
  onSettingsClick?: () => void;
}

export default function HomeScreen({ onSelectSong, onSettingsClick }: HomeScreenProps) {
  const [showSongSelector, setShowSongSelector] = useState(false);
  const [isQrScanned, setIsQrScanned] = useState(false);
  const [qrId, setQrId] = useState<string>('');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [qrUrl, setQrUrl] = useState<string>('');
  const [isLoadingQr, setIsLoadingQr] = useState(true);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [emptySlotsCount, setEmptySlotsCount] = useState(50);
  const [visiblePhotos, setVisiblePhotos] = useState<Set<string>>(new Set());
  const [isUserSelectingSong, setIsUserSelectingSong] = useState(false);
  const [selectingUserName, setSelectingUserName] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(240); // 4 minutos em segundos
  const [selectionStartTime, setSelectionStartTime] = useState<number | null>(null);

  // Buscar QR code do backend
  useEffect(() => {
    const fetchQrCode = async () => {
      try {
        setIsLoadingQr(true);
        const response = await qrcodeService.generate();
        setQrId(response.qrId);
        setQrSvg(response.qrSvg);
        setQrUrl(response.url);
      } catch (error: any) {
        console.error('Erro ao gerar QR code:', error);
        const errorMessage = error?.message || 'Erro desconhecido';
        alert(`Erro ao gerar QR code: ${errorMessage}\n\nVerifique se o servidor backend está rodando.`);
      } finally {
        setIsLoadingQr(false);
      }
    };
    fetchQrCode();
  }, []);

  // Verificar periodicamente o status do QR code para detectar quando alguém está escolhendo música
  useEffect(() => {
    if (!qrId) return;

    const checkQRCodeStatus = async () => {
      try {
        const status = await qrcodeService.getStatus(qrId) as any;
        // Se nome foi submetido mas música ainda não foi selecionada, alguém está escolhendo
        if (status.nameSubmitted && !status.songSelected && status.userName) {
          setIsUserSelectingSong(true);
          setSelectingUserName(status.userName);
          
          // Calcular tempo restante baseado no nameSubmittedAt
          // Tempo máximo: 4 minutos (240 segundos) desde que o nome foi submetido
          const startTime = status.nameSubmittedAt || status.createdAt;
          const elapsed = (Date.now() - startTime) / 1000;
          const remaining = Math.max(0, 240 - elapsed);
          setTimeRemaining(Math.floor(remaining));
          
          // Se tempo expirou, resetar estado
          if (remaining <= 0) {
            setIsUserSelectingSong(false);
            setSelectingUserName('');
            setTimeRemaining(240);
            setSelectionStartTime(null);
          } else if (selectionStartTime === null) {
            setSelectionStartTime(startTime);
          }
        } else if (status.songSelected) {
          // Se música foi selecionada, parar de mostrar mensagem
          setIsUserSelectingSong(false);
          setSelectingUserName('');
          setTimeRemaining(240);
          setSelectionStartTime(null);
        } else {
          // Se não há nome submetido, mostrar QR code normalmente
          setIsUserSelectingSong(false);
          setSelectingUserName('');
          setTimeRemaining(240);
          setSelectionStartTime(null);
        }
      } catch (error) {
        console.error('Erro ao verificar status do QR code:', error);
      }
    };

    // Verificar imediatamente
    checkQRCodeStatus();

    // Verificar a cada 2 segundos
    const interval = setInterval(checkQRCodeStatus, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrId]);

  // Timer regressivo quando alguém está escolhendo música
  useEffect(() => {
    if (!isUserSelectingSong || timeRemaining <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          // Tempo esgotado - resetar estado
          setIsUserSelectingSong(false);
          setSelectingUserName('');
          setSelectionStartTime(null);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isUserSelectingSong, timeRemaining]);

  // Buscar ranking
  useEffect(() => {
    const fetchRanking = async () => {
      try {
        setIsLoadingRanking(true);
        const rankingData = await rankingService.getRanking();
        setRanking(rankingData);
      } catch (error) {
        console.error('Erro ao carregar ranking:', error);
      } finally {
        setIsLoadingRanking(false);
      }
    };
    fetchRanking();
    
    // Atualizar ranking a cada 10 segundos
    const interval = setInterval(fetchRanking, 10000);
    return () => clearInterval(interval);
  }, []);

  // Buscar usuários
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoadingUsers(true);
        setVisiblePhotos(new Set()); // Reset visibilidade
        
        let usersData: User[] = [];
        try {
          usersData = await usersService.getAll();
        } catch (error) {
          console.error('Erro ao carregar usuários:', error);
        }

        // Usar apenas dados reais dos usuários que já jogaram
        setUsers(usersData);
        
        // Animar fotos aparecendo uma por vez de forma aleatória automaticamente
        // Resetar e começar animação do zero
        setTimeout(() => {
          const shuffled = [...usersData].sort(() => Math.random() - 0.5);
          shuffled.forEach((user, index) => {
            setTimeout(() => {
              setVisiblePhotos(prev => {
                const newSet = new Set(prev);
                newSet.add(user.phone);
                return newSet;
              });
            }, index * 60 + Math.random() * 120); // Delay aleatório entre 60-180ms para efeito mais dinâmico
          });
        }, 300); // Pequeno delay inicial para garantir que o DOM está pronto
      } catch (error) {
        console.error('Erro ao processar usuários:', error);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    
    // Executar imediatamente ao carregar
    fetchUsers();
    
    // Atualizar usuários a cada 15 segundos
    const interval = setInterval(fetchUsers, 15000);
    return () => clearInterval(interval);
  }, []);

  // Calcular quantos espaços vazios são necessários para preencher a tela
  useEffect(() => {
    const calculateEmptySlots = () => {
      // Estimar baseado no tamanho da tela
      // Assumindo aproximadamente 80px por item + gaps
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const itemSize = 80;
      const gap = 16;
      const padding = 32;
      
      const availableWidth = viewportWidth - padding * 2;
      const availableHeight = viewportHeight - padding * 2;
      
      const cols = Math.floor((availableWidth + gap) / (itemSize + gap));
      const rows = Math.floor((availableHeight + gap) / (itemSize + gap));
      
      const totalSlots = Math.max(cols * rows, 50); // Mínimo de 50 slots
      setEmptySlotsCount(totalSlots);
    };

    calculateEmptySlots();
    window.addEventListener('resize', calculateEmptySlots);
    return () => window.removeEventListener('resize', calculateEmptySlots);
  }, []);

  // Conectar ao WebSocket
  useEffect(() => {
    if (!qrId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${WEBSOCKET_CONFIG.PATH}`;
    
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected for QR code notifications');
      };

      ws.onmessage = (event) => {
        try {
          const message: SyncMessage = JSON.parse(event.data);
          
          if (message.qrId === qrId) {
            if (message.type === 'qrcodeNameSubmitted') {
              console.log('📝 QR code name submitted:', message.userName);
              setIsQrScanned(true);
              // Quando nome é submetido, usuário está escolhendo música
              setIsUserSelectingSong(true);
              setSelectingUserName(message.userName || '');
              setTimeRemaining(240); // Resetar timer para 4 minutos
              setSelectionStartTime(Date.now());
              // Recarregar usuários quando um novo nome é submetido
              usersService.getAll().then(setUsers).catch(console.error);
            } else if (message.type === 'qrcodeSongSelected' && message.songId) {
              console.log('🎵 QR code song selected:', message.songId, 'by', message.userName);
              // Quando música é selecionada, parar de mostrar mensagem
              setIsUserSelectingSong(false);
              setSelectingUserName('');
              setTimeRemaining(240);
              setSelectionStartTime(null);
              onSelectSong(message.songId);
              ws.close(1000, 'Song selected');
            } else if (message.type === 'qrcodeGiveUp') {
              // Quando usuário desiste, voltar a mostrar QR code
              setIsUserSelectingSong(false);
              setSelectingUserName('');
              setTimeRemaining(240);
              setSelectionStartTime(null);
            }
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
          console.log('🔌 WebSocket disconnected for QR code');
        }
      };

      return () => {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
          // Remover listeners para evitar logs desnecessários
          ws.onerror = null;
          ws.onclose = null;
          ws.close(1000, 'Component unmounting');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrId]);

  const getMedalIcon = (position: number) => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return position;
  };

  const getPositionClass = (position: number) => {
    if (position === 1) return 'rank-first';
    if (position === 2) return 'rank-second';
    if (position === 3) return 'rank-third';
    return '';
  };

  const getPhotoUrl = (photo?: string | null) => {
    if (!photo) return null;
    // Se já começar com http, retornar como está
    if (photo.startsWith('http')) return photo;
    // O backend salva como "users-photos/photo-xxx.jpg" e serve em /music/users-photos
    // Então o caminho completo é /music/users-photos/photo-xxx.jpg
    return `/music/${photo}`;
  };

  return (
    <div className="home-screen">
      {/* Luzes de fundo animadas */}
      <div className="background-lights">
        <div className="light light-1"></div>
        <div className="light light-2"></div>
        <div className="light light-3"></div>
        <div className="light light-4"></div>
        <div className="light light-5"></div>
      </div>

      {onSettingsClick && (
        <button
          className="home-settings-btn"
          onClick={onSettingsClick}
          title="Configurações"
        >
          <i className="fas fa-cog"></i>
        </button>
      )}
      
      <div className="home-container">
        {/* Ranking à esquerda */}
        <div className="home-ranking">
          <div className="ranking-header">
            <i className="fas fa-trophy"></i>
            <h2>Ranking de Jogadores</h2>
          </div>
          <div className="ranking-list">
            {isLoadingRanking ? (
              <div className="loading-message">Carregando ranking...</div>
            ) : ranking.length === 0 ? (
              <div className="empty-message">Nenhum jogador no ranking ainda</div>
            ) : (
              ranking.slice(0, 10).map((user) => (
                <div 
                  key={user.sessionId} 
                  className={`ranking-item ${getPositionClass(user.position)}`}
                >
                  <div className="ranking-position">
                    {getMedalIcon(user.position)}
                  </div>
                  <div className="ranking-info">
                    <div className="ranking-name">{user.name}</div>
                    <div className="ranking-stats">
                      <span className="ranking-score">
                        <i className="fas fa-star"></i>
                        {user.score.toLocaleString('pt-BR')} pts
                      </span>
                      <span className="ranking-best-song">
                        <i className="fas fa-music"></i>
                        {user.bestSong}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* QR Code abaixo do ranking ou mensagem de seleção */}
          <div className="ranking-qr-section">
            {isUserSelectingSong ? (
              <div className="user-selecting-message">
                <div className="selecting-icon">🎵</div>
                <div className="selecting-text">
                  <div className="selecting-label">Escolhendo música...</div>
                  <div className="selecting-name">{selectingUserName}</div>
                  <div className="selecting-timer">
                    <div className={`timer-value ${timeRemaining <= 30 ? 'timer-warning' : ''}`}>
                      {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="timer-label">Tempo restante</div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <label className="qr-label">Escaneie para participar</label>
                {isLoadingQr ? (
                  <div className="qr-loading-small">
                    <div className="loading-spinner-small"></div>
                  </div>
                ) : (
                  <div 
                    className="ranking-qr-svg"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Área central com grid de fotos e QR code */}
        <div className="home-main-content">
          {/* Grid de fotos dos jogadores */}
          <div className="players-grid">
            {isLoadingUsers ? (
              <div className="loading-message">Carregando jogadores...</div>
            ) : (
              <>
                {users.map((user, index) => {
                  const photoUrl = getPhotoUrl(user.photo);
                  const isVisible = visiblePhotos.has(user.phone);
                  return (
                    <div 
                      key={user.phone} 
                      className={`player-photo-item ${isVisible ? 'visible' : 'hidden'}`}
                    >
                      {photoUrl ? (
                        <img 
                          src={photoUrl} 
                          alt={user.name}
                          className="player-photo"
                          loading="lazy"
                          onError={(e) => {
                            // Fallback para ícone se foto não carregar
                            const target = e.target as HTMLImageElement;
                            const parent = target.parentElement;
                            if (parent) {
                              target.style.display = 'none';
                              if (!parent.querySelector('.player-icon')) {
                                const iconDiv = document.createElement('div');
                                iconDiv.className = 'player-icon';
                                iconDiv.innerHTML = '<i class="fas fa-user"></i>';
                                parent.appendChild(iconDiv);
                              }
                            }
                          }}
                        />
                      ) : (
                        <div className="player-icon">
                          <i className="fas fa-user"></i>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Espaços vazios para preencher o grid */}
                {Array.from({ length: Math.max(0, emptySlotsCount - users.length) }).map((_, index) => (
                  <div key={`empty-${index}`} className="player-photo-item empty-slot"></div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <SongSelectorModal
        isOpen={showSongSelector}
        onClose={() => setShowSongSelector(false)}
        onSelectSong={onSelectSong}
      />
    </div>
  );
}