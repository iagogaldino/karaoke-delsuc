import { useState, useCallback, useRef } from 'react';
import { recordingService } from '../services/recordingService.js';

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isUploading: boolean;
  isProcessing: boolean;
  error: string | null;
  recordingId: string | null;
  startRecording: () => void;
  stopRecording: () => void;
  uploadRecording: (audioBlob: Blob, songId: string, startTime: number) => Promise<string | null>;
  generateLRC: (songId: string, recordingId?: string) => Promise<string | null>;
  clearError: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setError(null);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  const uploadRecording = useCallback(
    async (audioBlob: Blob, songId: string, startTime: number): Promise<string | null> => {
      try {
        setIsUploading(true);
        setError(null);

        const response = await recordingService.uploadRecording(audioBlob, songId, startTime);
        
        if (response.success && response.recordingId) {
          setRecordingId(response.recordingId);
          return response.recordingId;
        } else {
          throw new Error(response.message || 'Erro ao fazer upload da gravação');
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Erro ao fazer upload da gravação';
        setError(errorMessage);
        console.error('Erro ao fazer upload:', err);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  const generateLRC = useCallback(
    async (songId: string, recordingIdParam?: string): Promise<string | null> => {
      try {
        setIsProcessing(true);
        setError(null);

        // Usar recordingId passado como parâmetro ou do estado
        const idToUse = recordingIdParam || recordingId;
        console.log('🔄 Gerando LRC para songId:', songId, 'recordingId:', idToUse);

        const response = await recordingService.generateLRC(songId, idToUse || undefined);
        
        if (response.success) {
          console.log('✅ LRC gerado:', response.lrcPath);
          return response.lrcPath;
        } else {
          throw new Error(response.message || 'Erro ao gerar LRC');
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Erro ao gerar LRC';
        setError(errorMessage);
        console.error('❌ Erro ao gerar LRC:', err);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [recordingId]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isRecording,
    isUploading,
    isProcessing,
    error,
    recordingId,
    startRecording,
    stopRecording,
    uploadRecording,
    generateLRC,
    clearError,
  };
}
