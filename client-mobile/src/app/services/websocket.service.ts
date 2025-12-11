import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface WebSocketMessage {
  type: string;
  state?: 'playing' | 'paused';
  timestamp?: number;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageSubject = new Subject<WebSocketMessage>();
  public messages$ = this.messageSubject.asObservable();

  connect(host?: string): void {
    // Se não fornecido, usar o host atual
    if (!host) {
      host = window.location.host;
      // Se não for localhost, usar apenas o IP (sem porta do Angular)
      if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
        const ip = host.split(':')[0];
        host = `${ip}:3001`; // Porta do backend
      } else {
        host = `${host.split(':')[0]}:3001`; // Porta do backend
      }
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${host}/ws/sync`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        // Solicitar estado atual
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'getTime' }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.messageSubject.next(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Tentar reconectar após 3 segundos
        setTimeout(() => this.connect(), 3000);
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
    }
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  play(): void {
    this.send({ type: 'play' });
  }

  pause(): void {
    this.send({ type: 'pause' });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

