import { useState, useEffect } from 'react';
import './MusicProcessor.css';
import { processingService } from '../services/processingService.js';
import { bandsService } from '../services/bandsService.js';
import { isValidAudioFile, isValidMusicName, isValidYouTubeUrl } from '../utils/validators.js';
import { getFileNameWithoutExtension } from '../utils/textUtils.js';
import { formatFileSize } from '../utils/formatters.js';
import { Band } from '../types/index.js';

interface MusicProcessorProps {
  onProcessComplete?: (songId: string) => void;
}

type ProcessingMode = 'upload' | 'youtube';

export default function MusicProcessor({ onProcessComplete }: MusicProcessorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [musicName, setMusicName] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<ProcessingMode>('upload');
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [bands, setBands] = useState<Band[]>([]);
  const [selectedBandId, setSelectedBandId] = useState<string>('');
  const [showCreateBand, setShowCreateBand] = useState(false);
  const [newBandName, setNewBandName] = useState<string>('');
  const [newBandDesc, setNewBandDesc] = useState<string>('');

  // Carregar bandas
  useEffect(() => {
    const loadBands = async () => {
      try {
        const bandsData = await bandsService.getAll();
        setBands(bandsData);
      } catch (error) {
        console.error('Error loading bands:', error);
      }
    };
    loadBands();
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!isValidAudioFile(file)) {
      alert('Formato não suportado. Use: MP3, WAV, M4A, FLAC, OGG');
      return;
    }

    setUploadedFile(file);
    
    // Preencher nome da música automaticamente com o nome do arquivo (sem extensão)
    const fileName = getFileNameWithoutExtension(file.name);
    setMusicName(fileName);
  };

  const handleCreateBand = async () => {
    if (!newBandName.trim()) {
      alert('Nome da banda é obrigatório');
      return;
    }

    try {
      const newBand = await bandsService.create(newBandName.trim(), newBandDesc.trim() || undefined);
      setBands([...bands, newBand]);
      setSelectedBandId(newBand.id);
      setShowCreateBand(false);
      setNewBandName('');
      setNewBandDesc('');
    } catch (error: any) {
      console.error('Error creating band:', error);
      alert(error.message || 'Erro ao criar banda');
    }
  };

  const handleProcess = async () => {
    if (mode === 'upload') {
      if (!uploadedFile) {
        alert('Por favor, selecione um arquivo de áudio primeiro');
        return;
      }

      if (!isValidMusicName(musicName)) {
        alert('Por favor, insira um nome para a música');
        return;
      }

      setIsProcessing(true);
      setProcessingStep('Iniciando processamento...');
      setProgress(0);

      try {
        // Primeiro fazer upload do arquivo
        const uploadData = await processingService.upload(uploadedFile);
        const newFileId = uploadData.fileId;
        const songId = uploadData.songId;

        // Iniciar processamento
        await processingService.start({
          fileId: newFileId,
          musicName: musicName.trim(),
          displayName: musicName.trim(),
          songId: songId,
          tempPath: uploadData.tempPath,
          bandId: selectedBandId || undefined,
        });

        // Polling do status usando o serviço
        await processingService.pollStatus(newFileId, (status) => {
          setProcessingStep(status.step);
          setProgress(status.progress);
        });

        // Processamento concluído
        setIsProcessing(false);
        setUploadedFile(null);
        setMusicName('');
        setProgress(0);
        
        if (onProcessComplete) {
          // Buscar songId do status final
          processingService.getStatus(newFileId).then((finalStatus) => {
            if (finalStatus.songId && onProcessComplete) {
              onProcessComplete(finalStatus.songId);
            }
          });
        }
        
        alert('Música processada com sucesso!');
      } catch (error: any) {
        console.error('Erro ao processar música:', error);
        alert('Erro ao processar música: ' + (error.message || 'Erro desconhecido'));
        setIsProcessing(false);
        setProcessingStep('');
        setProgress(0);
      }
    } else {
      // Modo YouTube
      if (!youtubeUrl.trim()) {
        alert('Por favor, insira uma URL do YouTube');
        return;
      }

      if (!isValidYouTubeUrl(youtubeUrl)) {
        alert('URL do YouTube inválida. Use um link válido do YouTube (youtube.com ou youtu.be)');
        return;
      }

      if (!isValidMusicName(musicName)) {
        alert('Por favor, insira um nome para a música');
        return;
      }

      setIsProcessing(true);
      setProcessingStep('Iniciando download do YouTube...');
      setProgress(0);

      try {
        // Iniciar processamento do YouTube
        const response = await processingService.startYouTube({
          youtubeUrl: youtubeUrl.trim(),
          musicName: musicName.trim(),
          displayName: musicName.trim(),
          bandId: selectedBandId || undefined,
        });

        const fileId = response.fileId;

        // Polling do status usando o serviço
        await processingService.pollStatus(fileId, (status) => {
          setProcessingStep(status.step);
          setProgress(status.progress);
        });

        // Processamento concluído
        setIsProcessing(false);
        setYoutubeUrl('');
        setMusicName('');
        setProgress(0);
        
        if (onProcessComplete) {
          // Buscar songId do status final
          processingService.getStatus(fileId).then((finalStatus) => {
            if (finalStatus.songId && onProcessComplete) {
              onProcessComplete(finalStatus.songId);
            }
          });
        }
        
        alert('Música processada com sucesso!');
      } catch (error: any) {
        console.error('Erro ao processar música do YouTube:', error);
        alert('Erro ao processar música: ' + (error.message || 'Erro desconhecido'));
        setIsProcessing(false);
        setProcessingStep('');
        setProgress(0);
      }
    }
  };

  return (
    <div className="music-processor">
      <div className="processor-header">
        <h3>Processar Nova Música</h3>
      </div>

      {/* Toggle entre Upload e YouTube */}
      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'upload' ? 'active' : ''}`}
          onClick={() => {
            if (!isProcessing) {
              setMode('upload');
              setYoutubeUrl('');
              setUploadedFile(null);
              setMusicName('');
            }
          }}
          disabled={isProcessing}
        >
          📄 Upload de Arquivo
        </button>
        <button
          className={`mode-btn ${mode === 'youtube' ? 'active' : ''}`}
          onClick={() => {
            if (!isProcessing) {
              setMode('youtube');
              setUploadedFile(null);
              setYoutubeUrl('');
              setMusicName('');
            }
          }}
          disabled={isProcessing}
        >
          🎬 Link do YouTube
        </button>
      </div>

      {mode === 'upload' ? (
        <>
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
                {formatFileSize(uploadedFile.size)}
              </p>
            </div>
          )}

          {uploadedFile && (
            <div className="music-name-input">
              <label htmlFor="music-name">Nome da Música:</label>
              <input
                type="text"
                id="music-name"
                value={musicName}
                onChange={(e) => setMusicName(e.target.value)}
                placeholder="Digite o nome da música"
                disabled={isProcessing}
                className="name-input"
              />
            </div>
          )}

          <button
            className="process-btn"
            onClick={handleProcess}
            disabled={!uploadedFile || isProcessing}
          >
            {isProcessing ? 'Processando...' : 'Processar Música'}
          </button>
        </>
      ) : (
        <>
          <div className="youtube-input-area">
            <label htmlFor="youtube-url">URL do YouTube:</label>
            <input
              type="text"
              id="youtube-url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={isProcessing}
              className="name-input"
            />
            <p className="input-hint">
              Cole o link completo do vídeo do YouTube
            </p>
          </div>

          <div className="band-selection">
            <label htmlFor="band-select-youtube">Banda/Artista:</label>
            <div className="band-select-wrapper">
              <select
                id="band-select-youtube"
                value={selectedBandId}
                onChange={(e) => setSelectedBandId(e.target.value)}
                disabled={isProcessing}
                className="band-select"
              >
                <option value="">Selecionar banda...</option>
                {bands.map(band => (
                  <option key={band.id} value={band.id}>{band.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="create-band-btn-small"
                onClick={() => setShowCreateBand(!showCreateBand)}
                disabled={isProcessing}
                title="Criar nova banda"
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>
            {showCreateBand && (
              <div className="create-band-inline">
                <input
                  type="text"
                  placeholder="Nome da banda"
                  value={newBandName}
                  onChange={(e) => setNewBandName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateBand();
                    } else if (e.key === 'Escape') {
                      setShowCreateBand(false);
                    }
                  }}
                  className="name-input"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateBand}
                  className="create-band-confirm-btn"
                >
                  <i className="fas fa-check"></i>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateBand(false);
                    setNewBandName('');
                    setNewBandDesc('');
                  }}
                  className="create-band-cancel-btn"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
          </div>

          <div className="music-name-input">
            <label htmlFor="music-name-youtube">Nome da Música:</label>
            <input
              type="text"
              id="music-name-youtube"
              value={musicName}
              onChange={(e) => setMusicName(e.target.value)}
              placeholder="Digite o nome da música"
              disabled={isProcessing}
              className="name-input"
            />
          </div>

          <button
            className="process-btn"
            onClick={handleProcess}
            disabled={!youtubeUrl.trim() || !musicName.trim() || isProcessing}
          >
            {isProcessing ? 'Processando...' : 'Processar do YouTube'}
          </button>
        </>
      )}

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

