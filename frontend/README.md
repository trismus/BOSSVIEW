# BOSSVIEW Frontend

React-basierte Single-Page-Application (SPA) fuer BOSSVIEW — das Dark-Mode-Dashboard der Luftfahrt-IT-Management-Plattform. Visualisiert Asset-Inventar (PROTack) und Schwachstellen (Qualys), bietet Import-Workflows und Echtzeit-Status der zugrundeliegenden Infrastruktur.

Stack: React 18 + TypeScript + Vite + Tailwind CSS + React Router.

## Voraussetzungen

- **Node.js 20** (siehe `.nvmrc`). Mit `nvm use` laedt der korrekte Major automatisch.
- **Docker** (empfohlen) fuer die Full-Stack-Entwicklung zusammen mit Backend, PostgreSQL und Nginx.

## Lokales Setup

### Empfohlen: Full-Stack via Docker Compose

Vom Repository-Root ausfuehren:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Das Frontend ist danach unter `http://localhost:3000` erreichbar, das API-Backend unter `http://localhost:8000`.

### Alternative: Standalone auf dem Host

Fuer isolierte UI-Arbeit ohne Backend-Container:

```bash
cd frontend
npm install
npm run dev
```

Der Vite-Dev-Server laeuft auf `http://localhost:3000`.

> **Hinweis zum Port:** Der Frontend-Dev-Server laeuft bewusst auf Port **3000** statt dem Vite-Standardport 5173. Damit bleibt das Port-Layout konsistent mit dem Docker-Dev-Stack, der Nginx-Reverse-Proxy-Konfiguration und der CORS-Whitelist des Backends.

## Scripts

| Script | Beschreibung |
|--------|--------------|
| `npm run dev` | Startet den Vite-Dev-Server auf Port 3000 (Hot Module Reload). |
| `npm run build` | TypeScript-Kompilierung + Vite-Production-Build nach `dist/`. |
| `npm run lint` | ESLint ueber `src/**/*.{ts,tsx}`. |
| `npm run format` | Prettier-Autoformatierung fuer das gesamte Projekt. |
| `npm run format:check` | Prueft Formatierung ohne Aenderungen (CI-geeignet). |
| `npm run typecheck` | `tsc --noEmit` — Typ-Validierung ohne Build-Output. |

## Design-System

Das UI folgt dem **SKYNEX v1.0 Design-System** (Dark-Mode, Teal/Amber/Blue Akzente, DM Sans + JetBrains Mono). Tokens, Komponenten-Referenz und Styleguide liegen unter `docs/branding/` im Repository-Root.

## Projektstruktur

```
frontend/src/
├── api/          # Typisierter Axios/Fetch-Client, Endpoint-Definitionen
├── components/   # Wiederverwendbare UI-Komponenten
├── context/      # React-Context-Provider (Auth, Theme, Toast)
├── guards/       # Route-Guards (requireAuth, requireRole)
├── hooks/        # Custom Hooks (useQuery-Wrapper, useWebSocket, ...)
├── pages/        # Route-Level-Komponenten
├── store/        # Client-State
├── types/        # Geteilte TypeScript-Typen
├── App.tsx       # Layout-Shell + Routing
└── main.tsx      # Vite-Entry
```
