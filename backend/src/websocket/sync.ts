import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

interface SyncMessage {
  type: 'play' | 'pause' | 'seek' | 'getTime' | 'timeUpdate' | 'stateChanged';
  timestamp?: number;
  state?: 'playing' | 'paused';
}

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

let currentState: {
  isPlaying: boolean;
  currentTime: number;
  startTime: number | null;
} = {
  isPlaying: false,
  currentTime: 0,
  startTime: null
};

/**
 * Calcula o tempo atual baseado no estado
 */
function getCurrentTime(): number {
  if (!currentState.isPlaying || currentState.startTime === null) {
    return currentState.currentTime;
  }
  
  const elapsed = (Date.now() - currentState.startTime) / 1000;
  return currentState.currentTime + elapsed;
}

/**
 * Broadcasta mensagem para todos os clientes conectados
 */
function broadcast(message: SyncMessage) {
  const data = JSON.stringify(message);
  const disconnectedClients: WebSocket[] = [];
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch (error: any) {
        // Cliente desconectou, marcar para remover
        if (error.code === 'ECONNRESET' || error.code === 'EPIPE' || error.code === 'ECONNABORTED') {
          disconnectedClients.push(client);
        } else {
          console.error('Error broadcasting message:', error);
        }
      }
    } else {
      // Cliente não está mais aberto, remover
      disconnectedClients.push(client);
    }
  });

  // Remover clientes desconectados
  disconnectedClients.forEach(client => {
    clients.delete(client);
  });
}

/**
 * Setup do servidor WebSocket
 */
export function setupWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws/sync' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('🔌 WebSocket client connected');
    clients.add(ws);

    // Enviar estado atual ao novo cliente
    ws.send(JSON.stringify({
      type: 'stateChanged',
      state: currentState.isPlaying ? 'playing' : 'paused',
      timestamp: getCurrentTime()
    }));

    // Atualizar tempo periodicamente quando estiver tocando
    const timeUpdateInterval = setInterval(() => {
      if (currentState.isPlaying && ws.readyState === ws.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: 'timeUpdate',
            timestamp: getCurrentTime()
          }));
        } catch (error: any) {
          // Cliente desconectou, parar intervalo
          if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
            console.error('Error sending time update:', error);
          }
          clearInterval(timeUpdateInterval);
        }
      }
    }, 100); // Atualiza a cada 100ms

    ws.on('message', (data: Buffer) => {
      try {
        const message: SyncMessage = JSON.parse(data.toString());

        switch (message.type) {
          case 'play':
            if (!currentState.isPlaying) {
              currentState.isPlaying = true;
              currentState.startTime = Date.now();
              
              broadcast({
                type: 'stateChanged',
                state: 'playing',
                timestamp: currentState.currentTime
              });
            }
            break;

          case 'pause':
            if (currentState.isPlaying) {
              currentState.currentTime = getCurrentTime();
              currentState.isPlaying = false;
              currentState.startTime = null;
              
              broadcast({
                type: 'stateChanged',
                state: 'paused',
                timestamp: currentState.currentTime
              });
            }
            break;

          case 'seek':
            if (message.timestamp !== undefined) {
              currentState.currentTime = Math.max(0, message.timestamp);
              currentState.startTime = currentState.isPlaying ? Date.now() : null;
              
              broadcast({
                type: 'stateChanged',
                state: currentState.isPlaying ? 'playing' : 'paused',
                timestamp: currentState.currentTime
              });
            }
            break;

          case 'getTime':
            ws.send(JSON.stringify({
              type: 'timeUpdate',
              timestamp: getCurrentTime()
            }));
            break;
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
      clients.delete(ws);
      clearInterval(timeUpdateInterval);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
      clearInterval(timeUpdateInterval);
    });
  });

  console.log('✅ WebSocket server initialized');
}

