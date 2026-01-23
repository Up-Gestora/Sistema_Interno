import { ReactNode, useEffect, useRef } from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export default function Modal({ isOpen, onClose, title, children, size = 'medium' }: ModalProps) {
  const iniciouNoOverlay = useRef(false);
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        iniciouNoOverlay.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (iniciouNoOverlay.current && e.target === e.currentTarget) {
          onClose();
        }
        iniciouNoOverlay.current = false;
      }}
    >
      <div className={`modal-content modal-${size}`} onMouseDown={() => {
        iniciouNoOverlay.current = false;
      }}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}




