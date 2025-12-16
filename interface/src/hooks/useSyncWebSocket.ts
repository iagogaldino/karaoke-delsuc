import { useState, useEffect, useRef, useCallback } from 'react';
import { SyncMessage } from '../types/index.js';
import { WEBSOCKET_CONFIG } from '../config/index.js';
import { getWebSocketUrl } from '../utils/electronUtils.js';

export function useSyncWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Se já existe uma conexão aberta ou em conexão, não criar outra
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = getWebSocketUrl(WEBSOCKET_CONFIG.PATH);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: SyncMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'timeUpdate':
              if (message.timestamp !== undefined) {
                setCurrentTime(message.timestamp);
              }
              break;

            case 'stateChanged':
              setIsPlaying(message.state === 'playing');
              if (message.timestamp !== undefined) {
                setCurrentTime(message.timestamp);
              }
              break;

            case 'error':
              console.error('WebSocket error:', message.message);
              break;
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
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        // Só logar desconexão se não foi intencional (código 1000) ou se estava conectado
        if (event.code !== 1000 || ws.readyState === WebSocket.OPEN) {
          console.log('🔌 WebSocket disconnected');
        }
        setIsConnected(false);
        
        // Só tentar reconectar se não foi fechado intencionalmente (código 1000)
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, WEBSOCKET_CONFIG.RECONNECT_DELAY);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      // Limpar timeout de reconexão
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Fechar WebSocket se existir e não estiver já fechado
      if (wsRef.current) {
        const ws = wsRef.current;
        // Remover listeners para evitar logs desnecessários
        ws.onerror = null;
        ws.onclose = null;
        
        // Fechar apenas se não estiver já fechado
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, 'Component unmounting'); // Código 1000 = fechamento normal
        }
        
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: SyncMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  }, []);

  const play = useCallback(() => {
    sendMessage({ type: 'play' });
  }, [sendMessage]);

  const pause = useCallback(() => {
    sendMessage({ type: 'pause' });
  }, [sendMessage]);

  const seek = useCallback((timestamp: number) => {
    sendMessage({ type: 'seek', timestamp });
  }, [sendMessage]);

  return {
    isConnected,
    currentTime,
    isPlaying,
    play,
    pause,
    seek
  };
}
