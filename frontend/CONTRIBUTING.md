# Contributing to SKYNEX Frontend

## Design System Guidelines

SKYNEX uses a strict design system to ensure visual consistency across the application. The linting rules enforce these conventions automatically.

### Color Usage

**Never use hardcoded hex colors in components.**

```tsx
// Bad - hardcoded hex
<div style={{ color: '#ff0000' }}>Error</div>
<div style={{ background: '#0a0e17' }}>Panel</div>

// Good - import from data-viz-colors.ts
import { STATUS_COLORS, UI_CHROME } from '../styles/data-viz-colors';
<div style={{ color: STATUS_COLORS.red }}>Error</div>
<div style={{ background: UI_CHROME.bg }}>Panel</div>

// Good - use Tailwind classes
<div className="text-red-500">Error</div>
<div className="bg-skynex-surface-primary">Panel</div>
```

### Where Colors Are Defined

| Source | Purpose | Location |
|--------|---------|----------|
| **SKYNEX Design Tokens** | Brand colors, UI chrome | `src/styles/tokens.css` |
| **Data-Viz Colors** | Infrastructure visualization | `src/styles/data-viz-colors.ts` |
| **Tailwind Config** | Utility classes | `tailwind.config.js` |

### Allowed Exceptions

The following files are exempt from the no-hardcoded-colors rule because they ARE the source of truth:

- `src/styles/data-viz-colors.ts` — Infrastructure visualization palette
- `src/styles/tokens.css` — SKYNEX design tokens
- `src/styles/skynex-tailwind.config.cjs` — Tailwind theme extension

## Linting

### Available Commands

```bash
# Run all linters (ESLint + Stylelint)
npm run lint

# Run ESLint only
npm run lint:eslint

# Run Stylelint only (CSS files)
npm run lint:stylelint

# Check Prettier formatting
npm run format:check

# Auto-fix formatting
npm run format

# TypeScript type check
npm run typecheck
```

### ESLint Rules

| Rule | Severity | Purpose |
|------|----------|---------|
| `skynex/no-hardcoded-colors` | Error | No hex colors in style props |
| `tailwindcss/no-custom-classname` | Warn | Flag non-Tailwind classes |
| `tailwindcss/no-contradicting-classname` | Error | Catch conflicting classes |
| `tailwindcss/classnames-order` | Warn | Consistent class ordering |

### Stylelint Rules

| Rule | Severity | Purpose |
|------|----------|---------|
| `declaration-strict-value` | Error | No hardcoded colors in CSS |

### CI Pipeline

Pull requests are blocked if linting fails. The CI runs:

1. `npm run lint:eslint` — ESLint checks
2. `npm run lint:stylelint` — Stylelint checks
3. `npm run typecheck` — TypeScript compilation
4. `npm run format:check` — Prettier formatting
5. `npm run build` — Production build

## Adding New Colors

### For UI Components

1. Check if a suitable color exists in `tokens.css` or Tailwind
2. If not, discuss with the design team (Kim) before adding
3. Add to `tokens.css` with a semantic name

### For Data Visualization

1. Add to `src/styles/data-viz-colors.ts`
2. Use the appropriate category (STATUS_COLORS, PORT_STATUS_COLORS, etc.)
3. Export with proper TypeScript typing
4. Document the color's purpose in the file comments

## Tailwind Classes

### SKYNEX Custom Classes

The design system extends Tailwind with custom classes. Use the `skynex-` prefix:

```tsx
// Surface colors
className="bg-skynex-surface-primary"
className="bg-skynex-surface-secondary"

// Text colors
className="text-skynex-text-primary"
className="text-skynex-text-muted"

// Status colors
className="text-skynex-status-success"
className="text-skynex-status-error"
```

### Class Name Ordering

The linter enforces consistent Tailwind class ordering. Let the auto-formatter handle this:

```bash
npm run format
```

## Questions?

- **Design System**: Ask Kim (UI/UX)
- **Architecture**: Ask Martin (Architect)
- **Security**: Ask Ioannis (Security)
