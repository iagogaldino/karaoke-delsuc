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
      <mat-card>
        <mat-card-header>
          <mat-card-title>🎤 Selecionar Música</mat-card-title>
          <mat-card-subtitle>Olá, <strong>{{ userName }}</strong>! Escolha uma música para cantar.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field appearance="outline" class="search-box">
            <mat-label>Buscar música</mat-label>
            <input matInput [(ngModel)]="searchTerm" (input)="filterSongs()" placeholder="Digite para buscar...">
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>

          <div *ngIf="loading" class="loading">
            <mat-spinner></mat-spinner>
            <p>Carregando músicas...</p>
          </div>

          <div *ngIf="!loading && filteredSongs.length === 0" class="empty">
            <p>Nenhuma música disponível no momento.</p>
          </div>

          <div *ngIf="!loading && filteredSongs.length > 0" class="songs-list">
            <div *ngFor="let song of filteredSongs" class="song-item" (click)="selectSong(song.id)">
              <div class="song-info">
                <div class="song-name">{{ song.displayName || song.name }}</div>
                <div *ngIf="song.artist" class="song-artist">{{ song.artist }}</div>
              </div>
              <mat-icon>chevron_right</mat-icon>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .container {
      min-height: 100vh;
      padding: 20px;
      background: #0a0a0a;
    }
    mat-card {
      max-width: 600px;
      margin: 0 auto;
      background: rgba(255, 255, 255, 0.05);
    }
    mat-card-header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    mat-card-title {
      color: #ffffff;
      font-size: 28px;
      margin-bottom: 10px;
    }
    mat-card-subtitle {
      color: rgba(255, 255, 255, 0.7);
      font-size: 14px;
    }
    .search-box {
      width: 100%;
      margin-bottom: 20px;
    }
    ::ng-deep .mat-mdc-form-field {
      --mdc-filled-text-field-container-color: rgba(255, 255, 255, 0.05);
      --mdc-filled-text-field-input-text-color: #ffffff;
    }
    ::ng-deep .mat-mdc-form-field .mat-mdc-text-field-wrapper {
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
    }
    .loading, .empty {
      text-align: center;
      padding: 40px;
      color: rgba(255, 255, 255, 0.5);
    }
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }
    .songs-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: calc(100vh - 300px);
      overflow-y: auto;
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
      background: rgba(255, 255, 255, 0.03);
    }
    .song-item:hover {
      border-color: rgba(102, 126, 234, 0.5);
      background: rgba(102, 126, 234, 0.1);
      transform: translateX(5px);
    }
    .song-item:active {
      transform: scale(0.98);
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
    }
    .song-artist {
      color: rgba(255, 255, 255, 0.6);
      font-size: 14px;
      word-wrap: break-word;
    }
    .song-item mat-icon {
      color: rgba(255, 255, 255, 0.5);
      transition: color 0.3s;
    }
    .song-item:hover mat-icon {
      color: #667eea;
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
        this.router.navigate(['/player', this.qrId]);
      },
      error: (error) => {
        this.snackBar.open(error.error?.error || 'Erro ao selecionar música', 'OK', { duration: 3000 });
      }
    });
  }
}

