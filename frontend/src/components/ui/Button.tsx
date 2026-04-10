import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SKYNEX Button Component
// Issue #78: Primary / Secondary / Tertiary variants with full state support
// ─────────────────────────────────────────────────────────────────────────────

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'tertiary';
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Show loading spinner and disable interaction */
  loading?: boolean;
  /** Icon element to render before label */
  leftIcon?: ReactNode;
  /** Icon element to render after label */
  rightIcon?: ReactNode;
}

/**
 * SKYNEX Button
 *
 * - **Primary**: Gradient #99f7ff → #00f1fe with glow shadow
 * - **Secondary**: Ghost border + primary text, fills on hover
 * - **Tertiary**: Monospaced text only, underline on hover
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    // ─── Size classes ───────────────────────────────────────────────────────
    const sizeClasses: Record<string, string> = {
      sm: 'h-8 px-3 text-body-sm gap-1.5',
      md: 'h-10 px-5 text-body-md gap-2',
      lg: 'h-12 px-6 text-body-lg gap-2.5',
    };

    // ─── Variant classes ────────────────────────────────────────────────────
    const variantClasses: Record<string, string> = {
      primary: [
        'bg-gradient-primary text-on-primary font-semibold',
        'shadow-glow-primary',
        'hover:shadow-glow-primary-strong hover:-translate-y-0.5',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none',
      ].join(' '),
      secondary: [
        'bg-transparent text-primary font-semibold',
        'border border-ghost',
        'hover:bg-primary/10 hover:border-primary-ghost',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent',
      ].join(' '),
      tertiary: [
        'bg-transparent text-primary font-mono font-medium',
        'underline-offset-4',
        'hover:underline',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline',
      ].join(' '),
    };

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        className={[
          // Base styles
          'inline-flex items-center justify-center',
          'rounded-skx-md',
          'transition-all duration-150 ease-out',
          'select-none whitespace-nowrap',
          // Size
          sizeClasses[size],
          // Variant
          variantClasses[variant],
          // Custom classes
          className,
        ].join(' ')}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {/* Left icon */}
        {!loading && leftIcon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        {/* Label */}
        <span>{children}</span>

        {/* Right icon */}
        {rightIcon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
