import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SKYNEX Toast / Notification System
// Issue #83: Toast notifications with glow effect and stacking
// ─────────────────────────────────────────────────────────────────────────────

export type ToastVariant = 'critical' | 'warning' | 'success' | 'info';

export interface ToastData {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = no auto-dismiss
}

interface ToastContextValue {
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Toast Provider
// ─────────────────────────────────────────────────────────────────────────────

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 5000; // 5 seconds

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Critical toasts don't auto-dismiss by default
    const duration = toast.duration ?? (toast.variant === 'critical' ? 0 : DEFAULT_DURATION);

    setToasts((prev) => {
      const newToasts = [...prev, { ...toast, id, duration }];
      // Keep only the most recent MAX_TOASTS
      return newToasts.slice(-MAX_TOASTS);
    });

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useToast Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const { addToast, removeToast, clearAll } = context;

  return {
    toast: addToast,
    dismiss: removeToast,
    clearAll,
    // Convenience methods
    success: (title: string, message?: string) => addToast({ variant: 'success', title, message }),
    warning: (title: string, message?: string) => addToast({ variant: 'warning', title, message }),
    error: (title: string, message?: string) => addToast({ variant: 'critical', title, message }),
    info: (title: string, message?: string) => addToast({ variant: 'info', title, message }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast Container (renders at top-right)
// ─────────────────────────────────────────────────────────────────────────────

function ToastContainer() {
  const context = useContext(ToastContext);
  if (!context) return null;

  const { toasts } = context;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Toast Item
// ─────────────────────────────────────────────────────────────────────────────

const variantStyles: Record<ToastVariant, { bg: string; border: string; glow: string; icon: string }> = {
  critical: {
    bg: 'bg-error/[0.12]',
    border: 'border-error/40',
    glow: 'shadow-glow-error',
    icon: 'text-error',
  },
  warning: {
    bg: 'bg-warning/[0.12]',
    border: 'border-warning/40',
    glow: 'shadow-glow-warning',
    icon: 'text-warning',
  },
  success: {
    bg: 'bg-success/[0.12]',
    border: 'border-success/40',
    glow: 'shadow-glow-success',
    icon: 'text-success',
  },
  info: {
    bg: 'bg-info/[0.12]',
    border: 'border-info/40',
    glow: 'shadow-glow-primary',
    icon: 'text-info',
  },
};

function ToastItem({ id, variant, title, message, duration }: ToastData) {
  const context = useContext(ToastContext);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const styles = variantStyles[variant];

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    // Wait for exit animation before removing
    setTimeout(() => {
      context?.removeToast(id);
    }, 200);
  }, [context, id]);

  // Auto-dismiss timer
  useEffect(() => {
    if (duration && duration > 0) {
      timerRef.current = setTimeout(handleDismiss, duration);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [duration, handleDismiss]);

  return (
    <div
      role="alert"
      className={[
        // Base styles
        'pointer-events-auto',
        'w-80 p-4',
        'rounded-skx-md border',
        'backdrop-blur-glass',
        // Colors
        'bg-surface-container/90',
        styles.border,
        styles.glow,
        // Animation
        isExiting ? 'animate-toast-exit' : 'animate-toast-enter',
      ].join(' ')}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${styles.icon}`}>
          <ToastIcon variant={variant} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-title-sm text-on-surface font-semibold">{title}</p>
          {message && <p className="mt-1 text-body-sm text-on-surface-variant">{message}</p>}
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 -mr-1 -mt-1 text-on-surface-dim hover:text-on-surface rounded-skx-sm transition-colors"
          aria-label="Dismiss notification"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast Icons
// ─────────────────────────────────────────────────────────────────────────────

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const iconClass = 'w-5 h-5';

  switch (variant) {
    case 'critical':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    case 'warning':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case 'success':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}
