import { useState } from 'react';
import './AudioControls.css';
import { AudioMode } from '../types/index.js';

interface AudioControlsProps {
  mode: AudioMode;
  onModeChange: (mode: AudioMode) => void;
  vocalsVolume: number;
  instrumentalVolume: number;
  onVocalsVolumeChange: (volume: number) => void;
  onInstrumentalVolumeChange: (volume: number) => void;
  generateLRCAfterRecording?: boolean;
  onGenerateLRCChange?: (enabled: boolean) => void;
  onPresentationClick?: () => void;
  showPresentationButton?: boolean;
}

export default function AudioControls({
  mode,
  onModeChange,
  vocalsVolume,
  instrumentalVolume,
  onVocalsVolumeChange,
  onInstrumentalVolumeChange,
  generateLRCAfterRecording = true,
  onGenerateLRCChange,
  onPresentationClick,
  showPresentationButton = false
}: AudioControlsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="audio-controls">
      <div className="audio-controls-header">
        <h3>Configurações de Áudio</h3>
        <div className="audio-controls-header-actions">
          {showPresentationButton && onPresentationClick && (
            <button
              className="presentation-btn-inline"
              onClick={onPresentationClick}
              title="Ir para tela de apresentação"
            >
              <i className="fas fa-tv"></i>
              <span>Apresentação</span>
            </button>
          )}
          <button
            className="toggle-advanced"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <i className={`fas ${showAdvanced ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
            <span>{showAdvanced ? 'Ocultar' : 'Avançado'}</span>
          </button>
        </div>
      </div>

      <div className="mode-selector">
        <label>Modo de Reprodução:</label>
        <div className="mode-buttons">
          <button
            className={`mode-btn ${mode === 'both' ? 'active' : ''}`}
            onClick={() => onModeChange('both')}
          >
            <i className="fas fa-microphone"></i>
            <i className="fas fa-music"></i>
            <span>Ambos (Karaokê)</span>
          </button>
          <button
            className={`mode-btn ${mode === 'vocals-only' ? 'active' : ''}`}
            onClick={() => onModeChange('vocals-only')}
          >
            <i className="fas fa-microphone"></i>
            <span>Apenas Vocals</span>
          </button>
          <button
            className={`mode-btn ${mode === 'instrumental-only' ? 'active' : ''}`}
            onClick={() => onModeChange('instrumental-only')}
          >
            <i className="fas fa-music"></i>
            <span>Apenas Instrumental</span>
          </button>
        </div>
      </div>

      {onGenerateLRCChange && (
        <div className="lrc-generation-option">
          <label className="lrc-checkbox-label">
            <input
              type="checkbox"
              checked={generateLRCAfterRecording}
              onChange={(e) => {
                const newValue = e.target.checked;
                onGenerateLRCChange(newValue);
              }}
            />
            <span>Gerar LRC após gravação</span>
          </label>
        </div>
      )}

      {showAdvanced && (
        <div className="volume-controls">
          <div className="volume-control">
            <label>Volume Vocals: {Math.round(vocalsVolume * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={vocalsVolume}
              onChange={(e) => onVocalsVolumeChange(parseFloat(e.target.value))}
              className="volume-slider"
            />
          </div>

          <div className="volume-control">
            <label>Volume Instrumental: {Math.round(instrumentalVolume * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={instrumentalVolume}
              onChange={(e) => onInstrumentalVolumeChange(parseFloat(e.target.value))}
              className="volume-slider"
            />
          </div>
        </div>
      )}
    </div>
  );
}

