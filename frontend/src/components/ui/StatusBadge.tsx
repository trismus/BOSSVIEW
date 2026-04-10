import { forwardRef, type HTMLAttributes } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SKYNEX StatusBadge Component
// Issue #80: Status badges with glow effect — the "warning lights" of the system
// ─────────────────────────────────────────────────────────────────────────────

export type StatusBadgeStatus = 'critical' | 'warning' | 'success' | 'info';

export interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Status type determines color scheme */
  status: StatusBadgeStatus;
  /** Size preset */
  size?: 'sm' | 'md';
  /** Badge label text */
  children: string;
  /** Enable pulsing animation (recommended for critical) */
  pulse?: boolean;
}

/**
 * Status color configuration
 * - text: Full status color for text
 * - bg: 12% opacity background
 * - border: 40% opacity border
 * - glow: 30% opacity outer glow
 */
const statusStyles: Record<StatusBadgeStatus, { text: string; bg: string; border: string; glow: string }> = {
  critical: {
    text: 'text-error',
    bg: 'bg-error/[0.12]',
    border: 'border-error/40',
    glow: 'shadow-glow-error',
  },
  warning: {
    text: 'text-warning',
    bg: 'bg-warning/[0.12]',
    border: 'border-warning/40',
    glow: 'shadow-glow-warning',
  },
  success: {
    text: 'text-success',
    bg: 'bg-success/[0.12]',
    border: 'border-success/40',
    glow: 'shadow-glow-success',
  },
  info: {
    text: 'text-info',
    bg: 'bg-info/[0.12]',
    border: 'border-info/40',
    glow: 'shadow-glow-primary',
  },
};

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-label-md',
};

/**
 * SKYNEX StatusBadge
 *
 * Status badges function as the "warning lights" of the system.
 * They use a consistent glow effect to simulate physical indicators.
 *
 * - 0.5px border in status color @ 40% opacity
 * - Background in status color @ 12% opacity
 * - Outer glow (box-shadow) in status color @ 30% opacity
 * - JetBrains Mono font, uppercase text
 */
export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, size = 'md', pulse = false, className = '', children, ...props }, ref) => {
    const styles = statusStyles[status];
    const sizeClass = sizeStyles[size];

    // Auto-enable pulse for critical if not explicitly set
    const shouldPulse = pulse || (status === 'critical' && pulse !== false);

    return (
      <span
        ref={ref}
        role="status"
        className={[
          // Base styles
          'inline-flex items-center justify-center',
          'font-mono font-medium uppercase tracking-wider',
          'rounded-skx-xs',
          'border',
          // Border width: 0.5px (use shadow trick since border-width doesn't support 0.5px)
          'ring-[0.5px] ring-inset',
          // Size
          sizeClass,
          // Status colors
          styles.text,
          styles.bg,
          styles.border,
          styles.glow,
          // Ring color matches border
          status === 'critical' && 'ring-error/40',
          status === 'warning' && 'ring-warning/40',
          status === 'success' && 'ring-success/40',
          status === 'info' && 'ring-info/40',
          // Pulsing animation
          shouldPulse && 'animate-pulse',
          // Custom classes
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </span>
    );
  },
);

StatusBadge.displayName = 'StatusBadge';
