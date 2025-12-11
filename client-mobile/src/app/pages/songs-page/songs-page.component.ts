import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService, Song } from '../../services/api.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-songs-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    FormsModule,
    MatSnackBarModule
  ],
  template: `
    <div class="container">
      <div class="header">
        <div class="header-content">
          <h1>🎤 Selecionar Música</h1>
          <p class="greeting">Olá, <strong>{{ userName }}</strong>!</p>
          <p class="subtitle">Escolha uma música para cantar</p>
        </div>
      </div>

      <div class="content">
        <div class="search-wrapper">
          <mat-form-field appearance="fill" class="search-box">
            <mat-label>Buscar música</mat-label>
            <input matInput [(ngModel)]="searchTerm" (input)="filterSongs()" placeholder="Digite para buscar...">
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>
        </div>

        <div class="songs-container">
          <div *ngIf="loading" class="loading">
            <mat-spinner diameter="50"></mat-spinner>
            <p>Carregando músicas...</p>
          </div>

          <div *ngIf="!loading && filteredSongs.length === 0" class="empty">
            <mat-icon>music_off</mat-icon>
            <p>Nenhuma música disponível no momento.</p>
          </div>

          <div *ngIf="!loading && filteredSongs.length > 0" class="songs-list">
            <div *ngFor="let song of filteredSongs; trackBy: trackBySongId" class="song-item" (click)="selectSong(song.id)">
              <div class="song-icon-wrapper">
                <mat-icon class="song-icon">music_note</mat-icon>
              </div>
              <div class="song-info">
                <div class="song-name">{{ song.displayName || song.name }}</div>
                <div *ngIf="song.artist" class="song-artist">{{ song.artist }}</div>
              </div>
              <mat-icon class="chevron">chevron_right</mat-icon>
            </div>
          </div>
        </div>
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
    }

    .header {
      padding: 50px 20px 30px;
      color: var(--spotify-white);
      text-align: center;
      position: relative;
      background: linear-gradient(180deg, rgba(29, 185, 84, 0.1) 0%, transparent 100%);
    }

    .header-content h1 {
      font-size: 32px;
      font-weight: 700;
      margin: 0 0 12px 0;
      text-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }

    .greeting {
      font-size: 18px;
      margin: 0 0 8px 0;
      opacity: 0.95;
    }

    .greeting strong {
      font-weight: 700;
      color: var(--spotify-green);
    }

    .subtitle {
      font-size: 14px;
      opacity: 0.85;
      margin: 0;
    }

    .content {
      flex: 1;
      background: var(--spotify-dark-gray);
      border-radius: 30px 30px 0 0;
      margin-top: -20px;
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .search-wrapper {
      flex-shrink: 0;
      background: var(--spotify-dark-gray);
      padding: 24px 16px 20px;
      border-bottom: 1px solid var(--spotify-gray);
    }

    .search-box {
      width: 100%;
    }

    .songs-container {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      min-height: 0;
    }

    ::ng-deep .mat-mdc-form-field {
      --mdc-filled-text-field-container-color: var(--spotify-gray);
      --mdc-filled-text-field-input-text-color: var(--spotify-white);
      --mdc-filled-text-field-label-text-color: var(--spotify-light-gray);
      --mdc-filled-text-field-focus-label-text-color: var(--spotify-green);
      --mdc-filled-text-field-focus-active-indicator-color: var(--spotify-green);
    }

    ::ng-deep .mat-mdc-form-field .mat-mdc-text-field-wrapper {
      border-radius: 8px;
      padding: 4px 16px;
      background: var(--spotify-gray) !important;
    }

    ::ng-deep .mat-mdc-form-field .mat-mdc-text-field-wrapper:hover {
      background: var(--spotify-gray) !important;
    }

    ::ng-deep .mat-mdc-form-field .mat-mdc-text-field-wrapper.mdc-text-field--focused {
      background: var(--spotify-gray) !important;
      box-shadow: 0 0 0 2px var(--spotify-green);
    }

    .loading, .empty {
      text-align: center;
      padding: 60px 20px;
      color: rgba(255, 255, 255, 0.6);
      min-height: 200px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .loading {
      gap: 24px;
    }

    .empty {
      gap: 16px;
    }

    .empty mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      opacity: 0.5;
    }

    .songs-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 20px 16px;
    }

    .song-item {
      padding: 18px 20px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      gap: 16px;
      position: relative;
      overflow: hidden;
    }

    .song-item::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 0;
      background: linear-gradient(90deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
      transition: width 0.3s ease;
    }

    .song-item:active {
      transform: scale(0.98);
    }

    .song-item:active::before {
      width: 100%;
    }

    .song-icon-wrapper {
      width: 56px;
      height: 56px;
      border-radius: 8px;
      background: rgba(29, 185, 84, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .song-icon {
      color: var(--spotify-green);
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .song-info {
      flex: 1;
      min-width: 0;
    }

    .song-name {
      font-weight: 600;
      color: var(--spotify-white);
      font-size: 16px;
      margin-bottom: 6px;
      word-wrap: break-word;
      line-height: 1.4;
    }

    .song-artist {
      color: var(--spotify-light-gray);
      font-size: 14px;
      word-wrap: break-word;
      line-height: 1.3;
    }

    .chevron {
      color: var(--spotify-light-gray);
      font-size: 24px;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }

    .song-item:hover .chevron {
      color: var(--spotify-green);
      transform: translateX(4px);
    }

    @media (max-width: 480px) {
      .header {
        padding: 40px 16px 24px;
      }

      .header-content h1 {
        font-size: 26px;
      }

      .content {
        padding: 20px 12px;
        border-radius: 25px 25px 0 0;
      }

      .song-item {
        padding: 16px;
        gap: 14px;
      }

      .song-icon-wrapper {
        width: 48px;
        height: 48px;
      }

      .song-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      .song-name {
        font-size: 16px;
      }
    }

    /* Safe area para iPhone */
    @supports (padding: max(0px)) {
      .content {
        padding-bottom: max(24px, env(safe-area-inset-bottom));
      }
    }
  `]
})
export class SongsPageComponent implements OnInit {
  songs: Song[] = [];
  filteredSongs: Song[] = [];
  searchTerm = '';
  loading = true;
  qrId: string | null = null;
  userName = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.qrId = this.route.snapshot.paramMap.get('qrId');
    if (!this.qrId) {
      this.router.navigate(['/error'], { queryParams: { message: 'QR Code inválido' } });
      return;
    }

    // Buscar status do QR code para obter o nome do usuário
    this.apiService.getQRCodeStatus(this.qrId).subscribe({
      next: (status) => {
        this.userName = status.userName || 'Usuário';
        
        // Se já tiver música selecionada, redirecionar para o player
        if (status.songSelected && status.songId) {
          this.router.navigate(['/player', this.qrId], { replaceUrl: true });
          return;
        }
        
        this.loadSongs();
      },
      error: () => {
        this.loadSongs();
      }
    });
  }

  loadSongs(): void {
    this.apiService.getAllSongs().subscribe({
      next: (response) => {
        this.songs = (response.songs || []).filter(song => song.status.ready);
        this.filteredSongs = this.songs;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open('Erro ao carregar músicas', 'OK', { duration: 3000 });
      }
    });
  }

  filterSongs(): void {
    if (!this.searchTerm.trim()) {
      this.filteredSongs = this.songs;
      return;
    }

    const search = this.searchTerm.toLowerCase();
    this.filteredSongs = this.songs.filter(song =>
      (song.displayName || song.name).toLowerCase().includes(search) ||
      (song.artist || '').toLowerCase().includes(search)
    );
  }

  selectSong(songId: string): void {
    if (!this.qrId) return;

    this.apiService.selectSong(this.qrId, songId).subscribe({
      next: () => {
        // Usar replaceUrl para remover a página de músicas do histórico
        // Assim o usuário não pode voltar usando o botão voltar do navegador
        this.router.navigate(['/player', this.qrId], { replaceUrl: true });
      },
      error: (error) => {
        this.snackBar.open(error.error?.error || 'Erro ao selecionar música', 'OK', { duration: 3000 });
      }
    });
  }

  trackBySongId(index: number, song: Song): string {
    return song.id;
  }
}

