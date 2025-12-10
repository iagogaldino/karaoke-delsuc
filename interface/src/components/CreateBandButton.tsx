import { useState } from 'react';
import { bandsService } from '../services/bandsService.js';
import './CreateBandButton.css';

interface CreateBandButtonProps {
  onBandCreated?: () => void;
  buttonText?: string;
  variant?: 'button' | 'inline';
}

export default function CreateBandButton({ 
  onBandCreated, 
  buttonText = 'Nova Banda',
  variant = 'button'
}: CreateBandButtonProps) {
  const [showForm, setShowForm] = useState(false);
  const [bandName, setBandName] = useState('');
  const [bandDesc, setBandDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!bandName.trim()) {
      alert('Nome da banda é obrigatório');
      return;
    }

    try {
      setIsCreating(true);
      await bandsService.create(bandName.trim(), bandDesc.trim() || undefined);
      setBandName('');
      setBandDesc('');
      setShowForm(false);
      if (onBandCreated) {
        onBandCreated();
      }
    } catch (error: any) {
      console.error('Error creating band:', error);
      alert(error.message || 'Erro ao criar banda');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setBandName('');
    setBandDesc('');
  };

  if (variant === 'inline') {
    return (
      <div className="create-band-inline">
        {!showForm ? (
          <button
            className="create-band-btn create-band-icon-btn"
            onClick={() => setShowForm(true)}
            disabled={isCreating}
            title={buttonText}
          >
            <i className="fas fa-users"></i>
          </button>
        ) : (
          <div className="create-band-form">
            <input
              type="text"
              placeholder="Nome da banda (ex: Queen, Metallica)"
              value={bandName}
              onChange={(e) => setBandName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreate();
                } else if (e.key === 'Escape') {
                  handleCancel();
                }
              }}
              disabled={isCreating}
              autoFocus
            />
            <input
              type="text"
              placeholder="Descrição (opcional)"
              value={bandDesc}
              onChange={(e) => setBandDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreate();
                } else if (e.key === 'Escape') {
                  handleCancel();
                }
              }}
              disabled={isCreating}
            />
            <div className="create-band-form-actions">
              <button 
                onClick={handleCreate} 
                disabled={isCreating || !bandName.trim()}
                className="create-band-submit-btn"
              >
                <i className="fas fa-check"></i> Criar
              </button>
              <button 
                onClick={handleCancel} 
                disabled={isCreating}
                className="create-band-cancel-btn"
              >
                <i className="fas fa-times"></i> Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="create-band-container">
      <button
        className="create-band-btn"
        onClick={() => setShowForm(!showForm)}
        disabled={isCreating}
      >
        <i className="fas fa-users"></i>
        {showForm ? 'Cancelar Banda' : buttonText}
      </button>

      {showForm && (
        <div className="create-band-form">
          <input
            type="text"
            placeholder="Nome da banda (ex: Queen, Metallica)"
            value={bandName}
            onChange={(e) => setBandName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreate();
              } else if (e.key === 'Escape') {
                handleCancel();
              }
            }}
            disabled={isCreating}
            autoFocus
          />
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={bandDesc}
            onChange={(e) => setBandDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreate();
              }
            }}
            disabled={isCreating}
          />
          <button 
            onClick={handleCreate} 
            disabled={isCreating || !bandName.trim()}
            className="create-band-submit-btn"
          >
            <i className="fas fa-check"></i> Criar Banda
          </button>
        </div>
      )}
    </div>
  );
}
