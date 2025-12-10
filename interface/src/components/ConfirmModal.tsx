import React from 'react';
import Modal from './Modal';
import './ConfirmModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  type?: 'warning' | 'danger' | 'info';
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDestructive = false
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || getDefaultTitle(type)}>
      <div className="confirm-modal-content">
        <div className={`confirm-modal-icon confirm-modal-icon-${type}`}>
          <i className={getIconClass(type)}></i>
        </div>
        <div className="confirm-modal-message">
          {message.split('\n').map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        <div className="confirm-modal-actions">
          <button
            className="confirm-modal-btn confirm-modal-btn-cancel"
            onClick={handleCancel}
          >
            {cancelText}
          </button>
          <button
            className={`confirm-modal-btn ${
              isDestructive
                ? 'confirm-modal-btn-danger'
                : 'confirm-modal-btn-primary'
            }`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function getDefaultTitle(type: string): string {
  switch (type) {
    case 'danger':
      return 'Confirmação';
    case 'info':
      return 'Confirmar ação';
    default:
      return 'Atenção';
  }
}

function getIconClass(type: string): string {
  switch (type) {
    case 'danger':
      return 'fas fa-exclamation-circle';
    case 'info':
      return 'fas fa-question-circle';
    default:
      return 'fas fa-exclamation-triangle';
  }
}

