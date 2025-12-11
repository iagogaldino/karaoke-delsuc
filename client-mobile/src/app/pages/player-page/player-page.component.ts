import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { WebSocketService } from '../../services/websocket.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-player-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule
  ],
  template: `
    <div class="container">
      <mat-card>
        <mat-card-content>
          <div class="song-info">
            <div class="song-icon">🎤</div>
            <div class="song-title">{{ songName }}</div>
            <div *ngIf="artist" class="song-artist">{{ artist }}</div>
            <div class="user-name">Cantando: {{ userName }}</div>
          </div>

          <div class="player-controls">
            <button mat-fab color="primary" class="play-pause-btn" (click)="togglePlayPause()" [disabled]="!connected">
              <mat-icon>{{ isPlaying ? 'pause' : 'play_arrow' }}</mat-icon>
            </button>

            <div class="progress-container">
              <mat-progress-bar mode="determinate" [value]="progress"></mat-progress-bar>
              <div class="time-display">
                <span>{{ formatTime(currentTime) }}</span>
                <span>{{ formatTime(duration) }}</span>
              </div>
            </div>
          </div>

          <div class="status" [class.connected]="connected" [class.disconnected]="!connected">
            {{ statusMessage }}
          </div>

          <div class="control-hint">Você pode controlar o karaokê pelo celular</div>
        </mat-card-content>
      </mat-card>

      <div class="give-up-wrapper">
        <button mat-stroked-button color="warn" class="give-up-btn" (click)="giveUp()" [disabled]="isGivingUp">
          <mat-icon>close</mat-icon>
          {{ isGivingUp ? 'Desistindo...' : 'Desistir' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .container {
      min-height: 100vh;
      padding: 20px;
      padding-bottom: 100px;
      background: #0a0a0a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    mat-card {
      max-width: 500px;
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
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
      margin: 0 auto 30px;
      display: block;
    }
    .play-pause-btn mat-icon {
      font-size: 32px;
    }
    .progress-container {
      margin-bottom: 15px;
    }
    ::ng-deep .mat-mdc-progress-bar {
      height: 6px;
      border-radius: 3px;
    }
    .time-display {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      opacity: 0.7;
      color: rgba(255, 255, 255, 0.7);
      margin-top: 12px;
    }
    .status {
      text-align: center;
      padding: 10px;
      border-radius: 8px;
      margin-top: 20px;
      font-size: 14px;
    }
    .status.connected {
      background: rgba(76, 175, 80, 0.15);
      border: 1px solid rgba(76, 175, 80, 0.3);
      color: #4caf50;
    }
    .status.disconnected {
      background: rgba(211, 47, 47, 0.15);
      border: 1px solid rgba(211, 47, 47, 0.3);
      color: #f44336;
    }
    .control-hint {
      text-align: center;
      font-size: 12px;
      opacity: 0.5;
      margin-top: 20px;
      color: rgba(255, 255, 255, 0.5);
    }
    .give-up-wrapper {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 20px;
      background: #0a0a0a;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 100;
    }
    .give-up-btn {
      width: 100%;
      max-width: 500px;
      margin: 0 auto;
      display: block;
      padding: 16px;
    }
  `]
})
export class PlayerPageComponent implements OnInit, OnDestroy {
  qrId: string | null = null;
  songName = '';
  artist = '';
  userName = '';
  isPlaying = false;
  currentTime = 0;
  duration = 0;
  progress = 0;
  connected = false;
  statusMessage = 'Conectando...';
  isGivingUp = false;
  private wsSubscription?: Subscription;
  private updateInterval?: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private wsService: WebSocketService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.qrId = this.route.snapshot.paramMap.get('qrId');
    if (!this.qrId) {
      this.router.navigate(['/error'], { queryParams: { message: 'QR Code inválido' } });
      return;
    }

    this.loadSongInfo();
    this.connectWebSocket();
    this.startUpdateInterval();
  }

  ngOnDestroy(): void {
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.wsService.disconnect();
  }

  loadSongInfo(): void {
    // Buscar informações do QR code para obter nome do usuário e música
    this.apiService.getQRCodeStatus(this.qrId!).subscribe({
      next: (status) => {
        this.userName = status.userName || 'Usuário';
        if (status.song) {
          this.songName = status.song.displayName || status.song.name;
          this.artist = status.song.artist || '';
          this.duration = status.song.duration;
        }
      },
      error: () => {
        // Continuar mesmo se houver erro
      }
    });
  }

  connectWebSocket(): void {
    // Obter host da URL atual
    const host = window.location.host;
    
    this.wsService.connect(host);
    
    this.wsSubscription = this.wsService.messages$.subscribe(message => {
      switch (message.type) {
        case 'stateChanged':
          this.isPlaying = message.state === 'playing';
          if (message.timestamp !== undefined) {
            this.currentTime = message.timestamp;
            this.updateProgress();
          }
          break;
        case 'timeUpdate':
          this.currentTime = message.timestamp || 0;
          this.updateProgress();
          break;
      }
    });

    // Simular conexão (em produção, o WebSocketService deve emitir eventos de conexão)
    setTimeout(() => {
      this.connected = true;
      this.statusMessage = '✓ Conectado ao karaokê';
    }, 1000);
  }

  startUpdateInterval(): void {
    this.updateInterval = setInterval(() => {
      if (this.isPlaying && this.duration > 0) {
        this.currentTime += 0.1;
        if (this.currentTime > this.duration) {
          this.currentTime = this.duration;
          this.isPlaying = false;
        }
        this.updateProgress();
      }
    }, 100);
  }

  updateProgress(): void {
    this.progress = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
  }

  togglePlayPause(): void {
    if (!this.connected) {
      this.snackBar.open('Aguardando conexão...', 'OK', { duration: 2000 });
      return;
    }

    if (this.isPlaying) {
      this.wsService.pause();
    } else {
      this.wsService.play();
    }
  }

  giveUp(): void {
    if (!confirm('Tem certeza que deseja desistir desta música?')) {
      return;
    }

    if (!this.qrId) return;

    this.isGivingUp = true;
    this.apiService.giveUp(this.qrId).subscribe({
      next: () => {
        this.snackBar.open('Você desistiu da música', 'OK', { duration: 2000 });
        setTimeout(() => {
          this.router.navigate(['/songs', this.qrId]);
        }, 1500);
      },
      error: (error) => {
        this.isGivingUp = false;
        this.snackBar.open(error.error?.error || 'Erro ao desistir', 'OK', { duration: 3000 });
      }
    });
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

