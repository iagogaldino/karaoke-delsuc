import { useState } from 'react';
import './MusicProcessor.css';

interface MusicProcessorProps {
  onProcessComplete?: (songId: string) => void;
}

export default function MusicProcessor({ onProcessComplete }: MusicProcessorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/flac', 'audio/ogg', 'audio/*'];
    if (!allowedTypes.some(type => file.type.includes(type.split('/')[1] || '') || type === 'audio/*')) {
      alert('Formato não suportado. Use: MP3, WAV, M4A, FLAC, OGG');
      return;
    }

    setUploadedFile(file);
  };

  const handleProcess = async () => {
    if (!uploadedFile) {
      alert('Por favor, selecione um arquivo de áudio primeiro');
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Iniciando processamento...');
    setProgress(0);

    try {
      // Primeiro fazer upload do arquivo
      const formData = new FormData();
      formData.append('audio', uploadedFile);

      const uploadResponse = await fetch('/api/processing/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Erro ao fazer upload');
      }

      const uploadData = await uploadResponse.json();
      const newFileId = uploadData.fileId;
      const songId = uploadData.songId; // Incluir songId do upload

      // Iniciar processamento
      const startResponse = await fetch('/api/processing/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileId: newFileId,
          musicName: uploadData.musicName,
          songId: songId, // Enviar songId para o backend
          tempPath: uploadData.tempPath
        })
      });

      if (!startResponse.ok) {
        throw new Error('Erro ao iniciar processamento');
      }

      // Polling do status
      const checkStatus = async () => {
        try {
          const statusResponse = await fetch(`/api/processing/status/${newFileId}`);
          if (!statusResponse.ok) {
            throw new Error('Erro ao verificar status');
          }

          const status = await statusResponse.json();

          setProcessingStep(status.step);
          setProgress(status.progress);

          if (status.status === 'completed') {
            setIsProcessing(false);
            setUploadedFile(null);
            setProgress(0);
            
            if (onProcessComplete && status.songId) {
              onProcessComplete(status.songId);
            }
            
            alert('Música processada com sucesso!');
          } else if (status.status === 'error') {
            setIsProcessing(false);
            alert('Erro ao processar música: ' + (status.error || 'Erro desconhecido'));
            setProcessingStep('');
            setProgress(0);
          } else if (status.status === 'processing') {
            // Continuar verificando
            setTimeout(checkStatus, 2000);
          }
        } catch (error: any) {
          console.error('Error checking status:', error);
          setIsProcessing(false);
          alert('Erro ao verificar status do processamento');
          setProcessingStep('');
          setProgress(0);
        }
      };

      // Iniciar polling
      setTimeout(checkStatus, 1000);
    } catch (error: any) {
      console.error('Erro ao processar música:', error);
      alert('Erro ao processar música: ' + error.message);
      setIsProcessing(false);
      setProcessingStep('');
      setProgress(0);
    }
  };

  return (
    <div className="music-processor">
      <div className="processor-header">
        <h3>Processar Nova Música</h3>
      </div>

      <div className="upload-area">
        <input
          type="file"
          id="audio-upload"
          accept="audio/*"
          onChange={handleFileSelect}
          disabled={isProcessing}
          className="file-input"
        />
        <label htmlFor="audio-upload" className="upload-label">
          <div className="upload-icon">📄⬆</div>
          <span className="upload-text">
            {uploadedFile ? uploadedFile.name : 'Selecionar Áudio'}
          </span>
        </label>
      </div>

      {uploadedFile && (
        <div className="file-info">
          <p className="file-name">{uploadedFile.name}</p>
          <p className="file-size">
            {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
          </p>
        </div>
      )}

      <button
        className="process-btn"
        onClick={handleProcess}
        disabled={!uploadedFile || isProcessing}
      >
        {isProcessing ? 'Processando...' : 'Processar Música'}
      </button>

      {isProcessing && processingStep && (
        <div className="processing-status">
          <div className="processing-spinner"></div>
          <div className="processing-info">
            <p className="processing-text">{processingStep}</p>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="progress-text">{progress}%</p>
          </div>
        </div>
      )}
    </div>
  );
}

