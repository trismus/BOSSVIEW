import { forwardRef, useMemo, type HTMLAttributes } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SKYNEX KPI Widget Component
// Issue #84: KPI display with micro-sparkline and delta indicator
// ─────────────────────────────────────────────────────────────────────────────

export interface KPIWidgetProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /** KPI label/title */
  label: string;
  /** Main KPI value (will be displayed large) */
  value: string | number;
  /** Change from previous period (e.g., +5, -2.3) */
  delta?: number;
  /** Unit suffix (e.g., '%', 'ms', 'req/s') */
  unit?: string;
  /** Sparkline data points (normalized 0-1 or raw values) */
  sparklineData?: number[];
  /** Status indicator */
  status?: 'success' | 'warning' | 'error' | 'info';
  /** Show pulsing status dot */
  showStatusDot?: boolean;
  /** Click handler for drill-down navigation */
  onClick?: () => void;
}

/**
 * SKYNEX KPI Widget
 *
 * Dashboard element for key performance indicators:
 * - Large monospaced number (display-md, 45px)
 * - Micro-sparkline behind the value
 * - Delta indicator with color coding
 * - Optional status dot indicator
 */
export const KPIWidget = forwardRef<HTMLDivElement, KPIWidgetProps>(
  (
    {
      label,
      value,
      delta,
      unit,
      sparklineData,
      status,
      showStatusDot,
      onClick,
      className = '',
      ...props
    },
    ref
  ) => {
    const isClickable = !!onClick;

    // Determine delta color
    const deltaColor = useMemo(() => {
      if (delta === undefined || delta === 0) return 'text-on-surface-dim';
      return delta > 0 ? 'text-success' : 'text-error';
    }, [delta]);

    // Format delta string
    const deltaString = useMemo(() => {
      if (delta === undefined) return null;
      const prefix = delta > 0 ? '↑' : delta < 0 ? '↓' : '';
      return `${prefix}${Math.abs(delta)}${unit ?? ''}`;
    }, [delta, unit]);

    // Status color for dot
    const statusColor: Record<string, string> = {
      success: 'bg-success',
      warning: 'bg-warning',
      error: 'bg-error',
      info: 'bg-info',
    };

    return (
      <div
        ref={ref}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={onClick}
        onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
        className={[
          // Base container
          'relative overflow-hidden',
          'bg-surface-container rounded-skx-md p-6',
          // Interactive states
          isClickable && 'cursor-pointer hover:bg-surface-container-high transition-colors',
          isClickable && 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
          // Custom
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {/* Micro Sparkline (behind content) */}
        {sparklineData && sparklineData.length > 1 && (
          <MicroSparkline data={sparklineData} className="absolute inset-0 opacity-30" />
        )}

        {/* Content */}
        <div className="relative z-10">
          {/* Label row with optional status dot */}
          <div className="flex items-center gap-2 mb-2">
            {showStatusDot && status && (
              <span
                className={[
                  'w-2 h-2 rounded-full',
                  statusColor[status],
                  status === 'error' && 'animate-pulse',
                ].join(' ')}
              />
            )}
            <span className="text-label-md text-on-surface-variant uppercase tracking-wider">
              {label}
            </span>
          </div>

          {/* Value row */}
          <div className="flex items-baseline gap-2">
            <span className="text-display-md font-mono tabular-nums text-on-surface">
              {value}
            </span>
            {unit && (
              <span className="text-title-sm text-on-surface-dim">{unit}</span>
            )}
          </div>

          {/* Delta indicator */}
          {deltaString && (
            <div className={`mt-2 text-body-sm font-mono ${deltaColor}`}>
              {deltaString}
            </div>
          )}
        </div>
      </div>
    );
  }
);

KPIWidget.displayName = 'KPIWidget';

// ─────────────────────────────────────────────────────────────────────────────
// Micro Sparkline SVG
// ─────────────────────────────────────────────────────────────────────────────

interface MicroSparklineProps {
  data: number[];
  className?: string;
}

function MicroSparkline({ data, className = '' }: MicroSparklineProps) {
  // Normalize data to 0-1 range
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const normalized = data.map((v) => (v - min) / range);

  // Generate path
  const width = 100;
  const height = 40;
  const padding = 4;

  const points = normalized.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - v * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  // Area fill path (closed at bottom)
  const areaD = `${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`w-full h-full ${className}`}
      aria-hidden="true"
    >
      {/* Area fill */}
      <path
        d={areaD}
        fill="currentColor"
        className="text-outline-variant"
        opacity={0.1}
      />
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-outline-variant"
      />
    </svg>
  );
}
