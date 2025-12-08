import { apiService } from './api.js';

export interface QRCodeResponse {
  qrId: string;
  url: string;
  qrSvg: string;
}

export interface ValidateQRCodeRequest {
  qrId: string;
  scannedCode: string;
}

export interface ValidateQRCodeResponse {
  valid: boolean;
  message?: string;
  error?: string;
}

export interface QRCodeStatus {
  qrId: string;
  isValid: boolean;
  nameSubmitted?: boolean;
  userName?: string;
  createdAt: number;
  expiresAt: number;
}

class QRCodeService {
  /**
   * Gera um novo QR code no backend
   */
  async generate(): Promise<QRCodeResponse> {
    return apiService.get<QRCodeResponse>('/api/qrcode/generate');
  }

  /**
   * Valida um código escaneado
   */
  async validate(qrId: string, scannedCode: string): Promise<ValidateQRCodeResponse> {
    return apiService.post<ValidateQRCodeResponse>('/api/qrcode/validate', {
      qrId,
      scannedCode
    });
  }

  /**
   * Verifica o status de um QR code
   */
  async getStatus(qrId: string): Promise<QRCodeStatus> {
    return apiService.get<QRCodeStatus>(`/api/qrcode/${qrId}/status`);
  }
}

export const qrcodeService = new QRCodeService();
