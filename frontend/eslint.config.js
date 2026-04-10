import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tailwindcss from 'eslint-plugin-tailwindcss';
import prettier from 'eslint-config-prettier';
import skynexPlugin from './eslint-rules/index.js';

export default tseslint.config(
  // ─── Global ignores ────────────────────────────────────────────
  {
    ignores: ['dist/', 'node_modules/', 'eslint-rules/'],
  },

  // ─── Main TypeScript/React rules ───────────────────────────────
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
    ],
    plugins: {
      'react-refresh': reactRefresh,
      tailwindcss: tailwindcss,
      skynex: skynexPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        browser: true,
        es2020: true,
      },
    },
    settings: {
      tailwindcss: {
        // Path to Tailwind config relative to eslint.config.js
        config: 'tailwind.config.js',
        // Allow custom classes that aren't in Tailwind
        whitelist: ['skynex-.*'],
      },
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Convention: `_foo` means "intentionally unused"
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // ─── Tailwind CSS rules ──────────────────────────────────────
      // Warn on invalid/non-existent Tailwind classes
      'tailwindcss/classnames-order': 'warn',
      'tailwindcss/no-custom-classname': [
        'warn',
        {
          // Allow SKYNEX design system classes
          whitelist: ['skynex-.*', 'animate-.*'],
        },
      ],
      'tailwindcss/no-contradicting-classname': 'error',

      // ─── SKYNEX Design System rules ──────────────────────────────
      // Disallow hardcoded hex colors in style props
      'skynex/no-hardcoded-colors': 'error',
    },
  },

  // ─── Exemptions for design system source files ─────────────────
  // These files ARE the source of truth for colors, so hex values are allowed
  {
    files: ['src/styles/data-viz-colors.ts', 'src/styles/tokens.css', 'src/styles/*.cjs'],
    rules: {
      'skynex/no-hardcoded-colors': 'off',
    },
  },

  // ─── Prettier must be last to override conflicting rules ───────
  prettier,
);
