import { useState } from 'react';
import './AudioControls.css';

export type AudioMode = 'both' | 'vocals-only' | 'instrumental-only';

interface AudioControlsProps {
  mode: AudioMode;
  onModeChange: (mode: AudioMode) => void;
  vocalsVolume: number;
  instrumentalVolume: number;
  onVocalsVolumeChange: (volume: number) => void;
  onInstrumentalVolumeChange: (volume: number) => void;
}

export default function AudioControls({
  mode,
  onModeChange,
  vocalsVolume,
  instrumentalVolume,
  onVocalsVolumeChange,
  onInstrumentalVolumeChange
}: AudioControlsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="audio-controls">
      <div className="audio-controls-header">
        <h3>Configurações de Áudio</h3>
        <button
          className="toggle-advanced"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <i className={`fas ${showAdvanced ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
          <span>{showAdvanced ? 'Ocultar' : 'Avançado'}</span>
        </button>
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

