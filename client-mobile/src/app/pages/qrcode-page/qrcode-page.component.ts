import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-qrcode-page',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatCardModule],
  template: `
    <div class="container">
      <div class="content">
        <div class="logo">🎤</div>
        <div class="spinner-container">
          <mat-spinner diameter="60"></mat-spinner>
          <p>Verificando QR Code...</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      background: var(--spotify-black);
    }

    .content {
      text-align: center;
      max-width: 400px;
      width: 100%;
    }

    .logo {
      font-size: 80px;
      margin-bottom: 40px;
      animation: float 3s ease-in-out infinite;
      filter: drop-shadow(0 10px 20px rgba(0,0,0,0.2));
    }

    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }

    .spinner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }

    p {
      color: rgba(255, 255, 255, 0.9);
      margin: 0;
      font-size: 16px;
      font-weight: 500;
    }

    ::ng-deep .mat-mdc-progress-spinner circle {
      stroke: white !important;
    }
  `]
})
export class QrcodePageComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    const qrId = this.route.snapshot.paramMap.get('qrId');
    if (!qrId) {
      this.router.navigate(['/error'], { queryParams: { message: 'QR Code inválido' } });
      return;
    }

    this.apiService.getQRCodeStatus(qrId).subscribe({
      next: (status: any) => {
        if (!status.isValid) {
          this.router.navigate(['/error'], { queryParams: { message: 'QR Code já foi utilizado' } });
          return;
        }

        // Se o usuário desistiu, redirecionar para página de erro
        if (status.gaveUp) {
          this.router.navigate(['/error'], { 
            queryParams: { message: 'Você desistiu e não pode mais escolher músicas. Escaneie um novo QR code para participar novamente.' }
          });
          return;
        }

        if (status.nameSubmitted) {
          // Verificar se tem música selecionada (precisa verificar de outra forma)
          // Por enquanto, redireciona para lista de músicas
          this.router.navigate(['/songs', qrId]);
        } else {
          this.router.navigate(['/register', qrId]);
        }
      },
      error: (error) => {
        if (error.status === 404 || error.status === 410) {
          this.router.navigate(['/error'], { queryParams: { message: 'QR Code não encontrado ou expirado' } });
        } else {
          this.router.navigate(['/error'], { queryParams: { message: 'Erro ao verificar QR Code' } });
        }
      }
    });
  }
}

