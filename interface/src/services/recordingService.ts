import { apiService } from './api.js';
import { API_CONFIG } from '../config/index.js';

export interface RecordingUploadResponse {
  success: boolean;
  recordingId: string;
  filePath: string;
  message?: string;
}

export interface GenerateLRCResponse {
  success: boolean;
  lrcPath: string;
  processId?: string;
  message?: string;
}

/**
 * Recording API service
 */
export const recordingService = {
  /**
   * Upload recording file to backend
   */
  async uploadRecording(
    audioBlob: Blob,
    songId: string,
    startTime: number,
    filename?: string
  ): Promise<RecordingUploadResponse> {
    const formData = new FormData();
    
    // Criar nome de arquivo se não fornecido
    const timestamp = Date.now();
    const defaultFilename = filename || `recording-${timestamp}.webm`;
    
    formData.append('audio', audioBlob, defaultFilename);
    formData.append('songId', songId);
    formData.append('startTime', startTime.toString());

    const response = await fetch(`${API_CONFIG.BASE_URL}/api/recording/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(error.error || `Erro ao fazer upload: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Generate LRC from recording
   */
  async generateLRC(songId: string, recordingId?: string): Promise<GenerateLRCResponse> {
    const endpoint = recordingId
      ? `/api/recording/generate-lrc/${songId}?recordingId=${recordingId}`
      : `/api/recording/generate-lrc/${songId}`;

    // Usar fetch diretamente pois pode demorar e queremos mostrar progresso
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(error.error || `Erro ao gerar LRC: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Get recording LRC content
   */
  async getRecordingLRC(songId: string, recordingId?: string): Promise<string> {
    const endpoint = recordingId
      ? `/api/recording/lrc/${songId}?recordingId=${recordingId}`
      : `/api/recording/lrc/${songId}`;

    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar LRC: ${response.statusText}`);
    }

    return response.text();
  },

  /**
   * Get original LRC content for comparison
   */
  async getOriginalLRC(songId: string): Promise<string> {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/lyrics?song=${songId}`);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar LRC original: ${response.statusText}`);
    }

    return response.text();
  },
};
