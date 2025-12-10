import React from 'react';
import Modal from './Modal';
import './AlertModal.css';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  confirmText?: string;
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK'
}: AlertModalProps) {
  const handleConfirm = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || getDefaultTitle(type)}>
      <div className="alert-modal-content">
        <div className={`alert-modal-icon alert-modal-icon-${type}`}>
          <i className={getIconClass(type)}></i>
        </div>
        <div className="alert-modal-message">
          {message.split('\n').map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        <div className="alert-modal-actions">
          <button className="alert-modal-btn alert-modal-btn-primary" onClick={handleConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function getDefaultTitle(type: string): string {
  switch (type) {
    case 'success':
      return 'Sucesso';
    case 'warning':
      return 'Aviso';
    case 'error':
      return 'Erro';
    default:
      return 'Informação';
  }
}

function getIconClass(type: string): string {
  switch (type) {
    case 'success':
      return 'fas fa-check-circle';
    case 'warning':
      return 'fas fa-exclamation-triangle';
    case 'error':
      return 'fas fa-times-circle';
    default:
      return 'fas fa-info-circle';
  }
}

