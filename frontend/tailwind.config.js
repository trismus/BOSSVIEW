import { createRequire } from 'module';

// Load the canonical SKYNEX theme extension from the design-system source
// of truth. Kept as CJS under docs/branding/tokens/ so the upstream format
// isn't forced into an ESM rewrite.
const require = createRequire(import.meta.url);
const skynexTheme = require('../docs/branding/tokens/tailwind.config.js');

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      ...skynexTheme.theme.extend,
      colors: {
        // SKYNEX colors first, then repo-specific brand palette.
        ...skynexTheme.theme.extend.colors,
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      keyframes: {
        ...(skynexTheme.theme.extend.keyframes ?? {}),
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        ...(skynexTheme.theme.extend.animation ?? {}),
        'slide-in-right': 'slide-in-right 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
