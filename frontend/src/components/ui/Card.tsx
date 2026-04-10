import { createContext, useContext, forwardRef, type HTMLAttributes, type ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SKYNEX Card Component
// Issue #79: Cards with tonal partitioning and nesting depth support
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Surface depth levels for the nesting depth principle.
 * Each level uses a progressively darker/lighter background.
 */
type SurfaceDepth = 0 | 1 | 2 | 3;

const CardDepthContext = createContext<SurfaceDepth>(0);

/**
 * Surface background classes mapped to nesting depth.
 * Nested cards automatically step down to the next surface level.
 */
const surfaceClasses: Record<SurfaceDepth, Record<'default' | 'recessed', string>> = {
  0: {
    default: 'bg-surface-container',
    recessed: 'bg-surface-container-lowest',
  },
  1: {
    default: 'bg-surface-container-low',
    recessed: 'bg-surface-container-lowest',
  },
  2: {
    default: 'bg-surface',
    recessed: 'bg-surface-container-lowest',
  },
  3: {
    default: 'bg-surface-container-lowest',
    recessed: 'bg-surface-container-lowest',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Card Props
// ─────────────────────────────────────────────────────────────────────────────

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card style variant */
  variant?: 'default' | 'recessed';
  /** Shadow elevation level */
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  /** Content to render inside the card */
  children: ReactNode;
}

const elevationClasses: Record<string, string> = {
  none: '',
  sm: 'shadow-elevation-sm',
  md: 'shadow-elevation-md',
  lg: 'shadow-elevation-lg',
};

/**
 * SKYNEX Card
 *
 * - Uses tonal partitioning (no borders) to establish hierarchy
 * - Nested cards automatically use deeper surface levels
 * - Supports recessed variant for input areas
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', elevation = 'none', className = '', children, ...props }, ref) => {
    const parentDepth = useContext(CardDepthContext);
    const currentDepth = Math.min(parentDepth, 3) as SurfaceDepth;
    const nextDepth = Math.min(currentDepth + 1, 3) as SurfaceDepth;

    const bgClass = surfaceClasses[currentDepth][variant];
    const shadowClass = elevationClasses[elevation];

    return (
      <CardDepthContext.Provider value={nextDepth}>
        <div
          ref={ref}
          className={[
            bgClass,
            'rounded-skx-md',
            'p-6',
            shadowClass,
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        >
          {children}
        </div>
      </CardDepthContext.Provider>
    );
  },
);

Card.displayName = 'Card';

// ─────────────────────────────────────────────────────────────────────────────
// Card Sub-components
// ─────────────────────────────────────────────────────────────────────────────

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={['mb-4', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </div>
  ),
);

CardHeader.displayName = 'CardHeader';

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  ),
);

CardBody.displayName = 'CardBody';

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={['mt-4 pt-4 border-t border-ghost', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </div>
  ),
);

CardFooter.displayName = 'CardFooter';
