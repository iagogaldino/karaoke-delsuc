import { apiService } from './api.js';
import { API_CONFIG, PROCESSING_CONFIG } from '../config/index.js';
import { ProcessingStatus } from '../types/index.js';

export interface UploadResponse {
  fileId: string;
  musicName: string;
  songId: string;
  fileName: string;
  fileSize: number;
  tempPath: string;
}

export interface StartProcessingRequest {
  fileId: string;
  musicName: string;
  displayName: string;
  songId: string;
  tempPath: string;
}

export interface StartYouTubeRequest {
  youtubeUrl: string;
  musicName: string;
  displayName?: string;
}

/**
 * Processing API service
 */
export const processingService = {
  /**
   * Upload audio file
   */
  async upload(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('audio', file);
    return apiService.postFormData<UploadResponse>(
      `${API_CONFIG.ENDPOINTS.PROCESSING}/upload`,
      formData
    );
  },

  /**
   * Start processing
   */
  async start(data: StartProcessingRequest): Promise<{ fileId: string; message: string; statusUrl: string }> {
    return apiService.post(`${API_CONFIG.ENDPOINTS.PROCESSING}/start`, data);
  },

  /**
   * Get processing status
   */
  async getStatus(fileId: string): Promise<ProcessingStatus> {
    return apiService.get<ProcessingStatus>(
      `${API_CONFIG.ENDPOINTS.PROCESSING}/status/${fileId}`
    );
  },

  /**
   * Download video for a song
   */
  async downloadVideo(songId: string): Promise<{ processId: string; message: string; statusUrl: string }> {
    return apiService.post(
      `${API_CONFIG.ENDPOINTS.PROCESSING}/download-video/${songId}`
    );
  },

  /**
   * Start YouTube processing
   */
  async startYouTube(data: StartYouTubeRequest): Promise<{ fileId: string; message: string; statusUrl: string }> {
    return apiService.post(`${API_CONFIG.ENDPOINTS.PROCESSING}/start-youtube`, data);
  },

  /**
   * Generate LRC lyrics for an existing song
   */
  async generateLRC(songId: string): Promise<{ processId: string; message: string; statusUrl: string }> {
    return apiService.post(`${API_CONFIG.ENDPOINTS.PROCESSING}/generate-lrc/${songId}`);
  },

  /**
   * Poll processing status until completion
   */
  async pollStatus(
    fileId: string,
    onProgress?: (status: ProcessingStatus) => void
  ): Promise<ProcessingStatus> {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const status = await this.getStatus(fileId);
          
          if (onProgress) {
            onProgress(status);
          }

          if (status.status === 'completed') {
            resolve(status);
          } else if (status.status === 'error') {
            reject(new Error(status.error || 'Processing failed'));
          } else {
            setTimeout(checkStatus, PROCESSING_CONFIG.STATUS_CHECK_INTERVAL);
          }
        } catch (error) {
          reject(error);
        }
      };

      setTimeout(checkStatus, PROCESSING_CONFIG.INITIAL_STATUS_DELAY);
    });
  },
};
