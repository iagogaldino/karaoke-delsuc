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
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

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
    MatSnackBarModule,
    NgxMaskDirective
  ],
  providers: [provideNgxMask()],
  template: `
    <div class="container">
      <div class="header">
        <div class="logo">🎤</div>
        <h1>Karaokê</h1>
        <p class="subtitle">Insira seus dados para começar</p>
      </div>

      <div class="form-wrapper">
        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="form">
          <div class="input-group">
            <mat-form-field appearance="fill" class="full-width">
              <mat-label>Seu telefone</mat-label>
              <input matInput formControlName="phone" type="tel" placeholder="(00) 00000-0000" mask="(00) 00000-0000" [showMaskTyped]="true">
              <mat-icon matPrefix>phone</mat-icon>
            </mat-form-field>

            <div *ngIf="userFound" class="user-found">
              <mat-icon>check_circle</mat-icon>
              <span>Usuário encontrado! {{ existingPhotoPath ? 'Nome e foto carregados automaticamente.' : 'Nome carregado automaticamente.' }}</span>
            </div>
          </div>

          <div class="input-group">
            <mat-form-field appearance="fill" class="full-width">
              <mat-label>Seu nome</mat-label>
              <input matInput formControlName="name" type="text" placeholder="Digite seu nome" maxlength="50">
              <mat-icon matPrefix>person</mat-icon>
            </mat-form-field>
          </div>

          <div class="photo-section">
            <label class="photo-label">
              <mat-icon>camera_alt</mat-icon>
              Tire uma selfie *
            </label>
            <div class="photo-preview-wrapper">
              <div *ngIf="!photoPreview" class="photo-placeholder" (click)="fileInput.click()" [style.cursor]="isSubmitting ? 'not-allowed' : 'pointer'">
                <mat-icon>add_a_photo</mat-icon>
                <span>Toque para tirar foto</span>
              </div>
              <img *ngIf="photoPreview" [src]="photoPreview" class="photo-preview" alt="Preview">
              <div *ngIf="photoPreview" class="photo-overlay">
                <button type="button" class="retake-btn" (click)="retakePhoto()" [disabled]="isSubmitting">
                  <mat-icon>refresh</mat-icon>
                </button>
              </div>
            </div>
            <input type="file" #fileInput accept="image/*" capture="user" (change)="onPhotoSelected($event)" style="display: none;">
            <button type="button" class="camera-btn" (click)="fileInput.click()" [disabled]="isSubmitting">
              <mat-icon>{{ photoPreview ? 'check_circle' : 'camera_alt' }}</mat-icon>
              <span>{{ photoPreview ? 'Foto Capturada' : 'Tirar Selfie' }}</span>
            </button>
          </div>

          <button mat-raised-button type="submit" class="submit-btn" [disabled]="registerForm.invalid || (!photoFile && !existingPhotoPath) || isSubmitting">
            <mat-icon *ngIf="!isSubmitting">check</mat-icon>
            <mat-icon *ngIf="isSubmitting" class="spinning">hourglass_empty</mat-icon>
            <span>{{ isSubmitting ? 'Enviando...' : 'Confirmar' }}</span>
          </button>
        </form>
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

    .header {
      text-align: center;
      padding: 60px 20px 40px;
      color: var(--spotify-white);
      position: relative;
      background: linear-gradient(180deg, rgba(29, 185, 84, 0.1) 0%, transparent 100%);
    }

    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="2" fill="rgba(255,255,255,0.1)"/></svg>') repeat;
      opacity: 0.3;
    }

    .logo {
      font-size: 80px;
      margin-bottom: 20px;
      animation: float 3s ease-in-out infinite;
      filter: drop-shadow(0 10px 20px rgba(0,0,0,0.2));
    }

    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }

    .header h1 {
      font-size: 36px;
      font-weight: 700;
      margin: 0 0 10px 0;
      text-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }

    .subtitle {
      font-size: 16px;
      opacity: 0.95;
      margin: 0;
      font-weight: 400;
    }

    .form-wrapper {
      flex: 1;
      background: var(--spotify-dark-gray);
      border-radius: 30px 30px 0 0;
      padding: 30px 20px;
      margin-top: -20px;
      position: relative;
      z-index: 1;
      overflow-y: auto;
    }

    .form {
      max-width: 500px;
      margin: 0 auto;
    }

    .input-group {
      margin-bottom: 24px;
    }

    .full-width {
      width: 100%;
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
      transition: all 0.2s ease;
      background: var(--spotify-gray) !important;
    }

    ::ng-deep .mat-mdc-form-field .mat-mdc-text-field-wrapper:hover {
      background: var(--spotify-gray) !important;
    }

    ::ng-deep .mat-mdc-form-field .mat-mdc-text-field-wrapper.mdc-text-field--focused {
      background: var(--spotify-gray) !important;
      box-shadow: 0 0 0 2px var(--spotify-green);
    }

    ::ng-deep .mat-mdc-input-element::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }

    .user-found {
      background: rgba(29, 185, 84, 0.1);
      border: 1px solid rgba(29, 185, 84, 0.3);
      padding: 14px 16px;
      border-radius: 8px;
      margin-top: 12px;
      font-size: 14px;
      color: var(--spotify-green);
      display: flex;
      align-items: center;
      gap: 10px;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .user-found mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .photo-section {
      margin-bottom: 32px;
      text-align: center;
    }

    .photo-label {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 20px;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 600;
      font-size: 16px;
    }

    .photo-label mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .photo-preview-wrapper {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 20px;
      min-height: 220px;
    }

    .photo-placeholder {
      width: 220px;
      height: 220px;
      border-radius: 50%;
      border: 3px dashed var(--spotify-gray);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: var(--spotify-light-gray);
      transition: all 0.3s ease;
      background: var(--spotify-gray);
      cursor: pointer;
      user-select: none;
    }

    .photo-placeholder:hover:not(:disabled) {
      border-color: var(--spotify-green);
      background: rgba(29, 185, 84, 0.1);
      transform: scale(1.05);
    }

    .photo-placeholder:active:not(:disabled) {
      transform: scale(0.98);
    }

    .photo-placeholder mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    .photo-preview {
      width: 220px;
      height: 220px;
      border-radius: 50%;
      object-fit: cover;
      border: 5px solid var(--spotify-green);
      box-shadow: 0 10px 40px rgba(29, 185, 84, 0.3);
      animation: scaleIn 0.3s ease;
    }

    @keyframes scaleIn {
      from {
        transform: scale(0.8);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    .photo-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    .retake-btn {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.95);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: all 0.3s ease;
    }

    .retake-btn:hover {
      transform: scale(1.1);
      background: white;
    }

    .retake-btn mat-icon {
      color: #667eea;
    }

    .camera-btn {
      width: 100%;
      padding: 18px 24px;
      background: var(--spotify-gray);
      border: 2px solid var(--spotify-gray);
      border-radius: 8px;
      color: var(--spotify-white);
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      transition: all 0.2s ease;
      margin-bottom: 12px;
    }

    .camera-btn:hover:not(:disabled) {
      background: var(--spotify-gray);
      border-color: var(--spotify-green);
      transform: scale(1.02);
    }

    .camera-btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .camera-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .camera-btn mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .submit-btn {
      width: 100%;
      padding: 18px 24px;
      background: var(--spotify-green);
      color: var(--spotify-black);
      border: none;
      border-radius: 50px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 24px;
      transition: all 0.2s ease;
      text-transform: none;
      letter-spacing: 0;
    }

    .submit-btn:hover:not(:disabled) {
      background: var(--spotify-green-hover);
      transform: scale(1.05);
    }

    .submit-btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .submit-btn mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 480px) {
      .header {
        padding: 50px 20px 30px;
      }

      .logo {
        font-size: 64px;
      }

      .header h1 {
        font-size: 28px;
      }

      .form-wrapper {
        padding: 24px 16px;
        border-radius: 25px 25px 0 0;
      }

      .photo-preview, .photo-placeholder {
        width: 180px;
        height: 180px;
      }

      .photo-preview-wrapper {
        min-height: 180px;
      }
    }

    /* Safe area para iPhone */
    @supports (padding: max(0px)) {
      .container {
        padding-bottom: max(20px, env(safe-area-inset-bottom));
      }
    }
  `]
})
export class RegisterPageComponent implements OnInit {
  registerForm: FormGroup;
  photoFile: File | null = null;
  photoPreview: string | null = null;
  existingPhotoPath: string | null = null; // Caminho da foto existente do usuário
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
            
            // Se o usuário tem foto, carregar automaticamente
            if (user.photo) {
              this.loadExistingPhoto(user.photo);
            } else {
              // Limpar foto existente se não tiver
              this.existingPhotoPath = null;
              this.photoPreview = null;
              this.photoFile = null;
            }
          } else {
            this.userFound = false;
            // Limpar foto quando usuário não encontrado
            this.existingPhotoPath = null;
            this.photoPreview = null;
            this.photoFile = null;
          }
        });
      } else {
        this.userFound = false;
        // Limpar foto quando telefone incompleto
        this.existingPhotoPath = null;
        this.photoPreview = null;
        this.photoFile = null;
      }
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.photoFile = input.files[0];
      // Limpar foto existente quando tirar nova foto
      this.existingPhotoPath = null;
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
    this.existingPhotoPath = null;
  }

  loadExistingPhoto(photoPath: string): void {
    // Construir URL completa da foto
    // O backend serve as fotos em /music/users-photos/ através da rota estática
    // Se estiver usando IP, usar o mesmo host; senão usar relativo
    let photoUrl: string;
    if (typeof window !== 'undefined') {
      const host = window.location.host;
      if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
        // Acessando por IP
        const ip = host.split(':')[0];
        photoUrl = `http://${ip}:3001/music/${photoPath}`;
      } else {
        // Acessando por localhost (desenvolvimento)
        photoUrl = `/music/${photoPath}`;
      }
    } else {
      photoUrl = `/music/${photoPath}`;
    }
    
    // Verificar se a foto existe fazendo uma requisição
    fetch(photoUrl)
      .then(response => {
        if (response.ok) {
          // Converter para base64 para exibir no preview
          return response.blob();
        } else {
          throw new Error('Foto não encontrada');
        }
      })
      .then(blob => {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.photoPreview = e.target?.result as string;
          this.existingPhotoPath = photoPath;
          // Não definir photoFile, pois vamos usar a foto existente
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        console.error('Erro ao carregar foto existente:', error);
        // Se não conseguir carregar, limpar
        this.existingPhotoPath = null;
        this.photoPreview = null;
      });
  }

  onSubmit(): void {
    if (this.registerForm.invalid || (!this.photoFile && !this.existingPhotoPath) || !this.qrId) {
      return;
    }

    this.isSubmitting = true;
    const { name, phone } = this.registerForm.value;
    const normalizedPhone = phone.replace(/\D/g, '');

    // Se já tem foto existente, usar ela diretamente
    if (this.existingPhotoPath && !this.photoFile) {
      this.apiService.submitName(this.qrId!, name.trim(), normalizedPhone, this.existingPhotoPath).subscribe({
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
      return;
    }

    // Se tem nova foto, fazer upload primeiro
    if (this.photoFile) {
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
}

