# SKYNEX Brand Assets — Integration Guide

Produktionsreife Logo-Assets und React-Komponente für die BOSSVIEW Web-App.

## Dateien in diesem Ordner

| Datei | Zweck | Verwendung |
|---|---|---|
| `skynex-lockup.svg` | Horizontal Lockup (Icon + "SKYNEX" + Tagline) | Topbar, Login-Screen, Header |
| `skynex-mark.svg` | Nur das Icon (Radar + Knoten) | Collapsed Sidebar, Avatar, Splash-Screen |
| `skynex-mono.svg` | Einfärbiges Icon (`currentColor`) | Print, Exporte, einfärbige Kontexte |
| `skynex-favicon.svg` | Favicon mit Dark-Tile-Background | Browser-Tab, Bookmark |
| `Logo.tsx` | React-Komponente | Frontend-Integration |

Alle SVGs haben **transparente Hintergründe** (ausser `favicon.svg`, das ein Dark-Tile hat, damit es in der hellen Browser-UI lesbar bleibt).

## 1. Assets ins Frontend kopieren

Sobald das Frontend-Skeleton gebaut ist (Issue #74), die SVGs hier rein kopieren:

```bash
mkdir -p frontend/src/assets/logo
cp docs/branding/assets/skynex-lockup.svg   frontend/src/assets/logo/
cp docs/branding/assets/skynex-mark.svg     frontend/src/assets/logo/
cp docs/branding/assets/skynex-mono.svg     frontend/src/assets/logo/
cp docs/branding/assets/Logo.tsx            frontend/src/components/brand/Logo.tsx

# Favicon kommt in public/ damit Vite es direkt ausliefert
cp docs/branding/assets/skynex-favicon.svg  frontend/public/favicon.svg
```

## 2. Vite-Plugin für SVG-als-React-Component installieren

Der Logo-Component nutzt `vite-plugin-svgr`, das den Import `import MarkSvg from '...svg?react'` ermöglicht:

```bash
cd frontend
npm install -D vite-plugin-svgr
```

In `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), svgr()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

Der `@`-Alias ermöglicht saubere Imports wie `import { Logo } from '@/components/brand/Logo'`.

## 3. TypeScript-Deklaration ergänzen

Damit TypeScript die `?react`-Imports kennt, in `frontend/src/vite-env.d.ts` hinzufügen:

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
```

## 4. Favicon im HTML verdrahten

In `frontend/index.html`:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="mask-icon" href="/favicon.svg" color="#00f1fe" />
<meta name="theme-color" content="#0b0e14" />
<title>SKYNEX — Mission Control for IT</title>
```

## 5. Komponente verwenden

### In der Topbar (Issue #76 App-Shell)

```tsx
import { Logo } from '@/components/brand/Logo';

export const Topbar = () => (
  <header className="flex items-center h-14 px-6 bg-surface-container">
    <Logo variant="lockup" height={32} />
    {/* ...rest of topbar */}
  </header>
);
```

### In der collapsed Sidebar

```tsx
<aside className={collapsed ? 'w-16' : 'w-60'}>
  {collapsed ? (
    <Logo variant="mark" height={32} />
  ) : (
    <Logo variant="lockup" height={28} />
  )}
</aside>
```

### Im Login-Screen

```tsx
<div className="flex flex-col items-center gap-8">
  <Logo variant="lockup" height={48} />
  <LoginForm />
</div>
```

### Monochrom für Print / Exporte

```tsx
{/* Inherits color from parent via `currentColor` */}
<div className="text-on-surface-variant">
  <Logo variant="mono" height={24} />
</div>
```

## 6. Fonts sicherstellen

Das Lockup-SVG referenziert `Space Grotesk` und `JetBrains Mono`. Diese müssen im Frontend geladen sein (wird durch Issue #75 erledigt). Wenn die Fonts fehlen, fällt der Browser auf den Fallback zurück — das Lockup sieht dann weniger markant aus, funktioniert aber weiterhin.

Für die SVGs ausserhalb der App (E-Mails, Print, externe Dokumente) empfiehlt sich langfristig, die Wordmark in Pfade zu konvertieren (z. B. mit `svgo` oder manuell in Figma/Inkscape) — dann ist das Logo überall pixel-identisch.

## 7. Logo-Platzierung auf GitHub-Issues mappen

Die Logo-Integration betrifft folgende bereits angelegte Issues:

- **Issue #75** — Design-Tokens integrieren → Fonts für SVG-Lockup laden
- **Issue #76** — App-Shell mit Sidebar + Topbar → Logo in Topbar platzieren
- **Issue #88** — Storybook-Setup → Logo-Komponente als eigene Story

Kein separates Logo-Ticket nötig — einfach die Acceptance Criteria dieser drei Issues entsprechend umsetzen.

## 8. Zukünftige Optimierungen (optional, Follow-Up)

- **SVGO-Pass** auf allen SVGs für kleinere Dateigrössen (`npx svgo *.svg`)
- **Wordmark → Paths** für Font-unabhängige Darstellung in externen Kontexten
- **PNG-Fallbacks** für E-Mail-Signaturen und Umgebungen ohne SVG-Support
- **Dark/Light-Variante** des Lockups für hellen Hintergrund (wird aktuell nicht gebraucht, da die App immer dark mode ist)

---

**Brand Guardrails:** Die SKYNEX-Wortmarke bleibt immer zweifarbig — "SKY" in `on-surface` (#e4e6eb), "NEX" im Neon-Gradient (#99f7ff → #00f1fe). Nie den Gradient auf die ganze Wortmarke anwenden, nie "SKY" in Neon setzen. Das ist das zentrale Identity-Element.
