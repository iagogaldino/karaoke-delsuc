import { useState } from 'react';
import { bandsService } from '../services/bandsService.js';
import { Category } from '../types/index.js';
import Modal from './Modal.js';
import './CreateBandButton.css';

interface CreateBandButtonProps {
  onBandCreated?: () => void;
  buttonText?: string;
  variant?: 'button' | 'inline';
  categories?: Category[];
}

export default function CreateBandButton({ 
  onBandCreated, 
  buttonText = 'Nova Banda',
  variant = 'button',
  categories = []
}: CreateBandButtonProps) {
  const [showForm, setShowForm] = useState(false);
  const [bandName, setBandName] = useState('');
  const [bandDesc, setBandDesc] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!bandName.trim()) {
      alert('Nome da banda é obrigatório');
      return;
    }

    if (!selectedCategoryId) {
      alert('Selecione uma categoria');
      return;
    }

    try {
      setIsCreating(true);
      const newBand = await bandsService.create(bandName.trim(), bandDesc.trim() || undefined);
      // Atualizar a categoria da banda
      await bandsService.update(newBand.id, { category: selectedCategoryId });
      setBandName('');
      setBandDesc('');
      setSelectedCategoryId('');
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
    setSelectedCategoryId('');
  };

  if (variant === 'inline') {
    return (
      <>
        <button
          className="create-band-btn create-band-icon-btn"
          onClick={() => setShowForm(true)}
          disabled={isCreating}
          title={buttonText || 'Nova Banda'}
        >
          <i className="fas fa-users"></i>
        </button>
        <Modal
          isOpen={showForm}
          onClose={handleCancel}
          title="Criar Nova Banda"
        >
          <div className="create-band-form-modal">
            <div className="form-group">
              <label className="form-label">Nome da Banda *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Queen, Metallica, The Beatles"
                value={bandName}
                onChange={(e) => setBandName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && bandName.trim() && selectedCategoryId) {
                    handleCreate();
                  }
                }}
                disabled={isCreating}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Categoria *</label>
              <select
                className="form-select"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                disabled={isCreating}
              >
                <option value="">Selecione uma categoria</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <textarea
                className="form-textarea"
                placeholder="Descrição opcional da banda"
                value={bandDesc}
                onChange={(e) => setBandDesc(e.target.value)}
                disabled={isCreating}
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button 
                onClick={handleCancel} 
                disabled={isCreating}
                className="modal-btn modal-btn-cancel"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreate} 
                disabled={isCreating || !bandName.trim() || !selectedCategoryId}
                className="modal-btn modal-btn-submit"
              >
                {isCreating ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Criando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i> Criar Banda
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <div className="create-band-container">
      <button
        className="create-band-btn"
        onClick={() => setShowForm(true)}
        disabled={isCreating}
      >
        <i className="fas fa-users"></i>
        {buttonText}
      </button>

      <Modal
        isOpen={showForm}
        onClose={handleCancel}
        title="Criar Nova Banda"
      >
        <div className="create-band-form-modal">
          <div className="form-group">
            <label className="form-label">Nome da Banda *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Queen, Metallica, The Beatles"
              value={bandName}
              onChange={(e) => setBandName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && bandName.trim() && selectedCategoryId) {
                  handleCreate();
                }
              }}
              disabled={isCreating}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Categoria *</label>
            <select
              className="form-select"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              disabled={isCreating}
            >
              <option value="">Selecione uma categoria</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea
              className="form-textarea"
              placeholder="Descrição opcional da banda"
              value={bandDesc}
              onChange={(e) => setBandDesc(e.target.value)}
              disabled={isCreating}
              rows={3}
            />
          </div>
          <div className="modal-actions">
            <button 
              onClick={handleCancel} 
              disabled={isCreating}
              className="modal-btn modal-btn-cancel"
            >
              Cancelar
            </button>
            <button 
              onClick={handleCreate} 
              disabled={isCreating || !bandName.trim() || !selectedCategoryId}
              className="modal-btn modal-btn-submit"
            >
              {isCreating ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Criando...
                </>
              ) : (
                <>
                  <i className="fas fa-check"></i> Criar Banda
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
