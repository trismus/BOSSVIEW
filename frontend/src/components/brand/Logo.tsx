/**
 * SKYNEX Brand Logo Component
 *
 * Wiederverwendbare React-Komponente für alle Logo-Verwendungen in der App.
 * Unterstützt vier Varianten: lockup (Default), mark, mono, icon.
 *
 * Vite-Setup-Voraussetzung:
 *   npm install -D vite-plugin-svgr
 *
 *   // vite.config.ts
 *   import svgr from 'vite-plugin-svgr';
 *   export default defineConfig({ plugins: [react(), svgr()] });
 *
 * Datei-Platzierung im Frontend:
 *   frontend/src/components/brand/Logo.tsx          <- diese Datei
 *   frontend/src/assets/logo/skynex-lockup.svg      <- aus docs/branding/assets/
 *   frontend/src/assets/logo/skynex-mark.svg
 *   frontend/src/assets/logo/skynex-mono.svg
 *
 * Usage:
 *   import { Logo } from '@/components/brand/Logo';
 *
 *   // In der Topbar:
 *   <Logo variant="lockup" height={32} />
 *
 *   // In der collapsed Sidebar:
 *   <Logo variant="mark" height={32} />
 *
 *   // In einem monochromen Kontext (z.B. Print-Export):
 *   <Logo variant="mono" height={24} className="text-on-surface-variant" />
 *
 *   // Als Loader/Splash:
 *   <Logo variant="mark" height={120} className="animate-pulse" />
 */

import type { FC, SVGProps } from 'react';

// Vite + vite-plugin-svgr imports — the `?react` query turns SVG files into
// React components. Adjust paths to match your `src/assets/logo/` location.
import LockupSvg from '@/assets/logo/skynex-lockup.svg?react';
import MarkSvg from '@/assets/logo/skynex-mark.svg?react';
import MonoSvg from '@/assets/logo/skynex-mono.svg?react';

export type LogoVariant = 'lockup' | 'mark' | 'mono';

export interface LogoProps extends Omit<SVGProps<SVGSVGElement>, 'height' | 'width'> {
  /** Visual variant. Default: 'lockup' (icon + wordmark + tagline). */
  variant?: LogoVariant;
  /** Height in pixels or CSS length. Width scales proportionally. */
  height?: number | string;
  /** Accessible label. Default: 'SKYNEX'. */
  'aria-label'?: string;
}

const COMPONENTS: Record<LogoVariant, FC<SVGProps<SVGSVGElement>>> = {
  lockup: LockupSvg,
  mark: MarkSvg,
  mono: MonoSvg,
};

/**
 * SKYNEX brand logo. Renders one of three SVG variants.
 */
export const Logo: FC<LogoProps> = ({
  variant = 'lockup',
  height = 32,
  'aria-label': ariaLabel = 'SKYNEX',
  style,
  ...rest
}) => {
  const SvgComponent = COMPONENTS[variant];

  return (
    <SvgComponent
      role="img"
      aria-label={ariaLabel}
      style={{ height, width: 'auto', ...style }}
      {...rest}
    />
  );
};

export default Logo;
