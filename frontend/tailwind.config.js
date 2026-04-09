import { createRequire } from 'module';

// Load the SKYNEX theme extension. Source of truth lives at
// docs/branding/tokens/tailwind.config.js, but that path is outside the
// frontend Docker dev container (which only mounts frontend/). We keep
// a synced copy at src/styles/skynex-tailwind.config.cjs so both the
// host and the container can resolve it. The .cjs extension is required
// because the frontend package.json sets "type": "module".
const require = createRequire(import.meta.url);
const skynexTheme = require('./src/styles/skynex-tailwind.config.cjs');

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
