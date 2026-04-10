# Milestone: SKYNEX Rebrand — Name Change & Logo Integration

**Ziel:** Vollständiger Rebrand von **BOSSVIEW → SKYNEX** in Code, Docs, Deployment und UI. Integration der produktionsreifen Logo-Assets (`docs/branding/assets/`) in die laufende Frontend-App.

**Dauer (Schätzung):** 1–2 Sprints (je nach Parallelisierung mit Design-System-Milestone).

**Abhängigkeiten:**
- Existierende Design-System-Milestone (Issues #74–#89) läuft parallel — Logo-Integration unten verweist auf die dort angelegten Issues, wenn sinnvoll, statt Duplikate zu erzeugen.
- Frontend-Skeleton existiert bereits in `frontend/` — Logo kann direkt integriert werden, kein Warten auf Issue #74 nötig.

---

## Success Criteria

Der Rebrand gilt als abgeschlossen, wenn folgende Punkte erfüllt sind:

1. Kein `BOSSVIEW` / `bossview` mehr in User-facing Strings (UI, E-Mails, Reports, Meta-Tags, Page-Titles, Fehlermeldungen).
2. `grep -ri bossview` im Repo gibt nur noch historische Treffer in `docs/branding/` (Release-Notes, History) und im `CHANGELOG` zurück.
3. Alle Container, Services und Datenbank-Objekte tragen einen SKYNEX-Namen ODER behalten bewusst ihren internen Legacy-Namen (dokumentiert).
4. Das SKYNEX-Logo ist in Topbar, Sidebar und Login-Screen sichtbar und nutzt die produktionsreifen Assets aus `docs/branding/assets/`.
5. Das Favicon im Browser-Tab zeigt das SKYNEX-Icon auf Deep-Space-Tile.
6. Audit-Trail-Einträge aus der Rebrand-Migration sind lückenlos dokumentiert (ISO 27001 Annex A).

---

## Epic 1 — Repository & Naming

**Ziel:** Repository-Name, Git-Metadaten und alle Top-Level-Referenzen auf SKYNEX umstellen.

### Issue — Rename GitHub repository `trismus/BOSSVIEW` → `trismus/SKYNEX`
**Labels:** `rebrand`, `epic:naming`, `priority:p0`
**Acceptance:**
- Repo-Rename über GitHub-Settings durchgeführt.
- GitHub leitet alte URL automatisch weiter — getestet mit `git clone git@github.com:trismus/BOSSVIEW.git`.
- Alle Team-Mitglieder haben `git remote set-url origin git@github.com:trismus/SKYNEX.git` ausgeführt.
- README und Repo-Description aktualisiert.
- Beliebte interne Links (Confluence, Slack-Pins) auf neue URL umgestellt.

### Issue — Update root-level documentation: `README.md`, `CLAUDE.md`, `SECURITY.md`, `LICENSE`
**Labels:** `rebrand`, `epic:naming`, `priority:p0`
**Acceptance:**
- `README.md`: Projektname, Badges, Screenshots, Setup-Befehle.
- `CLAUDE.md`: Projekt-Bezeichnung, Tagline, Tech-Stack-Header.
- `SECURITY.md`: Contact-E-Mail und Projekt-Bezeichnung.
- `LICENSE`: Copyright-Header (falls BOSSVIEW als Name erscheint — nur Copyright-Holder-Zeile).
- Keine funktionalen Code-Änderungen in diesem Issue.

### Issue — Rename `docs/BOSSVIEW_PRD_v1.md` → `docs/SKYNEX_PRD_v1.md` (+ Querverweise)
**Labels:** `rebrand`, `epic:naming`, `docs`, `priority:p1`
**Acceptance:**
- Datei umbenannt per `git mv`.
- Alle internen Verweise auf das PRD im Repo aktualisiert (`grep -r "BOSSVIEW_PRD"`).
- Diagramme und Tabellen im PRD auf SKYNEX umgestellt.
- Versionshistorie am Dateiende dokumentiert den Rename als v1.1.

### Issue — Rename `docs/BOSSVIEW_Architecture_v1.md` → `docs/SKYNEX_Architecture_v1.md`
**Labels:** `rebrand`, `epic:naming`, `docs`, `priority:p1`
**Acceptance:**
- Datei umbenannt, Diagramme aktualisiert.
- Alle Architektur-Referenzen im Code/Docs aktualisiert.

### Issue — Rename legacy `BOSSVIEW/` subfolder → `skynex-legacy/` oder archivieren
**Labels:** `rebrand`, `epic:naming`, `tech-debt`, `priority:p2`
**Acceptance:**
- Entscheidung dokumentiert (archivieren vs. umbenennen vs. entfernen).
- Wenn archiviert: in `archive/bossview-prototype/` verschoben mit README-Hinweis.
- `CLAUDE.md` und `PROJECT_STRUCTURE.md` aktualisiert.

---

## Epic 2 — Codebase Rename

**Ziel:** Alle Referenzen auf `BOSSVIEW` / `bossview` in Code, Tests, Configs und Services entfernen. Konservativ vorgehen: User-facing zuerst, interne Bezeichner (DB-Schemas, Container-Namen) nur wenn risikoarm migrierbar.

### Issue — Update `docker-compose.yml` + `docker-compose.dev.yml` (service/container names, networks)
**Labels:** `rebrand`, `epic:code`, `devops`, `priority:p1`
**Acceptance:**
- Service-Namen: `bossview-backend` → `skynex-backend`, etc.
- Container-Namen, Network-Name, Volume-Namen angepasst.
- Lokale Dev-Umgebung startet weiterhin (`docker compose up` getestet).
- `.env.example` angepasst, wo Namen referenziert werden.
- **Achtung:** Named Volumes werden beim Rename neu erstellt — Migrationshinweis in PR-Description.

### Issue — Update Nginx config: `nginx.conf` + `conf.d/*.conf`
**Labels:** `rebrand`, `epic:code`, `devops`, `priority:p1`
**Acceptance:**
- `upstream bossview_backend` → `upstream skynex_backend`.
- `server_name` bleibt vorerst (DNS-Umstellung ist eigenes Issue — siehe Epic 4).
- Logs-Pfade falls hartcodiert.
- Reload funktioniert ohne Fehler (`nginx -t`).

### Issue — Rename backend source strings: log prefixes, swagger title, health endpoint
**Labels:** `rebrand`, `epic:code`, `backend`, `priority:p1`
**Acceptance:**
- `backend/src/swagger.ts`: API-Titel auf "SKYNEX API".
- `backend/src/index.ts`: Bootstrap-Log-Zeile.
- `backend/src/websocket.ts`: WebSocket server id/name.
- Kein Impact auf API-Routen oder Response-Payloads (Backwards-Compatibility gewahrt).

### Issue — Rename frontend source strings: page titles, meta tags, error messages, UI copy
**Labels:** `rebrand`, `epic:code`, `frontend`, `priority:p0`
**Acceptance:**
- `index.html` title und meta tags auf "SKYNEX — Mission Control for IT".
- `LoginPage.tsx`: Welcome-Header, Tagline.
- `Layout.tsx`: App-Bezeichnung.
- `helpContent.ts`: alle Treffer auf BOSSVIEW ersetzt.
- `InfrastructurePage.tsx`, `VulnerabilityDetailDrawer.tsx`, `PageHelpBanner.tsx`, `WorldMapView.tsx`, `useWebSocket.ts`: Strings geprüft und ersetzt.
- Keine funktionalen Änderungen.

### Issue — Database: evaluate schema/table/comment rename vs. keep
**Labels:** `rebrand`, `epic:code`, `database`, `priority:p2`
**Acceptance:**
- **Decision doc** in `docs/decisions/0001-db-name-post-rebrand.md`: Behalten wir den DB-Namen `bossview` oder migrieren wir auf `skynex`?
- Empfehlung: Name behalten, nur Comments/Kommentare in Migration-Files aktualisieren. Grund: Audit-Trail-Stabilität, keine Migration-Downtime, ISO-27001 Change-Ticket-Overhead.
- Kommentare in allen `database/migrations/*.sql` Files auf SKYNEX aktualisiert (nur Text in `COMMENT ON ...` Statements, keine Struktur-Änderungen).
- Wenn Migration beschlossen: separater Issue mit Downtime-Fenster.

### Issue — Update test fixtures and test descriptions
**Labels:** `rebrand`, `epic:code`, `test`, `priority:p2`
**Acceptance:**
- `backend/tests/*.test.ts`: Projekt-Bezeichnungen in `describe`-Blöcken aktualisiert.
- Seed-Daten (`backend/src/seed.ts`) auf SKYNEX-Namen.
- Testsuite läuft grün (`npm test`).

---

## Epic 3 — Logo Integration

**Ziel:** Produktionsreife Brand-Assets aus `docs/branding/assets/` in die Frontend-App einbauen. Konsistente Verwendung in allen Bereichen (Topbar, Sidebar, Login, Loader, Favicon, Auth-Screens).

### Issue — Copy brand assets to `frontend/src/assets/logo/` and install `vite-plugin-svgr`
**Labels:** `rebrand`, `epic:logo`, `frontend`, `priority:p0`
**Acceptance:**
- `skynex-lockup.svg`, `skynex-mark.svg`, `skynex-mono.svg` nach `frontend/src/assets/logo/` kopiert.
- `skynex-favicon.svg` nach `frontend/public/favicon.svg` kopiert.
- `npm install -D vite-plugin-svgr` durchgeführt, `package.json` committed.
- `vite.config.ts` aktualisiert mit `svgr()` Plugin.
- `src/vite-env.d.ts` erweitert mit `/// <reference types="vite-plugin-svgr/client" />`.
- Build läuft grün (`npm run build`).

### Issue — Install `<Logo>` component at `frontend/src/components/brand/Logo.tsx`
**Labels:** `rebrand`, `epic:logo`, `frontend`, `priority:p0`
**Acceptance:**
- `docs/branding/assets/Logo.tsx` nach `frontend/src/components/brand/Logo.tsx` kopiert.
- TypeScript compiliert ohne Fehler.
- Component exportiert `Logo` und `LogoVariant` Type.
- JSDoc mit Usage-Beispielen vorhanden (aus Original-Datei übernommen).

### Issue — Wire favicon + meta tags in `frontend/index.html`
**Labels:** `rebrand`, `epic:logo`, `frontend`, `priority:p0`
**Acceptance:**
- `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` eingebaut.
- `<link rel="mask-icon" href="/favicon.svg" color="#00f1fe" />` für Safari.
- `<meta name="theme-color" content="#0b0e14" />`.
- `<title>SKYNEX — Mission Control for IT</title>`.
- `<meta name="description">` auf neuen Claim aktualisiert.
- Open-Graph-Tags: `og:title`, `og:description`, `og:image` (verweist auf einen statischen PNG-Export des Logos — kann als Follow-Up-Issue behandelt werden, wenn PNG noch fehlt).

### Issue — Integrate `<Logo variant="lockup">` in Topbar (`Layout.tsx`)
**Labels:** `rebrand`, `epic:logo`, `frontend`, `priority:p0`
**Related:** design-system Issue #76 (App-Shell)
**Acceptance:**
- Topbar-Komponente in `frontend/src/components/Layout.tsx` (oder neuer `layout/Topbar.tsx`) zeigt Logo-Lockup links.
- Höhe `32px`, kein zusätzlicher Padding-Hack.
- Aria-Label "SKYNEX — Mission Control for IT" gesetzt.
- Logo-Klick navigiert zum Dashboard (`/`).

### Issue — Integrate `<Logo variant="mark">` in collapsed Sidebar
**Labels:** `rebrand`, `epic:logo`, `frontend`, `priority:p1`
**Related:** design-system Issue #76
**Acceptance:**
- Wenn Sidebar eingeklappt ist: nur das Icon (`mark`-Variante) sichtbar.
- Wenn ausgeklappt: Lockup oder Mark + Wordmark als Text.
- Transition zwischen beiden Zuständen ist flüssig (200ms).

### Issue — Integrate `<Logo variant="lockup">` in Login-Screen
**Labels:** `rebrand`, `epic:logo`, `frontend`, `priority:p0`
**Acceptance:**
- `LoginPage.tsx`: Logo-Lockup zentriert über dem Login-Formular.
- Höhe `48px`, zentriert, ausreichend Vertical-Margin (min. `32px` unten).
- Tagline-Text unter dem Logo entfernt, wenn dieser Text bereits im Lockup-SVG enthalten ist (Doppelung vermeiden).

### Issue — Loading/Splash-Screen mit pulsierendem Logo-Mark
**Labels:** `rebrand`, `epic:logo`, `frontend`, `priority:p2`
**Acceptance:**
- Beim initialen App-Start und auf `ProtectedRoute` Loading-State wird `<Logo variant="mark" height={120} className="animate-pulse" />` gezeigt.
- Splash-Screen nutzt Deep-Space-Background (`#0b0e14`).
- Maximale Sichtbarkeit 1s, dann Fade-Out.

### Issue — Storybook-Story für Logo-Component (3 Varianten + Sizing + Monochrom-Context)
**Labels:** `rebrand`, `epic:logo`, `frontend`, `storybook`, `priority:p2`
**Related:** design-system Issue #88 (Storybook-Setup)
**Acceptance:**
- `frontend/src/components/brand/Logo.stories.tsx` angelegt.
- Stories: `Lockup`, `Mark`, `Mono`, `MonoOnLightBackground`, `SizesRow` (16/24/32/48/64/120).
- Controls für `variant` und `height`.
- Docs-Tab erklärt Brand-Guardrails (SKY/NEX Zweifarbigkeit, keine Gradients auf "SKY").

---

## Epic 4 — External Communication & Deployment

**Ziel:** Alle externen Touchpoints (E-Mails, Reports, DNS, Deployment-Pipelines) auf SKYNEX umstellen.

### Issue — Update report templates (PDF/DOCX): Header, Footer, Wasserzeichen
**Labels:** `rebrand`, `epic:external`, `reporting`, `priority:p1`
**Acceptance:**
- Report-Generator verwendet `skynex-lockup.svg` im Header.
- Footer-Zeile: "SKYNEX — Mission Control for IT · {generatedAt} · ISO 27001 Audit Trail".
- Bestehende PDF/DOCX-Templates (falls vorhanden) aktualisiert und per Snapshot-Test verifiziert.

### Issue — Update E-Mail-Templates (Notifications, Invites, Password-Reset)
**Labels:** `rebrand`, `epic:external`, `email`, `priority:p1`
**Acceptance:**
- Alle Transactional-E-Mail-Templates (`backend/src/email/templates/*`) auf SKYNEX-Branding.
- Absender-Name auf "SKYNEX" umgestellt.
- Footer-Links auf neue Domain (falls DNS schon umgestellt, sonst Platzhalter).
- Visueller Review von einem Stakeholder abgenommen.

### Issue — DNS + TLS-Zertifikat: neue Subdomain `skynex.*` vorbereiten
**Labels:** `rebrand`, `epic:external`, `devops`, `priority:p2`
**Acceptance:**
- Entscheidung dokumentiert: neue Domain vs. Subdomain vs. Umleitung.
- DNS-Record angelegt (A/CNAME).
- TLS-Zertifikat über Let's Encrypt ausgestellt.
- Alte Domain leitet per `301` auf neue Domain um (wenn gewünscht — sonst beide parallel).
- Nginx-Config entsprechend angepasst.

### Issue — CI/CD Pipelines, Deployment-Scripts, Monitoring-Alerts
**Labels:** `rebrand`, `epic:external`, `devops`, `priority:p2`
**Acceptance:**
- GitHub Actions Workflow-Dateien aktualisiert (nur Titel/Comments, falls vorhanden).
- Deployment-Scripts (`scripts/*`) Service-Namen aktualisiert.
- Monitoring-Alerts (Grafana/Prometheus) Beschreibungen auf SKYNEX umgestellt — falls verwendet.

### Issue — Final audit: `grep -ri bossview` und User-Walkthrough
**Labels:** `rebrand`, `epic:external`, `qa`, `priority:p0`
**Acceptance:**
- `grep -ri bossview` liefert nur noch bewusst stehengelassene Treffer (Changelog, History, Legacy-Archiv).
- Liste aller verbleibenden Treffer im Issue dokumentiert mit Begründung.
- Manueller UI-Walkthrough durch alle Screens — Screenshots angehängt.
- Abnahme durch Christian.

---

## Label-Setup

Vor dem Erstellen der Issues sollten diese Labels vorhanden sein (falls noch nicht durch Design-System-Milestone angelegt):

| Label | Farbe | Beschreibung |
|---|---|---|
| `rebrand` | `#ffd16f` | SKYNEX Rebrand Milestone |
| `epic:naming` | `#c084fc` | Epic: Repo & Naming |
| `epic:code` | `#60a5fa` | Epic: Codebase Rename |
| `epic:logo` | `#99f7ff` | Epic: Logo Integration |
| `epic:external` | `#f472b6` | Epic: External Communication |
| `frontend` | `#4ade80` | Frontend-Arbeit |
| `backend` | `#fb923c` | Backend-Arbeit |
| `devops` | `#94a3b8` | Deployment / Infra |
| `database` | `#a78bfa` | Datenbank-Arbeit |
| `reporting` | `#e879f9` | Report-Generator |
| `email` | `#22d3ee` | E-Mail-Templates |
| `qa` | `#facc15` | Quality Assurance |
| `tech-debt` | `#64748b` | Technische Schuld |
| `storybook` | `#ff716c` | Storybook |
| `docs` | `#94a3b8` | Dokumentation |
| `test` | `#86efac` | Tests |
| `priority:p0` | `#ef4444` | P0 — blockierend |
| `priority:p1` | `#f59e0b` | P1 — wichtig |
| `priority:p2` | `#3b82f6` | P2 — nice to have |

---

## Execution

Die Bootstrap-Automatisierung liegt unter `docs/branding/create-rebrand-milestone.sh`.

```bash
export GH_TOKEN=ghp_xxx   # PAT mit `repo` scope, NIE committen
bash docs/branding/create-rebrand-milestone.sh
```

Alternativ kann das Script gegen die GitHub-REST-API mit `curl` oder `gh` laufen. Beide Varianten sind im Script enthalten (Primär: `gh`; Fallback: `curl`).

**Reihenfolge beim Abarbeiten der Milestone:**

1. Epic 1 (Naming) zuerst — legt das Fundament.
2. Epic 2 (Code-Rename) parallel in kleinen PRs, idealerweise atomar pro Service.
3. Epic 3 (Logo-Integration) kann **bereits jetzt** starten und parallel laufen, weil Frontend-Code schon existiert.
4. Epic 4 (External) ganz am Ende, wenn die internen Umbauten stabil sind.

**Kein Big-Bang.** Jedes Issue wird als eigener PR gemergt, damit das Audit-Trail pro Datenbank-, Config- oder User-facing-Change nachvollziehbar bleibt (ISO 27001 Annex A.12.1.2 — Change Management).
