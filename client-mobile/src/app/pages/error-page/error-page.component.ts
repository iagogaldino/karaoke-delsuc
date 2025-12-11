import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule],
  template: `
    <div class="container">
      <div class="error-content">
        <div class="error-icon-wrapper">
          <mat-icon class="error-icon">error_outline</mat-icon>
        </div>
        <h1 class="error-title">Ops!</h1>
        <p class="error-message">{{ errorMessage }}</p>
        <button mat-raised-button color="primary" class="back-btn" (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
          <span>Voltar</span>
        </button>
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

    .error-content {
      text-align: center;
      padding: 40px 24px;
      max-width: 400px;
      width: 100%;
    }

    .error-icon-wrapper {
      margin-bottom: 30px;
      animation: shake 0.5s ease;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-10px); }
      75% { transform: translateX(10px); }
    }

    .error-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: white;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
    }

    .error-title {
      color: var(--spotify-white);
      font-size: 32px;
      font-weight: 700;
      margin: 0 0 20px 0;
    }

    .error-message {
      color: var(--spotify-light-gray);
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 32px;
    }

    .back-btn {
      padding: 14px 28px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 50px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--spotify-green);
      color: var(--spotify-black);
      border: none;
    }

    .back-btn:hover {
      background: var(--spotify-green-hover);
      transform: scale(1.05);
    }

    .back-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    @media (max-width: 480px) {
      .error-content {
        padding: 30px 20px;
      }

      .error-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
      }

      .error-title {
        font-size: 26px;
      }
    }
  `]
})
export class ErrorPageComponent implements OnInit {
  errorMessage = 'Ocorreu um erro desconhecido';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  goBack(): void {
    this.router.navigate(['/']);
  }

  ngOnInit(): void {
    const message = this.route.snapshot.queryParamMap.get('message');
    if (message) {
      this.errorMessage = message;
    }
  }
}

