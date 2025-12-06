import { useState, useEffect, useRef, useCallback } from 'react';

interface SyncMessage {
  type: 'play' | 'pause' | 'seek' | 'getTime' | 'timeUpdate' | 'stateChanged' | 'error';
  timestamp?: number;
  state?: 'playing' | 'paused';
  message?: string;
}

export function useSyncWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/sync`;
    
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
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setIsConnected(false);
      
      // Tentar reconectar após 3 segundos
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
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

