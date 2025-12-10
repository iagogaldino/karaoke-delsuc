import { useState } from 'react';
import { categoriesService } from '../services/categoriesService.js';
import Modal from './Modal.js';
import './CreateCategoryButton.css';

interface CreateCategoryButtonProps {
  onCategoryCreated?: () => void;
  buttonText?: string;
  variant?: 'default' | 'inline';
}

export default function CreateCategoryButton({ 
  onCategoryCreated, 
  buttonText = 'Nova Categoria',
  variant = 'default'
}: CreateCategoryButtonProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!name.trim()) {
      alert('Nome da categoria é obrigatório');
      return;
    }

    setIsLoading(true);
    try {
      await categoriesService.create(name.trim(), description.trim() || undefined);
      setName('');
      setDescription('');
      setShowForm(false);
      
      if (onCategoryCreated) {
        onCategoryCreated();
      }
    } catch (error: any) {
      console.error('Error creating category:', error);
      alert(error.message || 'Erro ao criar categoria');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setShowForm(false);
  };

  if (variant === 'inline') {
    return (
      <>
        <button
          className="create-category-btn-inline"
          onClick={() => setShowForm(true)}
          title="Criar nova categoria"
        >
          <i className="fas fa-plus"></i>
        </button>
        <Modal
          isOpen={showForm}
          onClose={handleCancel}
          title="Criar Nova Categoria"
        >
          <div className="create-category-form-modal">
            <div className="form-group">
              <label className="form-label">Nome da Categoria *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Rock, Pop, Sertanejo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) {
                    handleSubmit(e);
                  }
                }}
                autoFocus
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <textarea
                className="form-textarea"
                placeholder="Descrição opcional da categoria"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className="modal-btn modal-btn-cancel"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !name.trim()}
                className="modal-btn modal-btn-submit"
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Criando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i> Criar Categoria
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
    <div className="create-category">
      <button
        className="create-category-btn"
        onClick={() => setShowForm(true)}
      >
        <i className="fas fa-plus"></i>
        {buttonText}
      </button>

      <Modal
        isOpen={showForm}
        onClose={handleCancel}
        title="Criar Nova Categoria"
      >
        <div className="create-category-form-modal">
          <div className="form-group">
            <label className="form-label">Nome da Categoria *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Rock, Pop, Sertanejo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  handleSubmit(e);
                }
              }}
              autoFocus
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea
              className="form-textarea"
              placeholder="Descrição opcional da categoria"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="modal-btn modal-btn-cancel"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !name.trim()}
              className="modal-btn modal-btn-submit"
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Criando...
                </>
              ) : (
                <>
                  <i className="fas fa-check"></i> Criar Categoria
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

