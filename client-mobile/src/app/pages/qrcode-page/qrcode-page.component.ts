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
      <mat-card>
        <mat-card-content>
          <div class="spinner-container">
            <mat-spinner></mat-spinner>
            <p>Verificando QR Code...</p>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    mat-card {
      max-width: 400px;
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
    }
    .spinner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding: 40px;
    }
    p {
      color: rgba(255, 255, 255, 0.7);
      margin: 0;
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
      next: (status) => {
        if (!status.isValid) {
          this.router.navigate(['/error'], { queryParams: { message: 'QR Code já foi utilizado' } });
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

