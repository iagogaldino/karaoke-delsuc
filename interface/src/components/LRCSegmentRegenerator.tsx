import { useState, useEffect, useRef } from 'react';
import './LRCSegmentRegenerator.css';
import { LyricsLine } from '../types/index.js';
import { formatTime } from '../utils/formatters.js';
import { API_CONFIG } from '../config/index.js';

interface LRCSegmentRegeneratorProps {
  songId: string;
  lyrics: LyricsLine[];
  onRegenerate: (songId: string, selectedIndices: number[], startTime: number, endTime: number) => Promise<void>;
  onRemove: (songId: string, selectedIndices: number[]) => Promise<void>;
  onEdit: (songId: string, edits: Array<{ lineIndex: number; newText: string }>) => Promise<void>;
  onClose: () => void;
}

export default function LRCSegmentRegenerator({
  songId,
  lyrics,
  onRegenerate,
  onRemove,
  onEdit,
  onClose,
}: LRCSegmentRegeneratorProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [manualStartTime, setManualStartTime] = useState<string>('');
  const [manualEndTime, setManualEndTime] = useState<string>('');
  const [useManualTime, setUseManualTime] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTexts, setEditTexts] = useState<Map<number, string>>(new Map());

  // Converter tempo em formato mm:ss.xx para segundos
  const parseTimeInput = (timeStr: string): number => {
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\.(\d{2}))?$/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centiseconds = match[3] ? parseInt(match[3], 10) : 0;
      return minutes * 60 + seconds + centiseconds / 100.0;
    }
    return 0;
  };

  // Converter segundos para formato mm:ss.xx
  const formatTimeInput = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const secsInt = Math.floor(secs);
    const centiseconds = Math.floor((secs - secsInt) * 100);
    return `${minutes}:${secsInt.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  // Calcular tempo inicial e final baseado nas linhas selecionadas (sem considerar tempo manual)
  const calculateTimeRangeFromSelection = () => {
    if (selectedIndices.size === 0) {
      return { startTime: 0, endTime: 0 };
    }

    const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
    const firstIndex = sortedIndices[0];
    const lastIndex = sortedIndices[sortedIndices.length - 1];

    const startTime = lyrics[firstIndex]?.time || 0;
    // Para o tempo final, pegar o tempo da última linha + estimativa de duração
    // Se houver próxima linha, usar ela como referência, senão adicionar 2s
    const lastLine = lyrics[lastIndex];
    const nextLine = lyrics[lastIndex + 1];
    const endTime = nextLine 
      ? nextLine.time 
      : (lastLine.time + 2.0); // Adicionar 2s se for a última linha

    return { startTime, endTime };
  };

  // Calcular tempo inicial e final (considerando modo manual ou seleção)
  const calculateTimeRange = () => {
    // Se usar tempo manual, usar os valores editados
    if (useManualTime) {
      const startTime = parseTimeInput(manualStartTime);
      const endTime = parseTimeInput(manualEndTime);
      if (startTime >= 0 && endTime > startTime) {
        return { startTime, endTime };
      }
    }

    // Caso contrário, calcular baseado nas linhas selecionadas
    return calculateTimeRangeFromSelection();
  };

  const handleToggleLine = (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
    
    // Se não estiver usando tempo manual, atualizar campos quando seleção mudar
    if (!useManualTime) {
      const { startTime, endTime } = calculateTimeRangeFromSelection();
      setManualStartTime(formatTimeInput(startTime));
      setManualEndTime(formatTimeInput(endTime));
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIndices(new Set());
      setSelectAll(false);
    } else {
      setSelectedIndices(new Set(lyrics.map((_, i) => i)));
      setSelectAll(true);
    }
  };

  const handleRegenerate = async () => {
    const { startTime, endTime } = calculateTimeRange();
    
    // Validar tempos
    if (startTime <= 0 || endTime <= startTime) {
      return;
    }

    // Se usar tempo manual sem linhas selecionadas, usar array vazio
    // O backend vai regenerar o trecho baseado apenas nos tempos
    const indicesToUse = useManualTime && selectedIndices.size === 0 
      ? [] 
      : Array.from(selectedIndices);

    setIsRegenerating(true);
    try {
      await onRegenerate(indicesToUse, startTime, endTime);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRemove = async () => {
    if (selectedIndices.size === 0) {
      return;
    }

    if (!confirm(`Tem certeza que deseja remover ${selectedIndices.size} linha(s) selecionada(s)?`)) {
      return;
    }

    setIsRemoving(true);
    try {
      await onRemove(songId, Array.from(selectedIndices));
      setSelectedIndices(new Set());
    } finally {
      setIsRemoving(false);
    }
  };

  const handleEdit = () => {
    if (selectedIndices.size === 0) {
      return;
    }

    // Inicializar textos de edição com os textos atuais
    const texts = new Map<number, string>();
    Array.from(selectedIndices).forEach(index => {
      texts.set(index, lyrics[index]?.text || '');
    });
    setEditTexts(texts);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    setIsEditing(true);
    try {
      // Preparar edits para enviar ao backend
      const edits = Array.from(selectedIndices).map(index => ({
        lineIndex: index,
        newText: editTexts.get(index) || lyrics[index]?.text || ''
      }));

      // Chamar callback que será implementado no App.tsx
      await onEdit(songId, edits);
      setShowEditModal(false);
      setEditTexts(new Map());
      setSelectedIndices(new Set());
    } finally {
      setIsEditing(false);
    }
  };

  useEffect(() => {
    // Atualizar selectAll quando seleção mudar
    setSelectAll(selectedIndices.size === lyrics.length && lyrics.length > 0);
    
    // Atualizar campos de tempo quando seleção mudar (se não estiver em modo manual)
    if (!useManualTime && selectedIndices.size > 0) {
      const { startTime, endTime } = calculateTimeRangeFromSelection();
      setManualStartTime(formatTimeInput(startTime));
      setManualEndTime(formatTimeInput(endTime));
    }
  }, [selectedIndices, lyrics.length, useManualTime]);

  // Atualizar URL do áudio quando seleção ou tempo manual mudar
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const { startTime, endTime } = calculateTimeRange();
    
    if (startTime > 0 || endTime > 0) {
      const segmentUrl = `${API_CONFIG.BASE_URL}/api/audio/segment?song=${songId}&start=${startTime.toFixed(2)}&end=${endTime.toFixed(2)}`;
      audio.src = segmentUrl;
      setIsLoadingAudio(true);
    } else {
      audio.src = '';
      setIsPlaying(false);
    }
  }, [selectedIndices, songId, lyrics, manualStartTime, manualEndTime, useManualTime]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(err => {
        console.error('Erro ao reproduzir áudio:', err);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  const handleAudioLoaded = () => {
    setIsLoadingAudio(false);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleAudioError = () => {
    setIsLoadingAudio(false);
    setIsPlaying(false);
    console.error('Erro ao carregar áudio do trecho');
  };

  const { startTime, endTime } = calculateTimeRange();
  const duration = endTime - startTime;

  return (
    <div className="lrc-segment-regenerator">
      <div className="lrc-segment-header">
        <h3>Regenerar Trecho de LRC</h3>
        <button onClick={onClose} className="close-button" disabled={isRegenerating}>
          ✕ Fechar
        </button>
      </div>

      <div className="lrc-segment-info">
        <div className="info-item">
          <span className="info-label">Total de linhas:</span>
          <span className="info-value">{lyrics.length}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Linhas selecionadas:</span>
          <span className="info-value">{selectedIndices.size}</span>
        </div>
        {(selectedIndices.size > 0 || useManualTime) && (
          <>
            <div className="info-item">
              <span className="info-label">Duração:</span>
              <span className="info-value">{duration.toFixed(2)}s</span>
            </div>
          </>
        )}
      </div>

      <div className="lrc-segment-controls">
        <button
          className="btn-select-all"
          onClick={handleSelectAll}
          disabled={isRegenerating || lyrics.length === 0}
        >
          {selectAll ? 'Desmarcar Todas' : 'Selecionar Todas'}
        </button>
      </div>

      {/* Controles de tempo manual */}
      <div className="lrc-segment-time-controls">
        <div className="time-control-header">
          <label className="time-control-checkbox">
            <input
              type="checkbox"
              checked={useManualTime}
              onChange={(e) => {
                setUseManualTime(e.target.checked);
                if (!e.target.checked && selectedIndices.size > 0) {
                  // Voltar para tempo calculado baseado na seleção
                  const { startTime, endTime } = calculateTimeRangeFromSelection();
                  setManualStartTime(formatTimeInput(startTime));
                  setManualEndTime(formatTimeInput(endTime));
                }
              }}
              disabled={isRegenerating}
            />
            <span>Ajustar tempo manualmente</span>
          </label>
        </div>
        {useManualTime && (
          <div className="time-control-inputs">
            <div className="time-input-group">
              <label className="time-input-label">Tempo Inicial:</label>
              <input
                type="text"
                className="time-input"
                value={manualStartTime}
                onChange={(e) => setManualStartTime(e.target.value)}
                placeholder="mm:ss.xx"
                disabled={isRegenerating}
                pattern="\d{1,2}:\d{2}\.\d{2}"
              />
              <button
                className="btn-sync-time"
                onClick={() => {
                  if (selectedIndices.size > 0) {
                    const { startTime } = calculateTimeRangeFromSelection();
                    setManualStartTime(formatTimeInput(startTime));
                  }
                }}
                disabled={isRegenerating || selectedIndices.size === 0}
                title="Sincronizar com primeira linha selecionada"
              >
                <i className="fas fa-sync"></i>
              </button>
            </div>
            <div className="time-input-group">
              <label className="time-input-label">Tempo Final:</label>
              <input
                type="text"
                className="time-input"
                value={manualEndTime}
                onChange={(e) => setManualEndTime(e.target.value)}
                placeholder="mm:ss.xx"
                disabled={isRegenerating}
                pattern="\d{1,2}:\d{2}\.\d{2}"
              />
              <button
                className="btn-sync-time"
                onClick={() => {
                  if (selectedIndices.size > 0) {
                    const { endTime } = calculateTimeRangeFromSelection();
                    setManualEndTime(formatTimeInput(endTime));
                  }
                }}
                disabled={isRegenerating || selectedIndices.size === 0}
                title="Sincronizar com última linha selecionada"
              >
                <i className="fas fa-sync"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Player de áudio do trecho */}
      {(selectedIndices.size > 0 || useManualTime) && startTime > 0 && endTime > startTime && (
        <div className="lrc-segment-player">
          <div className="segment-player-header">
            <h4>Prévia do Trecho</h4>
          </div>
          <div className="segment-player-controls">
            <button
              className="btn-play-pause"
              onClick={handlePlayPause}
              disabled={isLoadingAudio || isRegenerating}
              title={isPlaying ? 'Pausar' : 'Reproduzir'}
            >
              {isLoadingAudio ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : isPlaying ? (
                <i className="fas fa-pause"></i>
              ) : (
                <i className="fas fa-play"></i>
              )}
            </button>
            <div className="segment-player-info">
              <span className="segment-time-range">
                {formatTime(startTime)} - {formatTime(endTime)}
              </span>
              <span className="segment-duration">({duration.toFixed(1)}s)</span>
            </div>
          </div>
          <audio
            ref={audioRef}
            onLoadedData={handleAudioLoaded}
            onEnded={handleAudioEnded}
            onError={handleAudioError}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            preload="auto"
          />
        </div>
      )}

      <div className="lrc-segment-list">
        {lyrics.length === 0 ? (
          <div className="empty-message">
            <p>Nenhuma linha LRC disponível.</p>
          </div>
        ) : (
          lyrics.map((line, index) => (
            <div
              key={index}
              className={`lrc-segment-line ${selectedIndices.has(index) ? 'selected' : ''}`}
              onClick={() => handleToggleLine(index)}
            >
              <input
                type="checkbox"
                checked={selectedIndices.has(index)}
                onChange={() => handleToggleLine(index)}
                disabled={isRegenerating}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="line-time">{formatTime(line.time)}</span>
              <span className="line-text">{line.text || <em className="empty-text">(sem texto)</em>}</span>
            </div>
          ))
        )}
      </div>

      <div className="lrc-segment-actions">
        <div className="action-buttons-left">
          <button
            className="btn-remove"
            onClick={handleRemove}
            disabled={isRegenerating || isRemoving || isEditing || selectedIndices.size === 0}
            title="Remover linhas selecionadas"
          >
            {isRemoving ? 'Removendo...' : `Remover (${selectedIndices.size})`}
          </button>
          <button
            className="btn-edit"
            onClick={handleEdit}
            disabled={isRegenerating || isRemoving || isEditing || selectedIndices.size === 0}
            title="Editar linhas selecionadas"
          >
            Editar ({selectedIndices.size})
          </button>
        </div>
        <div className="action-buttons-right">
          <button
            className="btn-cancel"
            onClick={onClose}
            disabled={isRegenerating || isRemoving || isEditing}
          >
            Cancelar
          </button>
          <button
            className="btn-regenerate"
            onClick={handleRegenerate}
            disabled={isRegenerating || isRemoving || isEditing || (selectedIndices.size === 0 && !useManualTime) || startTime >= endTime}
          >
            {isRegenerating 
              ? 'Regenerando...' 
              : useManualTime
                ? `Regenerar Trecho (${selectedIndices.size} linha(s))`
                : `Regenerar ${selectedIndices.size} Linha(s)`
            }
          </button>
        </div>
      </div>

      {/* Modal de edição */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => !isEditing && setShowEditModal(false)}>
          <div className="modal-content lrc-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3>Editar {selectedIndices.size} Linha(s)</h3>
              <button
                className="close-button"
                onClick={() => !isEditing && setShowEditModal(false)}
                disabled={isEditing}
              >
                ✕
              </button>
            </div>
            <div className="edit-modal-content">
              <div className="edit-lines-list">
                {Array.from(selectedIndices).sort((a, b) => a - b).map(index => {
                  const line = lyrics[index];
                  return (
                    <div key={index} className="edit-line-item">
                      <div className="edit-line-header">
                        <span className="edit-line-time">{formatTime(line.time)}</span>
                        <span className="edit-line-index">Linha {index + 1}</span>
                      </div>
                      <textarea
                        className="edit-line-textarea"
                        value={editTexts.get(index) || ''}
                        onChange={(e) => {
                          const newTexts = new Map(editTexts);
                          newTexts.set(index, e.target.value);
                          setEditTexts(newTexts);
                        }}
                        disabled={isEditing}
                        rows={2}
                        placeholder="Digite o texto da linha..."
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="edit-modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowEditModal(false)}
                disabled={isEditing}
              >
                Cancelar
              </button>
              <button
                className="btn-save"
                onClick={handleSaveEdit}
                disabled={isEditing}
              >
                {isEditing ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
