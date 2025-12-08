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

        // Dados mockados para teste (sempre adicionar alguns para preencher o grid)
        const mockUsers: User[] = [
          { name: 'Ana Silva', phone: 'mock-11111111111', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Carlos Santos', phone: 'mock-22222222222', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Maria Oliveira', phone: 'mock-33333333333', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'João Pereira', phone: 'mock-44444444444', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Julia Costa', phone: 'mock-55555555555', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Pedro Alves', phone: 'mock-66666666666', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Lucas Ferreira', phone: 'mock-77777777777', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Beatriz Lima', phone: 'mock-88888888888', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Rafael Souza', phone: 'mock-99999999999', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Fernanda Costa', phone: 'mock-10101010101', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Gabriel Martins', phone: 'mock-12121212121', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Camila Rodrigues', phone: 'mock-13131313131', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Rodrigo Almeida', phone: 'mock-14141414141', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Isabella Santos', phone: 'mock-15151515151', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Thiago Silva', phone: 'mock-16161616161', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Mariana Costa', phone: 'mock-17171717171', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Bruno Oliveira', phone: 'mock-18181818181', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Larissa Santos', phone: 'mock-19191919191', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Diego Pereira', phone: 'mock-20202020202', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Patricia Alves', phone: 'mock-21212121212', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'André Ferreira', phone: 'mock-23232323232', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Vanessa Lima', phone: 'mock-24242424242', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Ricardo Souza', phone: 'mock-25252525252', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Tatiana Costa', phone: 'mock-26262626262', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Felipe Martins', phone: 'mock-27272727272', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Juliana Rodrigues', phone: 'mock-28282828282', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Gustavo Almeida', phone: 'mock-29292929292', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Carolina Santos', phone: 'mock-30303030303', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Vinícius Silva', phone: 'mock-31313131313', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
          { name: 'Amanda Costa', phone: 'mock-32323232323', photo: null, createdAt: new Date().toISOString(), lastPlayedAt: new Date().toISOString() },
        ];

        // Combinar usuários reais com mockados (sempre incluir mocks para preencher)
        const allUsers = [...usersData, ...mockUsers];
        setUsers(allUsers);
        
        // Animar fotos aparecendo uma por vez de forma aleatória automaticamente
        // Resetar e começar animação do zero
        setTimeout(() => {
          const shuffled = [...allUsers].sort(() => Math.random() - 0.5);
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
    const ws = new WebSocket(wsUrl);

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
            // Recarregar usuários quando um novo nome é submetido
            usersService.getAll().then(setUsers).catch(console.error);
          } else if (message.type === 'qrcodeSongSelected' && message.songId) {
            console.log('🎵 QR code song selected:', message.songId, 'by', message.userName);
            onSelectSong(message.songId);
            ws.close();
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
      console.log('🔌 WebSocket disconnected for QR code');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
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
    // Caso contrário, adicionar o caminho base
    return `/music/${photo}`;
  };

  return (
    <div className="home-screen">
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
          
          {/* QR Code abaixo do ranking */}
          <div className="ranking-qr-section">
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
                          onError={(e) => {
                            // Fallback para ícone se foto não carregar
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<div class="player-icon"><i class="fas fa-user"></i></div>`;
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