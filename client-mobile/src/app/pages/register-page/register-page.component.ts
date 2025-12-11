import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
    <div class="container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>🎤 Karaokê</mat-card-title>
          <mat-card-subtitle>Insira seus dados para começar</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Seu telefone</mat-label>
              <input matInput formControlName="phone" type="tel" placeholder="(00) 00000-0000" maxlength="15">
              <mat-icon matPrefix>phone</mat-icon>
            </mat-form-field>

            <div *ngIf="userFound" class="user-found">
              ✅ Usuário encontrado! Nome carregado automaticamente.
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Seu nome</mat-label>
              <input matInput formControlName="name" type="text" placeholder="Digite seu nome" maxlength="50">
              <mat-icon matPrefix>person</mat-icon>
            </mat-form-field>

            <div class="photo-section">
              <label>Tire uma selfie *</label>
              <div class="photo-preview-wrapper">
                <img *ngIf="photoPreview" [src]="photoPreview" class="photo-preview" alt="Preview">
              </div>
              <input type="file" #fileInput accept="image/*" capture="user" (change)="onPhotoSelected($event)" style="display: none;">
              <button type="button" mat-raised-button color="primary" (click)="fileInput.click()" [disabled]="isSubmitting">
                <mat-icon>camera_alt</mat-icon>
                {{ photoPreview ? 'Foto Capturada' : 'Tirar Selfie' }}
              </button>
              <button *ngIf="photoPreview" type="button" mat-stroked-button (click)="retakePhoto()" [disabled]="isSubmitting">
                <mat-icon>refresh</mat-icon>
                Tirar Outra Foto
              </button>
            </div>

            <button mat-raised-button color="primary" type="submit" class="full-width submit-btn" [disabled]="registerForm.invalid || !photoFile || isSubmitting">
              {{ isSubmitting ? 'Enviando...' : 'Confirmar' }}
            </button>
          </form>
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
    mat-card-header {
      text-align: center;
      margin-bottom: 20px;
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
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
    ::ng-deep .mat-mdc-form-field {
      --mdc-filled-text-field-container-color: rgba(255, 255, 255, 0.05);
      --mdc-filled-text-field-input-text-color: #ffffff;
    }
    ::ng-deep .mat-mdc-form-field .mat-mdc-text-field-wrapper {
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
    }
    ::ng-deep .mat-mdc-form-field .mat-mdc-text-field-wrapper:hover {
      border-color: rgba(102, 126, 234, 0.5);
    }
    ::ng-deep .mat-mdc-form-field .mat-mdc-text-field-wrapper.mdc-text-field--focused {
      border-color: #667eea;
    }
    ::ng-deep .mat-mdc-form-field-label {
      color: rgba(255, 255, 255, 0.9) !important;
    }
    ::ng-deep .mat-mdc-input-element::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }
    .user-found {
      background: rgba(76, 175, 80, 0.15);
      border: 1px solid rgba(76, 175, 80, 0.3);
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
      color: #4caf50;
    }
    .photo-section {
      margin-bottom: 24px;
      text-align: center;
    }
    .photo-section label {
      display: block;
      margin-bottom: 16px;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 500;
    }
    .photo-preview-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 16px;
      min-height: 200px;
    }
    .photo-preview {
      width: 200px;
      height: 200px;
      border-radius: 50%;
      object-fit: cover;
      border: 4px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }
    .submit-btn {
      margin-top: 16px;
      padding: 16px;
      font-size: 16px;
      font-weight: 600;
    }
    button[mat-raised-button] {
      margin-bottom: 8px;
    }
  `]
})
export class RegisterPageComponent implements OnInit {
  registerForm: FormGroup;
  photoFile: File | null = null;
  photoPreview: string | null = null;
  userFound = false;
  isSubmitting = false;
  qrId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {
    this.registerForm = this.fb.group({
      phone: ['', [Validators.required, Validators.minLength(10)]],
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]]
    });
  }

  ngOnInit(): void {
    this.qrId = this.route.snapshot.paramMap.get('qrId');
    if (!this.qrId) {
      this.router.navigate(['/error'], { queryParams: { message: 'QR Code inválido' } });
      return;
    }

    // Máscara de telefone e busca automática
    this.registerForm.get('phone')?.valueChanges.pipe(
      debounceTime(1000),
      distinctUntilChanged()
    ).subscribe(value => {
      const phone = value.replace(/\D/g, '');
      if (phone.length >= 10) {
        this.apiService.getUserByPhone(phone).pipe(
          catchError(() => of(null))
        ).subscribe(user => {
          if (user) {
            this.registerForm.patchValue({ name: user.name }, { emitEvent: false });
            this.userFound = true;
          } else {
            this.userFound = false;
          }
        });
      } else {
        this.userFound = false;
      }
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.photoFile = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.photoPreview = e.target?.result as string;
      };
      reader.readAsDataURL(this.photoFile);
    }
  }

  retakePhoto(): void {
    this.photoFile = null;
    this.photoPreview = null;
  }

  onSubmit(): void {
    if (this.registerForm.invalid || !this.photoFile || !this.qrId) {
      return;
    }

    this.isSubmitting = true;
    const { name, phone } = this.registerForm.value;
    const normalizedPhone = phone.replace(/\D/g, '');

    // Primeiro fazer upload da foto
    this.apiService.uploadPhoto(this.qrId, this.photoFile).subscribe({
      next: (photoData) => {
        // Depois enviar os dados
        this.apiService.submitName(this.qrId!, name.trim(), normalizedPhone, photoData.photo).subscribe({
          next: () => {
            this.snackBar.open('Dados registrados com sucesso!', 'OK', { duration: 2000 });
            setTimeout(() => {
              this.router.navigate(['/songs', this.qrId]);
            }, 1500);
          },
          error: (error) => {
            this.isSubmitting = false;
            this.snackBar.open(error.error?.error || 'Erro ao registrar dados', 'OK', { duration: 3000 });
          }
        });
      },
      error: (error) => {
        this.isSubmitting = false;
        this.snackBar.open(error.error?.error || 'Erro ao fazer upload da foto', 'OK', { duration: 3000 });
      }
    });
  }
}

