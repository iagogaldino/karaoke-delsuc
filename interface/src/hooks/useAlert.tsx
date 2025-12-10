import { useState, useCallback, useRef } from 'react';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';

interface AlertOptions {
  title?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  confirmText?: string;
}

interface ConfirmOptions {
  title?: string;
  type?: 'warning' | 'danger' | 'info';
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function useAlert() {
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    message: string;
    options: AlertOptions;
  }>({
    isOpen: false,
    message: '',
    options: {}
  });

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    message: string;
    options: ConfirmOptions;
  }>({
    isOpen: false,
    message: '',
    options: {}
  });

  const alertResolveRef = useRef<(() => void) | null>(null);
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  const alert = useCallback((message: string, options?: AlertOptions): Promise<void> => {
    return new Promise<void>((resolve) => {
      alertResolveRef.current = resolve;
      setAlertState({
        isOpen: true,
        message,
        options: options || {}
      });
    });
  }, []);

  const confirm = useCallback(
    (message: string, options?: ConfirmOptions): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        confirmResolveRef.current = resolve;
        setConfirmState({
          isOpen: true,
          message,
          options: options || {}
        });
      });
    },
    []
  );

  const handleAlertClose = () => {
    setAlertState(prev => ({ ...prev, isOpen: false }));
    if (alertResolveRef.current) {
      alertResolveRef.current();
      alertResolveRef.current = null;
    }
  };

  const handleConfirmClose = () => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
    if (confirmResolveRef.current) {
      confirmResolveRef.current(false);
      confirmResolveRef.current = null;
    }
  };

  const handleConfirmConfirm = () => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
    if (confirmResolveRef.current) {
      confirmResolveRef.current(true);
      confirmResolveRef.current = null;
    }
  };

  const AlertComponent = (
    <AlertModal
      isOpen={alertState.isOpen}
      onClose={handleAlertClose}
      message={alertState.message}
      title={alertState.options.title}
      type={alertState.options.type}
      confirmText={alertState.options.confirmText}
    />
  );

  const ConfirmComponent = (
    <ConfirmModal
      isOpen={confirmState.isOpen}
      onClose={handleConfirmClose}
      onConfirm={handleConfirmConfirm}
      message={confirmState.message}
      title={confirmState.options.title}
      type={confirmState.options.type}
      confirmText={confirmState.options.confirmText}
      cancelText={confirmState.options.cancelText}
      isDestructive={confirmState.options.isDestructive}
    />
  );

  return {
    alert,
    confirm,
    AlertComponent,
    ConfirmComponent
  };
}

