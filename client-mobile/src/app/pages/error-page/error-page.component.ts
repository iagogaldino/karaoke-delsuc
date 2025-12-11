import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="container">
      <mat-card>
        <mat-card-content>
          <div class="error-content">
            <mat-icon class="error-icon">error</mat-icon>
            <h1 class="error-title">Erro</h1>
            <p class="error-message">{{ errorMessage }}</p>
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
      background: #0a0a0a;
    }
    mat-card {
      max-width: 400px;
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
    }
    .error-content {
      text-align: center;
      padding: 40px 20px;
    }
    .error-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #f44336;
      margin-bottom: 20px;
    }
    .error-title {
      color: #f44336;
      font-size: 24px;
      margin-bottom: 15px;
    }
    .error-message {
      color: rgba(255, 255, 255, 0.7);
      font-size: 16px;
      line-height: 1.5;
    }
  `]
})
export class ErrorPageComponent implements OnInit {
  errorMessage = 'Ocorreu um erro desconhecido';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const message = this.route.snapshot.queryParamMap.get('message');
    if (message) {
      this.errorMessage = message;
    }
  }
}

