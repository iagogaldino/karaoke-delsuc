import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { randomBytes } from 'crypto';
import { SERVER_CONFIG } from '../config/index.js';
import { broadcastQRCodeName, broadcastQRCodeSong, broadcastQRCodeGiveUp } from '../websocket/sync.js';
import { getSongById, getAllSongs } from '../utils/database.js';
import { createOrUpdateUser, getUserByPhone } from '../utils/usersDatabase.js';
import { getLocalIP } from '../utils/networkUtils.js';

/**
 * Redireciona para o app Angular mobile
 */
function redirectToMobileApp(res: Response, path: string, qrId: string): void {
  const clientUrl = SERVER_CONFIG.CLIENT_MOBILE_URL;
  const redirectUrl = `${clientUrl}${path}/${qrId}`;
  console.log(`🔄 Redirecionando para: ${redirectUrl}`);
  console.log(`📱 CLIENT_MOBILE_URL configurado: ${clientUrl}`);
  res.redirect(redirectUrl);
}

// Importação dinâmica do módulo qrcode (CommonJS)
let QRCode: any = null;

// Função para garantir que o módulo está carregado
async function loadQRCode() {
  if (!QRCode) {
    try {
      QRCode = await import('qrcode');
    } catch (error) {
      console.error('Erro ao importar módulo qrcode:', error);
      throw new Error('Módulo qrcode não encontrado. Execute: npm install qrcode');
    }
  }
  return QRCode;
}

// Armazenamento temporário de códigos QR gerados (em produção, usar Redis ou banco de dados)
interface QRCodeData {
  code: string;
  url: string;
  createdAt: number;
  isValid: boolean;
  userName?: string;
  userPhone?: string;
  userPhoto?: string;
  nameSubmitted: boolean;
  nameSubmittedAt?: number; // Timestamp de quando o nome foi submetido
  songId?: string;
  songSelected: boolean;
  sessionId?: string; // Associar sessionId quando o jogo começar
  gaveUp?: boolean; // Marca se o usuário desistiu
}

const qrCodes = new Map<string, QRCodeData>();
// Mapeamento sessionId -> qrId para busca rápida
const sessionToQrMap = new Map<string, string>();

// Limpar códigos expirados a cada 5 minutos
const QR_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutos
const SONG_SELECTION_TIMEOUT = 4 * 60 * 1000; // 4 minutos para escolher música
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of qrCodes.entries()) {
    if (now - data.createdAt > QR_CODE_EXPIRY) {
      // Limpar mapeamento de sessionId também
      if (data.sessionId) {
        sessionToQrMap.delete(data.sessionId);
      }
      qrCodes.delete(id);
    }
  }
}, 5 * 60 * 1000);

/**
 * Formata segundos em formato MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * GET /api/qrcode/generate
 * Gera um novo QR code com URL e retorna o código e a imagem em base64
 */
export const generate = asyncHandler(async (req: Request, res: Response) => {
  // Carregar módulo QRCode
  const QRCodeLib = await loadQRCode();
  
  // Obter a função toString (pode estar em default ou diretamente)
  const qrcode = QRCodeLib.default || QRCodeLib;
  
  // Gerar ID único para o QR code
  const qrId = randomBytes(16).toString('hex');
  
  // Gerar URL que o usuário acessará (usando IP detectado automaticamente)
  const protocol = 'http';
  const localIP = getLocalIP();
  const host = `${localIP}:${SERVER_CONFIG.PORT}`;
  const url = `${protocol}://${host}/qrcode/${qrId}`;
  
  console.log(`📱 QR Code gerado com URL: ${url}`);
  console.log(`🌐 Backend rodando na porta: ${SERVER_CONFIG.PORT}`);
  console.log(`📱 App Angular configurado em: ${SERVER_CONFIG.CLIENT_MOBILE_URL}`);

  // Gerar QR code como SVG com a URL
  const qrSvg = await qrcode.toString(url, {
    type: 'svg',
    width: 200,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  // Armazenar dados do QR code
  qrCodes.set(qrId, {
    code: qrId,
    url,
    createdAt: Date.now(),
    isValid: true,
    nameSubmitted: false,
    songSelected: false,
    nameSubmittedAt: undefined,
    gaveUp: false
  });

  res.json({
    qrId,
    url,
    qrSvg
  });
});

/**
 * POST /api/qrcode/validate
 * Valida se o código escaneado corresponde ao QR code gerado
 */
export const validate = asyncHandler(async (req: Request, res: Response) => {
  const { qrId, scannedCode } = req.body;

  if (!qrId || !scannedCode) {
    return res.status(400).json({ error: 'qrId e scannedCode são obrigatórios' });
  }

  const qrData = qrCodes.get(qrId);

  if (!qrData) {
    return res.status(404).json({ error: 'QR code não encontrado ou expirado' });
  }

  // Verificar se expirou
  if (Date.now() - qrData.createdAt > QR_CODE_EXPIRY) {
    qrCodes.delete(qrId);
    return res.status(410).json({ error: 'QR code expirado' });
  }

  // Verificar se já foi usado
  if (!qrData.isValid) {
    return res.status(409).json({ error: 'QR code já foi utilizado' });
  }

  // Validar código
  if (qrData.code === scannedCode) {
    // Marcar como usado
    qrData.isValid = false;
    res.json({ valid: true, message: 'QR code validado com sucesso' });
  } else {
    res.status(400).json({ valid: false, error: 'Código não corresponde' });
  }
});

/**
 * GET /api/qrcode/:qrId/status
 * Verifica o status de um QR code
 */
export const getStatus = asyncHandler(async (req: Request, res: Response) => {
  const { qrId } = req.params;
  const qrData = qrCodes.get(qrId);

  if (!qrData) {
    return res.status(404).json({ error: 'QR code não encontrado ou expirado' });
  }

  // Verificar se expirou
  if (Date.now() - qrData.createdAt > QR_CODE_EXPIRY) {
    qrCodes.delete(qrId);
    return res.status(410).json({ error: 'QR code expirado' });
  }

  const response: any = {
    qrId,
    isValid: qrData.isValid,
    nameSubmitted: qrData.nameSubmitted,
    userName: qrData.userName,
    userPhone: qrData.userPhone,
    userPhoto: qrData.userPhoto,
    createdAt: qrData.createdAt,
    expiresAt: qrData.createdAt + QR_CODE_EXPIRY,
    songSelected: qrData.songSelected,
    songId: qrData.songId,
    nameSubmittedAt: qrData.nameSubmittedAt,
    gaveUp: qrData.gaveUp || false
  };

  // Se tem música selecionada, incluir informações da música
  if (qrData.songSelected && qrData.songId) {
    const song = getSongById(qrData.songId);
    if (song) {
      response.song = {
        id: song.id,
        name: song.name,
        displayName: song.displayName,
        artist: song.artist,
        duration: song.duration
      };
    }
  }

  res.json(response);
});

/**
 * GET /qrcode/:qrId
 * Redireciona para o app Angular mobile baseado no status do QR code
 */
export const getNamePage = asyncHandler(async (req: Request, res: Response) => {
  const { qrId } = req.params;
  const qrData = qrCodes.get(qrId);

  console.log(`📱 Requisição recebida para QR code: ${qrId}`);
  console.log(`🌐 CLIENT_MOBILE_URL configurado: ${SERVER_CONFIG.CLIENT_MOBILE_URL}`);

  if (!qrData) {
    // QR code não encontrado - redirecionar para página de erro
    const clientUrl = SERVER_CONFIG.CLIENT_MOBILE_URL;
    return res.redirect(`${clientUrl}/error?message=${encodeURIComponent('QR Code não encontrado ou expirado')}`);
  }

  // Verificar se expirou
  if (Date.now() - qrData.createdAt > QR_CODE_EXPIRY) {
    qrCodes.delete(qrId);
    const clientUrl = SERVER_CONFIG.CLIENT_MOBILE_URL;
    return res.redirect(`${clientUrl}/error?message=${encodeURIComponent('QR Code expirado')}`);
  }

  // Se o usuário desistiu, redirecionar para página de erro
  if (qrData.gaveUp) {
    const clientUrl = SERVER_CONFIG.CLIENT_MOBILE_URL;
    return res.redirect(`${clientUrl}/error?message=${encodeURIComponent('Você desistiu e não pode mais escolher músicas. Escaneie um novo QR code para participar novamente.')}`);
  }

  // Se o nome já foi submetido
  if (qrData.nameSubmitted) {
    // Se já selecionou música, redirecionar para player
    if (qrData.songSelected) {
      redirectToMobileApp(res, '/player', qrId);
      return;
    }
    // Se ainda não selecionou música, redirecionar para lista de músicas
    redirectToMobileApp(res, '/songs', qrId);
    return;
  }

  // Se ainda não se cadastrou, redirecionar para formulário de cadastro
  redirectToMobileApp(res, '/register', qrId);
});

/**
 * GET /qrcode/:qrId/old
 * Versão antiga com HTML inline (mantida para compatibilidade se necessário)
 */
export const getNamePageOld = asyncHandler(async (req: Request, res: Response) => {
  const { qrId } = req.params;
  const qrData = qrCodes.get(qrId);

  if (!qrData) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code não encontrado</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #0a0a0a;
            color: #ffffff;
            text-align: center;
            padding: 50px 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .error { 
            color: #f44336;
            font-size: 24px;
            margin-bottom: 15px;
          }
          p {
            color: rgba(255, 255, 255, 0.7);
            font-size: 16px;
          }
        </style>
      </head>
      <body>
        <h1 class="error">QR Code não encontrado ou expirado</h1>
        <p>Este QR code não existe ou já expirou.</p>
      </body>
      </html>
    `);
  }

  // Verificar se expirou
  if (Date.now() - qrData.createdAt > QR_CODE_EXPIRY) {
    qrCodes.delete(qrId);
    return res.status(410).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code expirado</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #0a0a0a;
            color: #ffffff;
            text-align: center;
            padding: 50px 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .error { 
            color: #f44336;
            font-size: 24px;
            margin-bottom: 15px;
          }
          p {
            color: rgba(255, 255, 255, 0.7);
            font-size: 16px;
          }
        </style>
      </head>
      <body>
        <h1 class="error">QR Code expirado</h1>
        <p>Este QR code expirou. Por favor, gere um novo.</p>
      </body>
      </html>
    `);
  }

  // Se o nome já foi submetido, mostrar lista de músicas ou mensagem de sucesso
  if (qrData.nameSubmitted) {
    // Se já selecionou música, mostrar controles de player
    if (qrData.songSelected) {
      const song = getSongById(qrData.songId || '');
      // Usar o mesmo host da URL do QR code para WebSocket
      const host = qrData.url.replace(/^https?:\/\//, '').split('/')[0];
      const qrId = req.params.qrId;
      
      // Formatar duração da música
      const songDuration = song?.duration || 0;
      const formattedDuration = formatTime(songDuration);
      
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Controle do Karaokê</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              background: #0a0a0a;
              color: #ffffff;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0 20px 100px;
              margin: 0;
            }
            .container {
              max-width: 500px;
              width: 100%;
            }
            .song-info {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 30px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .song-icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            .song-title {
              font-size: 24px;
              font-weight: 600;
              margin-bottom: 8px;
              word-wrap: break-word;
              line-height: 1.3;
              color: #ffffff;
            }
            .song-artist {
              font-size: 16px;
              opacity: 0.7;
              margin-bottom: 12px;
              word-wrap: break-word;
              color: rgba(255, 255, 255, 0.7);
            }
            .user-name {
              font-size: 14px;
              opacity: 0.6;
              color: rgba(255, 255, 255, 0.6);
            }
            .player-controls {
              margin-bottom: 25px;
            }
            .play-pause-btn {
              width: 80px;
              height: 80px;
              border-radius: 50%;
              border: none;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              font-size: 32px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 30px;
              transition: transform 0.2s, box-shadow 0.2s;
              box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
              -webkit-tap-highlight-color: transparent;
            }
            .play-pause-btn:hover {
              transform: scale(1.05);
              box-shadow: 0 12px 32px rgba(102, 126, 234, 0.6);
            }
            .play-pause-btn:active {
              transform: scale(0.95);
            }
            .play-pause-btn:disabled {
              opacity: 0.6;
              cursor: not-allowed;
              transform: none;
            }
            .progress-container {
              margin-bottom: 15px;
            }
            .progress-bar {
              width: 100%;
              height: 6px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 3px;
              overflow: hidden;
              margin-bottom: 12px;
            }
            .progress-filled {
              height: 100%;
              background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
              border-radius: 3px;
              transition: width 0.1s linear;
              width: 0%;
            }
            .time-display {
              display: flex;
              justify-content: space-between;
              font-size: 14px;
              opacity: 0.7;
              color: rgba(255, 255, 255, 0.7);
            }
            .status {
              text-align: center;
              padding: 10px;
              border-radius: 8px;
              margin-top: 20px;
              font-size: 14px;
              display: none;
            }
            .status.connected {
              background: rgba(76, 175, 80, 0.15);
              border: 1px solid rgba(76, 175, 80, 0.3);
              color: #4caf50;
              display: block;
            }
            .status.disconnected {
              background: rgba(211, 47, 47, 0.15);
              border: 1px solid rgba(211, 47, 47, 0.3);
              color: #f44336;
              display: block;
            }
            .status.connecting {
              background: rgba(255, 152, 0, 0.15);
              border: 1px solid rgba(255, 152, 0, 0.3);
              color: #ff9800;
              display: block;
            }
            .control-hint {
              text-align: center;
              font-size: 12px;
              opacity: 0.5;
              margin-top: 20px;
              color: rgba(255, 255, 255, 0.5);
            }
            .give-up-btn-wrapper {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              padding: 20px;
              background: #0a0a0a;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
              z-index: 100;
              backdrop-filter: blur(10px);
            }
            .give-up-btn {
              width: 100%;
              padding: 16px;
              background: transparent;
              color: rgba(255, 255, 255, 0.7);
              border: 2px solid rgba(255, 255, 255, 0.2);
              border-radius: 8px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              -webkit-tap-highlight-color: transparent;
              touch-action: manipulation;
              max-width: 500px;
              margin: 0 auto;
            }
            .give-up-btn:hover {
              background: rgba(211, 47, 47, 0.2);
              border-color: rgba(211, 47, 47, 0.5);
              color: #f44336;
              transform: translateY(-2px);
            }
            .give-up-btn:active {
              transform: translateY(0);
            }
            .give-up-btn:disabled {
              opacity: 0.6;
              cursor: not-allowed;
              transform: none;
            }
            @media (max-width: 480px) {
              body {
                padding: 10px;
              }
              .song-info {
                margin-bottom: 30px;
                padding-bottom: 20px;
              }
              .song-icon {
                font-size: 48px;
                margin-bottom: 15px;
              }
              .song-title {
                font-size: 20px;
              }
              .song-artist {
                font-size: 14px;
              }
              .user-name {
                font-size: 12px;
              }
              .play-pause-btn {
                width: 70px;
                height: 70px;
                font-size: 28px;
                margin-bottom: 25px;
              }
              .progress-container {
                margin-bottom: 12px;
              }
              .progress-bar {
                height: 5px;
              }
              .time-display {
                font-size: 12px;
              }
              .give-up-btn-wrapper {
                padding: 15px;
              }
              .give-up-btn {
                padding: 14px;
                font-size: 14px;
                max-width: 100%;
              }
              .status {
                font-size: 12px;
                padding: 8px;
              }
              .control-hint {
                font-size: 11px;
              }
            }
            @media (max-height: 600px) and (orientation: landscape) {
              .song-info {
                margin-bottom: 20px;
                padding-bottom: 15px;
              }
              .song-icon {
                font-size: 40px;
                margin-bottom: 10px;
              }
              .song-title {
                font-size: 18px;
              }
              .play-pause-btn {
                width: 60px;
                height: 60px;
                font-size: 24px;
                margin-bottom: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="song-info">
              <div class="song-icon">🎤</div>
              <div class="song-title">${song?.displayName || song?.name || qrData.songId}</div>
              ${song?.artist ? `<div class="song-artist">${song.artist}</div>` : ''}
              <div class="user-name">Cantando: ${qrData.userName}</div>
            </div>
            
            <div class="player-controls">
              <button class="play-pause-btn" id="playPauseBtn" onclick="togglePlayPause()">
                <i class="fas fa-play" id="playIcon"></i>
              </button>
              
              <div class="progress-container">
                <div class="progress-bar" id="progressBar">
                  <div class="progress-filled" id="progressFilled"></div>
                </div>
                <div class="time-display">
                  <span id="currentTime">0:00</span>
                  <span id="totalTime">${formattedDuration}</span>
                </div>
              </div>
            </div>
            
            <div class="status" id="status">Conectando...</div>
            <div class="control-hint">Você pode controlar o karaokê pelo celular</div>
          </div>
          
          <div class="give-up-btn-wrapper">
            <button class="give-up-btn" id="giveUpBtn" onclick="giveUp()">
              <i class="fas fa-times-circle"></i>
              Desistir
            </button>
          </div>
          
          <script>
            const qrId = '${qrId}';
            // Detectar protocolo WebSocket baseado na URL atual
            const currentProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = '${host}';
            const wsUrl = \`\${currentProtocol}//\${host}/ws/sync\`;
            let ws = null;
            let isPlaying = false;
            let currentTime = 0;
            let duration = ${songDuration};
            let reconnectTimeout = null;
            
            const playPauseBtn = document.getElementById('playPauseBtn');
            const playIcon = document.getElementById('playIcon');
            const progressFilled = document.getElementById('progressFilled');
            const currentTimeDisplay = document.getElementById('currentTime');
            const statusDisplay = document.getElementById('status');
            
            function formatTime(seconds) {
              const mins = Math.floor(seconds / 60);
              const secs = Math.floor(seconds % 60);
              return \`\${mins}:\${secs.toString().padStart(2, '0')}\`;
            }
            
            function updateDisplay() {
              const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
              progressFilled.style.width = percentage + '%';
              currentTimeDisplay.textContent = formatTime(currentTime);
              
              playIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
            }
            
            function connectWebSocket() {
              try {
                statusDisplay.className = 'status connecting';
                statusDisplay.textContent = 'Conectando...';
                
                ws = new WebSocket(wsUrl);
                
                ws.onopen = () => {
                  console.log('WebSocket connected');
                  statusDisplay.className = 'status connected';
                  statusDisplay.textContent = '✓ Conectado ao karaokê';
                  
                  // Solicitar estado atual do servidor
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'getTime' }));
                  }
                };
                
                ws.onmessage = (event) => {
                  try {
                    const message = JSON.parse(event.data);
                    
                    switch (message.type) {
                      case 'stateChanged':
                        isPlaying = message.state === 'playing';
                        if (message.timestamp !== undefined) {
                          currentTime = message.timestamp;
                        }
                        updateDisplay();
                        break;
                        
                      case 'timeUpdate':
                        currentTime = message.timestamp || 0;
                        updateDisplay();
                        break;
                    }
                  } catch (error) {
                    console.error('Error parsing message:', error);
                  }
                };
                
                ws.onerror = (error) => {
                  console.error('WebSocket error:', error);
                  statusDisplay.className = 'status disconnected';
                  statusDisplay.textContent = '✗ Erro de conexão';
                };
                
                ws.onclose = () => {
                  console.log('WebSocket disconnected');
                  statusDisplay.className = 'status disconnected';
                  statusDisplay.textContent = '✗ Desconectado. Reconectando...';
                  
                  // Tentar reconectar após 3 segundos
                  clearTimeout(reconnectTimeout);
                  reconnectTimeout = setTimeout(connectWebSocket, 3000);
                };
              } catch (error) {
                console.error('Error connecting WebSocket:', error);
                statusDisplay.className = 'status disconnected';
                statusDisplay.textContent = '✗ Erro ao conectar';
                
                clearTimeout(reconnectTimeout);
                reconnectTimeout = setTimeout(connectWebSocket, 3000);
              }
            }
            
            function togglePlayPause() {
              if (!ws || ws.readyState !== WebSocket.OPEN) {
                alert('Aguardando conexão...');
                return;
              }
              
              const message = isPlaying 
                ? { type: 'pause' }
                : { type: 'play' };
              
              ws.send(JSON.stringify(message));
            }
            
            async function giveUp() {
              if (!confirm('Tem certeza que deseja desistir desta música?')) {
                return;
              }
              
              const giveUpBtn = document.getElementById('giveUpBtn');
              if (giveUpBtn) {
                giveUpBtn.disabled = true;
                giveUpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Desistindo...';
              }
              
              try {
                const response = await fetch(\`/api/qrcode/\${qrId}/giveup\`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
                
                if (response.ok) {
                  alert('Você desistiu da música. Volte à tela inicial.');
                  // Recarregar a página para voltar à seleção de música
                  window.location.reload();
                } else {
                  const data = await response.json();
                  alert(data.error || 'Erro ao desistir. Tente novamente.');
                  if (giveUpBtn) {
                    giveUpBtn.disabled = false;
                    giveUpBtn.innerHTML = '<i class="fas fa-times-circle"></i> Desistir';
                  }
                }
              } catch (error) {
                alert('Erro de conexão. Verifique sua internet e tente novamente.');
                if (giveUpBtn) {
                  giveUpBtn.disabled = false;
                  giveUpBtn.innerHTML = '<i class="fas fa-times-circle"></i> Desistir';
                }
              }
            }
            
            // Inicializar conexão
            connectWebSocket();
            
            // Atualizar display periodicamente
            setInterval(() => {
              if (isPlaying && duration > 0) {
                currentTime += 0.1;
                if (currentTime > duration) {
                  currentTime = duration;
                  isPlaying = false;
                }
                updateDisplay();
              }
            }, 100);
          </script>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        </body>
        </html>
      `);
    }

    // Se ainda não selecionou música, mostrar lista de músicas
    const allSongs = getAllSongs();
    const readySongs = allSongs.filter(song => song.status.ready);
    
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Selecionar Música</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #0a0a0a;
            color: #ffffff;
            min-height: 100vh;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            padding: 30px 20px;
            margin-bottom: 30px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }
          .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
            color: #ffffff;
          }
          .header p {
            opacity: 0.7;
            font-size: 14px;
            word-wrap: break-word;
            color: rgba(255, 255, 255, 0.7);
          }
          .content {
            padding: 0 20px 20px;
            max-height: calc(100vh - 200px);
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            position: relative;
          }
          .search-box {
            margin-bottom: 20px;
            position: sticky;
            top: 0;
            z-index: 10;
            background: #0a0a0a;
            padding: 15px 0;
            margin: 0 -20px 20px;
            padding-left: 20px;
            padding-right: 20px;
          }
          .search-box i {
            position: absolute;
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
            color: rgba(255, 255, 255, 0.5);
          }
          .search-box input {
            width: 100%;
            padding: 14px 16px 14px 45px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(255, 255, 255, 0.05);
            color: #ffffff;
            border-radius: 8px;
            font-size: 16px;
            transition: all 0.3s;
          }
          .search-box input::placeholder {
            color: rgba(255, 255, 255, 0.4);
          }
          .search-box input:focus {
            outline: none;
            border-color: #667eea;
            background: rgba(255, 255, 255, 0.08);
          }
          .songs-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .song-item {
            padding: 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: space-between;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            background: rgba(255, 255, 255, 0.03);
            margin-bottom: 10px;
          }
          .song-item:hover {
            border-color: rgba(102, 126, 234, 0.5);
            background: rgba(102, 126, 234, 0.1);
            transform: translateX(5px);
          }
          .song-item:active {
            transform: scale(0.98);
            background: rgba(102, 126, 234, 0.15);
          }
          .song-info {
            flex: 1;
            min-width: 0;
          }
          .song-name {
            font-weight: 600;
            color: #ffffff;
            font-size: 16px;
            margin-bottom: 4px;
            word-wrap: break-word;
            line-height: 1.4;
          }
          .song-artist {
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
            word-wrap: break-word;
          }
          .song-item i {
            color: rgba(255, 255, 255, 0.5);
            font-size: 20px;
            flex-shrink: 0;
            margin-left: 10px;
            transition: color 0.3s;
          }
          .song-item:hover i {
            color: #667eea;
          }
          .loading {
            text-align: center;
            padding: 40px;
            color: rgba(255, 255, 255, 0.5);
          }
          .empty {
            text-align: center;
            padding: 40px;
            color: rgba(255, 255, 255, 0.5);
          }
          .error {
            color: #f44336;
            font-size: 14px;
            margin-top: 10px;
            text-align: center;
            display: none;
            background: rgba(244, 67, 54, 0.1);
            padding: 10px;
            border-radius: 8px;
            border: 1px solid rgba(244, 67, 54, 0.3);
          }
          @media (max-width: 480px) {
            body {
              padding: 10px;
            }
            .header {
              padding: 20px 10px;
              margin-bottom: 20px;
            }
            .header h1 {
              font-size: 22px;
              margin-bottom: 8px;
            }
            .header p {
              font-size: 13px;
            }
            .content {
              padding: 0 10px 10px;
              max-height: calc(100vh - 180px);
            }
            .search-box {
              margin-bottom: 15px;
              padding: 12px 10px;
              margin: 0 -10px 15px;
            }
            .search-box input {
              padding: 12px 14px 12px 40px;
              font-size: 16px;
            }
            .song-item {
              padding: 14px;
            }
            .song-name {
              font-size: 15px;
            }
            .song-artist {
              font-size: 13px;
            }
            .song-item i {
              font-size: 18px;
            }
            .loading, .empty {
              padding: 30px 20px;
              font-size: 14px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎤 Selecionar Música</h1>
            <p>Olá, <strong>${qrData.userName}</strong>! Escolha uma música para cantar.</p>
          </div>
          <div class="content">
            <div class="search-box">
              <i class="fas fa-search"></i>
              <input type="text" id="searchInput" placeholder="Buscar música...">
            </div>
            <div id="songsList" class="songs-list">
              <div class="loading">Carregando músicas...</div>
            </div>
            <div id="errorMsg" class="error"></div>
          </div>
        </div>
        <script>
          const qrId = '${qrId}';
          const songsList = document.getElementById('songsList');
          const searchInput = document.getElementById('searchInput');
          const errorMsg = document.getElementById('errorMsg');
          let allSongs = [];

          async function loadSongs() {
            try {
              const response = await fetch('/api/songs');
              if (!response.ok) throw new Error('Erro ao carregar músicas');
              const data = await response.json();
              allSongs = (data.songs || []).filter(song => song.status.ready);
              displaySongs(allSongs);
            } catch (error) {
              songsList.innerHTML = '<div class="empty">Erro ao carregar músicas. Tente recarregar a página.</div>';
              console.error('Error loading songs:', error);
            }
          }

          function displaySongs(songs) {
            if (songs.length === 0) {
              songsList.innerHTML = '<div class="empty">Nenhuma música disponível no momento.</div>';
              return;
            }

            songsList.innerHTML = songs.map(song => \`
              <div class="song-item" onclick="selectSong('\${song.id}')">
                <div class="song-info">
                  <div class="song-name">\${song.displayName || song.name}</div>
                  \${song.artist ? \`<div class="song-artist">\${song.artist}</div>\` : ''}
                </div>
                <i class="fas fa-chevron-right"></i>
              </div>
            \`).join('');
          }

          async function selectSong(songId) {
            try {
              const response = await fetch(\`/api/qrcode/\${qrId}/song\`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ songId })
              });

              const data = await response.json();

              if (response.ok) {
                window.location.reload();
              } else {
                showError(data.error || 'Erro ao selecionar música. Tente novamente.');
              }
            } catch (error) {
              showError('Erro de conexão. Verifique sua internet e tente novamente.');
            }
          }

          function showError(message) {
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
            setTimeout(() => {
              errorMsg.style.display = 'none';
            }, 5000);
          }

          searchInput.addEventListener('input', (e) => {
            const search = e.target.value.toLowerCase();
            const filtered = allSongs.filter(song => 
              (song.displayName || song.name).toLowerCase().includes(search) ||
              (song.artist || '').toLowerCase().includes(search)
            );
            displaySongs(filtered);
          });

          loadSongs();
        </script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
      </body>
      </html>
    `);
  }

  // Página para inserir o nome e telefone
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Insira seus dados</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: #0a0a0a;
          color: #ffffff;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          max-width: 400px;
          width: 100%;
        }
        h1 {
          color: #ffffff;
          margin-bottom: 10px;
          font-size: 28px;
          text-align: center;
        }
        .subtitle {
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 40px;
          font-size: 14px;
          text-align: center;
        }
        .form-group {
          margin-bottom: 24px;
        }
        label {
          display: block;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 10px;
          font-weight: 500;
          font-size: 14px;
        }
        input {
          width: 100%;
          padding: 14px 16px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.05);
          color: #ffffff;
          border-radius: 8px;
          font-size: 16px;
          transition: all 0.3s;
          -webkit-appearance: none;
          appearance: none;
        }
        input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        input:focus {
          outline: none;
          border-color: #667eea;
          background: rgba(255, 255, 255, 0.08);
        }
        .user-found {
          background: rgba(76, 175, 80, 0.15);
          border: 1px solid rgba(76, 175, 80, 0.3);
          padding: 12px;
          border-radius: 8px;
          margin-top: 12px;
          font-size: 14px;
          color: #4caf50;
          display: none;
        }
        button {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
        }
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(102, 126, 234, 0.6);
        }
        button:active {
          transform: translateY(0);
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        button {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .error {
          color: #f44336;
          font-size: 14px;
          margin-top: 10px;
          display: none;
          background: rgba(244, 67, 54, 0.1);
          padding: 10px;
          border-radius: 8px;
          border: 1px solid rgba(244, 67, 54, 0.3);
        }
        .success {
          color: #4caf50;
          font-size: 14px;
          margin-top: 10px;
          display: none;
          background: rgba(76, 175, 80, 0.1);
          padding: 10px;
          border-radius: 8px;
          border: 1px solid rgba(76, 175, 80, 0.3);
        }
        .user-found {
          background: rgba(76, 175, 80, 0.15);
          border: 1px solid rgba(76, 175, 80, 0.3);
          padding: 10px;
          border-radius: 8px;
          margin-top: 10px;
          font-size: 14px;
          color: #4caf50;
          display: none;
        }
        .photo-section {
          margin-bottom: 30px;
          text-align: center;
        }
        .photo-section label {
          display: block;
          margin-bottom: 20px;
          font-size: 15px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
        }
        .photo-preview-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 20px;
          min-height: 200px;
        }
        .photo-preview {
          width: 200px;
          height: 200px;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          display: none;
          background: rgba(255, 255, 255, 0.05);
          transition: all 0.3s ease;
        }
        .photo-preview.show {
          display: block;
        }
        .photo-preview:hover {
          border-color: rgba(102, 126, 234, 0.6);
          box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
        }
        .camera-btn {
          width: 100%;
          max-width: 300px;
          margin: 0 auto;
          padding: 16px 24px;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
          color: rgba(255, 255, 255, 0.95);
          border: 2px solid rgba(102, 126, 234, 0.4);
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .camera-btn:hover {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%);
          border-color: rgba(102, 126, 234, 0.6);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }
        .camera-btn:active {
          transform: translateY(0);
        }
        .camera-btn i {
          font-size: 20px;
        }
        input[type="file"] {
          display: none;
        }
        .retake-btn {
          width: 100%;
          max-width: 300px;
          margin: 10px auto 0;
          padding: 12px 20px;
          background: transparent;
          color: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .retake-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.4);
          color: rgba(255, 255, 255, 0.9);
        }
        .retake-btn i {
          font-size: 14px;
        }
        @media (max-width: 480px) {
          body {
            padding: 10px;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 8px;
          }
          .subtitle {
            font-size: 13px;
            margin-bottom: 30px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          .photo-section {
            margin-bottom: 25px;
          }
          .photo-preview {
            width: 180px;
            height: 180px;
          }
          .photo-preview-wrapper {
            min-height: 180px;
            margin-bottom: 15px;
          }
          label {
            font-size: 13px;
            margin-bottom: 8px;
          }
          input {
            padding: 14px 16px;
            font-size: 16px;
          }
          button {
            padding: 16px;
            font-size: 16px;
          }
          .camera-btn {
            padding: 12px;
            font-size: 15px;
          }
          .user-found {
            font-size: 13px;
            padding: 10px;
          }
          .error, .success {
            font-size: 13px;
            padding: 10px;
          }
        }
        @media (max-width: 360px) {
          h1 {
            font-size: 22px;
          }
          .photo-preview {
            width: 160px;
            height: 160px;
          }
          .photo-preview-wrapper {
            min-height: 160px;
          }
          input {
            padding: 12px 14px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎤 Karaokê</h1>
        <p class="subtitle">Insira seus dados para começar</p>
        <form id="nameForm">
          <div class="form-group">
            <label for="userPhone">Seu telefone</label>
            <input 
              type="tel" 
              id="userPhone" 
              name="userPhone" 
              required 
              minlength="10" 
              maxlength="15"
              placeholder="(00) 00000-0000"
              autocomplete="tel"
            >
            <div class="user-found" id="userFoundMsg">
              ✅ Usuário encontrado! Nome carregado automaticamente.
            </div>
          </div>
          <div class="form-group">
            <label for="userName">Seu nome</label>
            <input 
              type="text" 
              id="userName" 
              name="userName" 
              required 
              minlength="2" 
              maxlength="50"
              placeholder="Digite seu nome"
              autocomplete="name"
            >
          </div>
          <div class="photo-section">
            <label for="userPhoto">Tire uma selfie *</label>
            <div class="photo-preview-wrapper">
              <img id="photoPreview" class="photo-preview" alt="Preview da foto">
            </div>
            <input 
              type="file" 
              id="userPhoto" 
              name="userPhoto" 
              accept="image/*" 
              capture="user"
              required
            >
            <button type="button" class="camera-btn" id="cameraBtn" onclick="document.getElementById('userPhoto').click()">
              <i class="fas fa-camera"></i>
              <span id="cameraBtnText">Tirar Selfie</span>
            </button>
            <button type="button" class="retake-btn" id="retakeBtn" onclick="retakePhoto()" style="display: none;">
              <i class="fas fa-redo"></i>
              <span>Tirar Outra Foto</span>
            </button>
          </div>
          <button type="submit" id="submitBtn">Confirmar</button>
          <div class="error" id="errorMsg"></div>
          <div class="success" id="successMsg"></div>
        </form>
      </div>
      <script>
        const form = document.getElementById('nameForm');
        const userNameInput = document.getElementById('userName');
        const userPhoneInput = document.getElementById('userPhone');
        const userPhotoInput = document.getElementById('userPhoto');
        const photoPreview = document.getElementById('photoPreview');
        const cameraBtn = document.getElementById('cameraBtn');
        const cameraBtnText = document.getElementById('cameraBtnText');
        const retakeBtn = document.getElementById('retakeBtn');
        const submitBtn = document.getElementById('submitBtn');
        const errorMsg = document.getElementById('errorMsg');
        const successMsg = document.getElementById('successMsg');
        const userFoundMsg = document.getElementById('userFoundMsg');
        let phoneCheckTimeout = null;
        
        // Preview da foto
        userPhotoInput.addEventListener('change', function(e) {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
              photoPreview.src = event.target.result;
              photoPreview.classList.add('show');
              cameraBtnText.textContent = 'Foto Capturada';
              cameraBtn.style.display = 'none';
              retakeBtn.style.display = 'flex';
            };
            reader.readAsDataURL(file);
          }
        });
        
        function retakePhoto() {
          userPhotoInput.value = '';
          photoPreview.src = '';
          photoPreview.classList.remove('show');
          cameraBtnText.textContent = 'Tirar Selfie';
          cameraBtn.style.display = 'flex';
          retakeBtn.style.display = 'none';
        }
        
        // Máscara de telefone
        userPhoneInput.addEventListener('input', function(e) {
          let value = e.target.value.replace(/\D/g, '');
          if (value.length <= 11) {
            if (value.length <= 10) {
              value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
            } else {
              value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
            }
            e.target.value = value;
            
            // Buscar usuário após 1 segundo sem digitar
            clearTimeout(phoneCheckTimeout);
            if (value.replace(/\D/g, '').length >= 10) {
              phoneCheckTimeout = setTimeout(checkUserByPhone, 1000);
            } else {
              userFoundMsg.style.display = 'none';
            }
          }
        });
        
        async function checkUserByPhone() {
          const phone = userPhoneInput.value.replace(/\D/g, '');
          if (phone.length < 10) return;
          
          try {
            const response = await fetch(\`/api/users/by-phone/\${encodeURIComponent(phone)}\`);
            if (response.ok) {
              const user = await response.json();
              if (user) {
                userNameInput.value = user.name;
                userFoundMsg.style.display = 'block';
              } else {
                userFoundMsg.style.display = 'none';
              }
            }
          } catch (error) {
            // Ignorar erros silenciosamente
          }
        }
        
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const userName = userNameInput.value.trim();
          const userPhone = userPhoneInput.value.replace(/\D/g, '');
          const photoFile = userPhotoInput.files[0];
          
          if (userName.length < 2) {
            showError('Por favor, insira um nome com pelo menos 2 caracteres.');
            return;
          }
          
          if (userPhone.length < 10) {
            showError('Por favor, insira um telefone válido.');
            return;
          }
          
          if (!photoFile) {
            showError('Por favor, tire uma selfie antes de continuar.');
            return;
          }
          
          submitBtn.disabled = true;
          submitBtn.textContent = 'Enviando...';
          hideMessages();
          
          try {
            // Primeiro, fazer upload da foto
            const formData = new FormData();
            formData.append('photo', photoFile);
            
            const photoResponse = await fetch('/api/users/upload-photo/${qrId}', {
              method: 'POST',
              body: formData
            });
            
            if (!photoResponse.ok) {
              const photoError = await photoResponse.json();
              throw new Error(photoError.error || 'Erro ao fazer upload da foto');
            }
            
            const photoData = await photoResponse.json();
            
            // Depois, enviar nome e telefone com referência da foto
            const response = await fetch('/api/qrcode/${qrId}/name', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                userName, 
                userPhone,
                userPhoto: photoData.photo
              })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              showSuccess('Dados registrados com sucesso!');
              submitBtn.textContent = '✅ Confirmado';
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            } else {
              showError(data.error || 'Erro ao registrar dados. Tente novamente.');
              submitBtn.disabled = false;
              submitBtn.textContent = 'Confirmar';
            }
          } catch (error) {
            showError('Erro de conexão. Verifique sua internet e tente novamente.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirmar';
          }
        });
        
        function showError(message) {
          errorMsg.textContent = message;
          errorMsg.style.display = 'block';
          successMsg.style.display = 'none';
        }
        
        function showSuccess(message) {
          successMsg.textContent = message;
          successMsg.style.display = 'block';
          errorMsg.style.display = 'none';
        }
        
        function hideMessages() {
          errorMsg.style.display = 'none';
          successMsg.style.display = 'none';
        }
        
        // Focar no input de telefone ao carregar
        userPhoneInput.focus();
      </script>
    </body>
    </html>
  `);
});

/**
 * POST /api/qrcode/:qrId/name
 * Processa o nome e telefone inseridos pelo usuário
 */
export const submitName = asyncHandler(async (req: Request, res: Response) => {
  const { qrId } = req.params;
  const { userName, userPhone, userPhoto } = req.body;

  if (!userName || typeof userName !== 'string' || userName.trim().length < 2) {
    return res.status(400).json({ error: 'Nome deve ter pelo menos 2 caracteres' });
  }

  if (!userPhone || typeof userPhone !== 'string') {
    return res.status(400).json({ error: 'Telefone é obrigatório' });
  }

  if (!userPhoto || typeof userPhoto !== 'string') {
    return res.status(400).json({ error: 'Foto (selfie) é obrigatória' });
  }

  // Normalizar telefone
  const normalizedPhone = userPhone.replace(/\D/g, '');
  if (normalizedPhone.length < 10) {
    return res.status(400).json({ error: 'Telefone deve ter pelo menos 10 dígitos' });
  }

  const qrData = qrCodes.get(qrId);

  if (!qrData) {
    return res.status(404).json({ error: 'QR code não encontrado ou expirado' });
  }

  // Verificar se expirou
  if (Date.now() - qrData.createdAt > QR_CODE_EXPIRY) {
    qrCodes.delete(qrId);
    return res.status(410).json({ error: 'QR code expirado' });
  }

  // Verificar se o nome já foi submetido
  if (qrData.nameSubmitted) {
    return res.status(409).json({ error: 'Nome já foi registrado para este QR code' });
  }

  // Verificar se usuário já existe antes de criar/atualizar
  const existingUser = getUserByPhone(normalizedPhone);
  const isNewUser = !existingUser;

  // Criar ou atualizar usuário no banco de dados
  const user = createOrUpdateUser(userName.trim(), normalizedPhone, userPhoto);

  // Registrar o nome, telefone e foto no QR code
  qrData.userName = user.name;
  qrData.userPhone = user.phone;
  qrData.userPhoto = user.photo;
  qrData.nameSubmitted = true;
  qrData.nameSubmittedAt = Date.now(); // Registrar quando o nome foi submetido

  // Notificar o frontend via WebSocket
  broadcastQRCodeName(qrId, user.name);

  res.json({
    success: true,
    message: isNewUser ? 'Usuário criado com sucesso' : 'Usuário atualizado com sucesso',
    userName: qrData.userName,
    userPhone: qrData.userPhone,
    isNewUser
  });
});

/**
 * POST /api/qrcode/:qrId/song
 * Seleciona uma música para o QR code
 */
export const selectSong = asyncHandler(async (req: Request, res: Response) => {
  const { qrId } = req.params;
  const { songId } = req.body;

  if (!songId || typeof songId !== 'string') {
    return res.status(400).json({ error: 'songId é obrigatório' });
  }

  const qrData = qrCodes.get(qrId);

  if (!qrData) {
    return res.status(404).json({ error: 'QR code não encontrado ou expirado' });
  }

  // Verificar se expirou
  if (Date.now() - qrData.createdAt > QR_CODE_EXPIRY) {
    qrCodes.delete(qrId);
    return res.status(410).json({ error: 'QR code expirado' });
  }

  // Verificar se o nome foi submetido primeiro
  if (!qrData.nameSubmitted) {
    return res.status(400).json({ error: 'Nome deve ser submetido antes de selecionar música' });
  }

  // Verificar se o usuário desistiu - não pode mais escolher músicas
  if (qrData.gaveUp) {
    return res.status(403).json({ error: 'Você desistiu e não pode mais escolher músicas. Escaneie um novo QR code para participar novamente.' });
  }

  // Verificar se o tempo de 4 minutos para escolher música expirou
  if (qrData.nameSubmittedAt) {
    const timeSinceNameSubmitted = Date.now() - qrData.nameSubmittedAt;
    if (timeSinceNameSubmitted > SONG_SELECTION_TIMEOUT) {
      // Resetar o QR code (remover nome submetido para permitir novo escaneamento)
      qrData.nameSubmitted = false;
      qrData.nameSubmittedAt = undefined;
      qrData.userName = undefined;
      qrData.userPhone = undefined;
      qrData.userPhoto = undefined;
      return res.status(408).json({ error: 'Tempo para escolher música expirado. Escaneie o QR code novamente.' });
    }
  }

  // Verificar se a música existe
  const song = getSongById(songId);
  if (!song) {
    return res.status(404).json({ error: 'Música não encontrada' });
  }

  // Verificar se a música está pronta
  if (!song.status.ready) {
    return res.status(400).json({ error: 'Música ainda não está pronta para uso' });
  }

  // Registrar a música selecionada
  qrData.songId = songId;
  qrData.songSelected = true;

  // Notificar o frontend via WebSocket
  broadcastQRCodeSong(qrId, songId, qrData.userName || '');

  res.json({
    success: true,
    message: 'Música selecionada com sucesso',
    songId,
    songName: song.displayName || song.name
  });
});

/**
 * GET /api/qrcode/user/:sessionId
 * Get user information by sessionId (if playing via QR code)
 */
export const getUserBySessionId = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  // Primeiro, tentar buscar através do mapeamento sessionId -> qrId
  const qrId = sessionToQrMap.get(sessionId);
  if (qrId) {
    const qrData = qrCodes.get(qrId);
    if (qrData && qrData.userName && qrData.userPhoto && qrData.nameSubmitted) {
      // Verificar se não expirou
      if (Date.now() - qrData.createdAt <= QR_CODE_EXPIRY) {
        return res.json({
          userName: qrData.userName,
          userPhoto: qrData.userPhoto,
          found: true
        });
      } else {
        // Limpar mapeamento expirado
        sessionToQrMap.delete(sessionId);
      }
    }
  }

  // Se não encontrou pelo mapeamento, buscar em todos os QR codes ativos
  // que têm usuário e que estão jogando (songSelected = true)
  for (const [currentQrId, qrData] of qrCodes.entries()) {
    // Verificar se expirou
    if (Date.now() - qrData.createdAt > QR_CODE_EXPIRY) {
      continue;
    }
    
    // Se o QR code tem um usuário associado e está com música selecionada
    if (qrData.userName && qrData.userPhoto && qrData.nameSubmitted && qrData.songSelected) {
      // Associar este sessionId ao QR code para futuras buscas
      sessionToQrMap.set(sessionId, currentQrId);
      qrData.sessionId = sessionId;
      
      return res.json({
        userName: qrData.userName,
        userPhoto: qrData.userPhoto,
        found: true
      });
    }
  }

  res.status(404).json({ error: 'User not found' });
});

/**
 * POST /api/qrcode/:qrId/giveup
 * Permite que o usuário desista da música selecionada
 */
export const giveUp = asyncHandler(async (req: Request, res: Response) => {
  const { qrId } = req.params;

  const qrData = qrCodes.get(qrId);

  if (!qrData) {
    return res.status(404).json({ error: 'QR code não encontrado ou expirado' });
  }

  // Verificar se expirou
  if (Date.now() - qrData.createdAt > QR_CODE_EXPIRY) {
    qrCodes.delete(qrId);
    return res.status(410).json({ error: 'QR code expirado' });
  }

  // Verificar se há música selecionada para desistir
  if (!qrData.songSelected) {
    return res.status(400).json({ error: 'Nenhuma música selecionada para desistir' });
  }

  const userName = qrData.userName || 'Usuário';
  const songId = qrData.songId;

  // Marcar que o usuário desistiu - não poderá mais escolher músicas
  qrData.gaveUp = true;
  qrData.songSelected = false;
  qrData.songId = undefined;

  // Notificar o frontend via WebSocket
  broadcastQRCodeGiveUp(qrId, songId || '', userName);

  res.json({
    success: true,
    message: 'Desistência registrada com sucesso',
    userName,
    gaveUp: true
  });
});
