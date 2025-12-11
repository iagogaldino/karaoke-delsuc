import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, Location } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { WebSocketService } from '../../services/websocket.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="container">
      <div class="header-gradient"></div>
      
      <div class="content">
        <div class="song-info">
          <div class="song-icon-wrapper">
            <div class="song-icon">🎤</div>
            <div *ngIf="isPlaying" class="pulse-ring"></div>
          </div>
          <h1 class="song-title">{{ songName || 'Carregando...' }}</h1>
          <p *ngIf="artist" class="song-artist">{{ artist }}</p>
          <div class="user-badge">
            <mat-icon>person</mat-icon>
            <span>{{ userName }}</span>
          </div>
        </div>

        <div class="player-controls">
          <button class="play-pause-btn" (click)="togglePlayPause()" [disabled]="!connected" [class.playing]="isPlaying">
            <mat-icon class="play-icon">{{ isPlaying ? 'pause' : 'play_arrow' }}</mat-icon>
            <div *ngIf="!connected" class="loading-overlay">
              <mat-spinner diameter="30"></mat-spinner>
            </div>
          </button>

          <div class="progress-container">
            <div class="progress-bar-wrapper">
              <div class="progress-bar" [style.width.%]="progress">
                <div class="progress-glow"></div>
              </div>
            </div>
            <div class="time-display">
              <span>{{ formatTime(currentTime) }}</span>
              <span>{{ formatTime(duration) }}</span>
            </div>
          </div>
        </div>

        <div class="status-badge" [class.connected]="connected" [class.disconnected]="!connected">
          <mat-icon>{{ connected ? 'wifi' : 'wifi_off' }}</mat-icon>
          <span>{{ statusMessage }}</span>
        </div>

        <p class="control-hint">Controle o karaokê pelo celular</p>
      </div>

      <div class="give-up-wrapper">
        <button class="give-up-btn" (click)="giveUp()" [disabled]="isGivingUp">
          <mat-icon>{{ isGivingUp ? 'hourglass_empty' : 'close' }}</mat-icon>
          <span>{{ isGivingUp ? 'Desistindo...' : 'Desistir' }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .container {
      min-height: 100vh;
      padding: 0;
      background: var(--spotify-black);
      display: flex;
      flex-direction: column;
      position: relative;
      overflow-x: hidden;
    }

    .header-gradient {
      height: 40vh;
      background: linear-gradient(180deg, rgba(29, 185, 84, 0.2) 0%, transparent 100%);
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 0;
    }

    .content {
      flex: 1;
      padding: 40px 20px 120px;
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 500px;
      margin: 0 auto;
      width: 100%;
    }

    .song-info {
      text-align: center;
      margin-bottom: 50px;
      width: 100%;
      padding-bottom: 30px;
      border-bottom: 1px solid var(--spotify-gray);
    }

    .song-icon-wrapper {
      position: relative;
      display: inline-block;
      margin-bottom: 24px;
    }

    .song-icon {
      font-size: 80px;
      filter: drop-shadow(0 10px 20px rgba(0,0,0,0.3));
      animation: float 3s ease-in-out infinite;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }

    .pulse-ring {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 100px;
      height: 100px;
      border: 2px solid rgba(102, 126, 234, 0.5);
      border-radius: 50%;
      animation: pulse 2s ease-out infinite;
    }

    @keyframes pulse {
      0% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
      100% {
        transform: translate(-50%, -50%) scale(1.5);
        opacity: 0;
      }
    }

    .song-title {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 12px 0;
      word-wrap: break-word;
      color: var(--spotify-white);
      line-height: 1.3;
    }

    .song-artist {
      font-size: 18px;
      opacity: 0.8;
      margin: 0 0 20px 0;
      word-wrap: break-word;
      color: var(--spotify-light-gray);
    }

    .user-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: var(--spotify-gray);
      border-radius: 20px;
      font-size: 14px;
      color: var(--spotify-white);
    }

    .user-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .player-controls {
      width: 100%;
      margin-bottom: 30px;
    }

    .play-pause-btn {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: var(--spotify-green);
      border: none;
      color: var(--spotify-black);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 40px;
      box-shadow: 0 10px 40px rgba(29, 185, 84, 0.3);
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .play-pause-btn::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      transform: translate(-50%, -50%);
      transition: width 0.3s, height 0.3s;
    }

    .play-pause-btn:active::before {
      width: 100px;
      height: 100px;
    }

    .play-pause-btn:hover:not(:disabled) {
      transform: scale(1.05);
      background: var(--spotify-green-hover);
      box-shadow: 0 15px 50px rgba(29, 185, 84, 0.5);
    }

    .play-pause-btn:active:not(:disabled) {
      transform: scale(0.95);
    }

    .play-pause-btn.playing {
      animation: pulse-glow 2s ease-in-out infinite;
    }

    @keyframes pulse-glow {
      0%, 100% {
        box-shadow: 0 10px 40px rgba(29, 185, 84, 0.4);
      }
      50% {
        box-shadow: 0 10px 50px rgba(29, 185, 84, 0.7);
      }
    }

    .play-pause-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .play-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      position: relative;
      z-index: 1;
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 50%;
    }

    .progress-container {
      width: 100%;
    }

    .progress-bar-wrapper {
      width: 100%;
      height: 6px;
      background: var(--spotify-gray);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 16px;
      position: relative;
    }

    .progress-bar {
      height: 100%;
      background: var(--spotify-green);
      border-radius: 3px;
      transition: width 0.1s linear;
      position: relative;
      overflow: hidden;
    }

    .progress-glow {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%);
      animation: shimmer 2s infinite;
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .time-display {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      color: var(--spotify-light-gray);
      font-weight: 500;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 20px;
      font-size: 14px;
      margin-bottom: 20px;
      transition: all 0.3s ease;
    }

    .status-badge.connected {
      background: rgba(29, 185, 84, 0.2);
      border: 1px solid rgba(29, 185, 84, 0.4);
      color: var(--spotify-green);
    }

    .status-badge.disconnected {
      background: rgba(211, 47, 47, 0.2);
      border: 1px solid rgba(211, 47, 47, 0.4);
      color: #f44336;
    }

    .status-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .control-hint {
      text-align: center;
      font-size: 13px;
      color: var(--spotify-light-gray);
      margin: 0;
    }

    .give-up-wrapper {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 20px;
      background: var(--spotify-dark-gray);
      backdrop-filter: blur(20px);
      border-top: 1px solid var(--spotify-gray);
      z-index: 100;
    }

    .give-up-btn {
      width: 100%;
      max-width: 500px;
      margin: 0 auto;
      padding: 16px 24px;
      background: transparent;
      border: 2px solid var(--spotify-gray);
      border-radius: 50px;
      color: var(--spotify-light-gray);
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all 0.2s ease;
    }

    .give-up-btn:hover:not(:disabled) {
      background: var(--spotify-gray);
      border-color: var(--spotify-gray);
      color: var(--spotify-white);
      transform: scale(1.02);
    }

    .give-up-btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .give-up-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .give-up-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    @media (max-width: 480px) {
      .header-gradient {
        height: 35vh;
      }

      .content {
        padding: 30px 16px 120px;
      }

      .song-icon {
        font-size: 64px;
      }

      .song-title {
        font-size: 24px;
      }

      .song-artist {
        font-size: 16px;
      }

      .play-pause-btn {
        width: 90px;
        height: 90px;
      }

      .play-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
      }

      .give-up-wrapper {
        padding: 16px;
      }
    }

    /* Safe area para iPhone */
    @supports (padding: max(0px)) {
      .give-up-wrapper {
        padding-bottom: max(20px, env(safe-area-inset-bottom));
      }
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
    private location: Location,
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

    // Prevenir que o usuário volte para a página de seleção de músicas
    // Substituir o histórico para que não haja página anterior
    this.location.replaceState(`/player/${this.qrId}`);
    
    // Interceptar tentativas de voltar usando o botão do navegador
    this.preventBackNavigation();

    this.loadSongInfo();
    this.connectWebSocket();
    this.startUpdateInterval();
  }

  preventBackNavigation(): void {
    // Adicionar uma entrada falsa no histórico para interceptar o botão voltar
    window.history.pushState(null, '', window.location.href);
    
    // Interceptar o evento popstate (quando o usuário tenta voltar)
    window.addEventListener('popstate', this.onPopState);
  }

  onPopState = (event: PopStateEvent): void => {
    // Prevenir a navegação de volta
    event.preventDefault();
    // Manter na mesma página
    window.history.pushState(null, '', window.location.href);
    // Mostrar mensagem ao usuário
    this.snackBar.open('Você não pode voltar após selecionar uma música', 'OK', { duration: 3000 });
  }

  ngOnDestroy(): void {
    // Remover o listener de popstate
    window.removeEventListener('popstate', this.onPopState);
    
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
    // O WebSocketService já detecta o host automaticamente
    this.wsService.connect();
    
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
        // Remover o listener antes de navegar
        window.removeEventListener('popstate', this.onPopState);
        setTimeout(() => {
          // Permitir voltar para seleção de músicas apenas quando desistir
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

