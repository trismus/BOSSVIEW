import {
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';

// ─────────────────────────────────────────────────────────────────────────────
// SKYNEX Modal Component
// Issue #82: Glassmorphism modal with focus trap and animations
// ─────────────────────────────────────────────────────────────────────────────

export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  /** Controls visibility */
  open: boolean;
  /** Callback when modal requests to close */
  onClose: () => void;
  /** Modal title for accessibility (aria-labelledby) */
  title?: string;
  /** Modal content */
  children: ReactNode;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Close on backdrop click (default: true) */
  closeOnBackdropClick?: boolean;
  /** Close on Escape key (default: true) */
  closeOnEscape?: boolean;
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

/**
 * SKYNEX Modal
 *
 * - Glassmorphism effect (20px backdrop-blur, 60% opacity)
 * - Focus trap for accessibility
 * - Escape-to-close and backdrop click support
 * - Entry/exit animations (fade + scale)
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className = '',
  ...props
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // ─── Focus Management ─────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      // Store the currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus the modal
      setTimeout(() => {
        modalRef.current?.focus();
      }, 0);

      // Lock body scroll
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = '';
        // Restore focus when closing
        previousActiveElement.current?.focus();
      };
    }
  }, [open]);

  // ─── Escape Key Handler ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, closeOnEscape, onClose]);

  // ─── Focus Trap ───────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, []);

  // ─── Backdrop Click Handler ───────────────────────────────────────────────
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdropClick, onClose]
  );

  if (!open) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      aria-hidden="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm animate-modal-backdrop" />

      {/* Modal Panel */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={[
          // Glass effect
          'relative z-10 w-full',
          'bg-surface-container/90 backdrop-blur-glass',
          // Elevation & radius
          'shadow-elevation-lg rounded-skx-md',
          // Border (subtle ghost)
          'border border-ghost',
          // Size
          sizeClasses[size],
          // Animation
          'animate-modal-enter',
          // Custom classes
          className,
        ].join(' ')}
        {...props}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-on-surface-dim hover:text-on-surface rounded-skx-sm hover:bg-surface-container-high transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="p-6">
          {title && (
            <h2 id="modal-title" className="text-title-lg font-display text-on-surface mb-4 pr-8">
              {title}
            </h2>
          )}
          {children}
        </div>
      </div>
    </div>
  );

  // Portal to body
  return createPortal(modalContent, document.body);
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Sub-components for structured content
// ─────────────────────────────────────────────────────────────────────────────

export interface ModalHeaderProps {
  children: ReactNode;
  className?: string;
}

export function ModalHeader({ children, className = '' }: ModalHeaderProps) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
}

export interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

export function ModalBody({ children, className = '' }: ModalBodyProps) {
  return (
    <div className={`text-body-md text-on-surface-variant ${className}`}>
      {children}
    </div>
  );
}

export interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div className={`mt-6 flex items-center justify-end gap-3 ${className}`}>
      {children}
    </div>
  );
}
