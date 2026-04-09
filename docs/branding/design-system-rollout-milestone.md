# Milestone: Design System v1.0 — "Tactical Command" Rollout

**Repository:** `trismus/BOSSVIEW`
**Milestone:** `Design System v1.0`
**Ziel:** Konsistente Umsetzung der SKYNEX Design-System v1.0 über die gesamte Web-App. Mission-Control-Ästhetik in allen Views, alle UI-Komponenten im Design-System verankert, keine Legacy-Styles.
**Empfohlene Laufzeit:** 6–8 Wochen
**Labels:** `design-system`, `frontend`, `ui`

---

## Milestone-Beschreibung

Dieser Milestone bündelt alle Arbeiten zur Umsetzung des SKYNEX Design-Systems v1.0 in der Web-App. Das Design-System ist unter `docs/branding/skynex-design-system.md` dokumentiert, die Tokens liegen unter `docs/branding/tokens/`.

**Definition of Done für den gesamten Milestone:**

- Alle Views nutzen ausschliesslich Tokens aus `tokens.css` / `tailwind.config.js` — keine hartkodierten Hex-Farben, keine Ad-hoc-Fonts.
- Alle Datenfelder (IPs, Timestamps, IDs, Counts) sind in JetBrains Mono gesetzt.
- Alle interaktiven Komponenten existieren in Storybook mit dokumentierten States (Default / Hover / Focus / Disabled / Loading).
- Accessibility-Audit nach WCAG AA bestanden (Kontrast ≥ 4.5:1 für Text, sichtbare Focus-States).
- Design-QA aller Views durch Design-System-Owner abgenommen.

---

## Epic 1 — Foundation (4 Issues)

### Issue #1 — feat(frontend): Vite + React + TypeScript Skeleton initialisieren

**Labels:** `design-system`, `frontend`, `foundation`, `size/S`

**Context:** Der `frontend/`-Ordner existiert laut CLAUDE.md noch nicht. Bevor wir Design-Tokens integrieren können, brauchen wir das Grundgerüst.

**Acceptance Criteria:**

- [ ] Vite + React 18 + TypeScript-Template in `frontend/` aufgesetzt
- [ ] Node 20 als `.nvmrc` / `engines`-Feld fixiert (Konsistenz mit Backend-Stack)
- [ ] `npm run dev` startet die App auf Port 5173
- [ ] `npm run build` erzeugt ein produktionsfähiges Build ohne Warnings
- [ ] ESLint + Prettier vorkonfiguriert, `npm run lint` läuft sauber
- [ ] `frontend/Dockerfile.dev` für Integration in `docker-compose.dev.yml`
- [ ] README im `frontend/`-Ordner beschreibt lokales Setup

---

### Issue #2 — feat(frontend): SKYNEX Design-Tokens integrieren (tokens.css, Tailwind, Fonts)

**Labels:** `design-system`, `frontend`, `foundation`, `size/M`

**Context:** Die Design-Tokens liegen fertig unter `docs/branding/tokens/`. Sie müssen in das Frontend eingebunden werden, damit ab Issue #5 alle Komponenten konsistent gebaut werden können.

**Acceptance Criteria:**

- [ ] Tailwind CSS installiert und `tailwind.config.js` mit `docs/branding/tokens/tailwind.config.js` als Theme-Extension konfiguriert
- [ ] `tokens.css` im Root-Stylesheet importiert, CSS-Custom-Properties global verfügbar
- [ ] Google Fonts für Space Grotesk, Inter und JetBrains Mono via `<link>` oder `@import` eingebunden (self-hosted bevorzugt für Datenschutz)
- [ ] Globales Body-Styling: `background: var(--skx-surface)`, `color: var(--skx-on-surface)`, `font-family: var(--skx-font-body)`
- [ ] Beispiel-Seite (`/design-check`) zeigt alle Farb-Tokens, Type-Scale und Base-Komponenten zur visuellen Verifikation
- [ ] ESLint-Regel verbietet hartkodierte Hex-Farben in `.tsx`/`.css` (Ausnahme: `tokens.css`)

---

### Issue #3 — feat(frontend): App-Shell mit Sidebar + Topbar + Content-Area

**Labels:** `design-system`, `frontend`, `foundation`, `size/M`

**Context:** Die globale Layout-Struktur muss Tonal Partitioning nutzen (Sidebar = `surface-container-low`, Content = `surface`, Topbar = `surface-container`).

**Acceptance Criteria:**

- [ ] `<AppShell>`-Komponente mit drei Slots: `sidebar`, `topbar`, `children`
- [ ] Sidebar: 240px fix, `bg-surface-container-low`, keine sichtbare Border
- [ ] Topbar: 56px fix, `bg-surface-container`, keine sichtbare Border
- [ ] Content-Area: `bg-surface`, Scroll-Container mit `padding: var(--skx-space-6)`
- [ ] Responsive: Sidebar kollabiert unter 1024px zu Overlay-Drawer
- [ ] Routing-Setup mit React Router v6, Placeholder-Routes für `/dashboard`, `/assets`, `/incidents`, `/changes`, `/settings`
- [ ] Shell rendert in `<200ms` (Lighthouse)

---

### Issue #4 — chore(frontend): Lint-Rules mit Design-System-Enforcement

**Labels:** `design-system`, `frontend`, `foundation`, `tooling`, `size/S`

**Context:** Wir verlieren Konsistenz, wenn Entwickler hartkodierte Werte benutzen. Die Lint-Rules sollen das aktiv verhindern.

**Acceptance Criteria:**

- [ ] `stylelint` mit Plugin `stylelint-declaration-strict-value` verbietet hartkodierte Farben ausserhalb von `tokens.css`
- [ ] ESLint-Plugin `eslint-plugin-tailwindcss` erkennt ungültige Tailwind-Klassen
- [ ] Custom ESLint-Regel: Keine inline-`style={{ color: '#...' }}`-Props
- [ ] CI Job `npm run lint` läuft in GitHub Actions und blockt PRs bei Verstössen
- [ ] Dokumentation in `frontend/CONTRIBUTING.md` erklärt die Regeln und wie man Ausnahmen beantragt

---

## Epic 2 — Core Components (6 Issues)

### Issue #5 — feat(ui): Button-System (Primary / Secondary / Tertiary)

**Labels:** `design-system`, `frontend`, `components`, `size/M`

**Context:** Spec siehe `docs/branding/skynex-design-system.md` §6, CSS-Vorlagen in `tokens.css` als `.skx-btn-primary` / `.skx-btn-secondary`.

**Acceptance Criteria:**

- [ ] `<Button variant="primary|secondary|tertiary" size="sm|md|lg">` Komponente
- [ ] Primary: Gradient `#99f7ff → #00f1fe`, `on-primary`-Text, Glow-Shadow
- [ ] Secondary: Ghost-Border + `primary`-Text, Hover füllt Background
- [ ] Tertiary: Nur Text (monospaced), Underline on Hover
- [ ] States: Default, Hover, Focus, Disabled, Loading (mit Spinner)
- [ ] Icon-Slot (left/right) via `<Button leftIcon={<Icon/>}>`
- [ ] Radius: `radius-md` (6px), nie grösser als `radius-xl`
- [ ] Storybook-Story mit allen Varianten und States
- [ ] Keyboard-Navigation (Enter/Space), ARIA-Role korrekt

---

### Issue #6 — feat(ui): Card & Data-Group mit Nesting Depth

**Labels:** `design-system`, `frontend`, `components`, `size/S`

**Context:** Cards bilden das Rückgrat des Dashboards. Sie müssen ohne Borders auskommen und Hierarchie via Tonal Partitioning aufbauen.

**Acceptance Criteria:**

- [ ] `<Card>`-Komponente, `bg-surface-container`, `radius-md`, `padding: space-6`
- [ ] Prop `variant="default|recessed"` — recessed nutzt `surface-container-lowest`
- [ ] Prop `elevation="none|sm|md|lg"` — none ist Default (kein Shadow)
- [ ] Slot für `<CardHeader>`, `<CardBody>`, `<CardFooter>` mit konsistentem Spacing
- [ ] Verschachtelte Cards nutzen automatisch die nächsttiefere Surface-Ebene
- [ ] Keine 1px-Borders — Trennung ausschliesslich über Tonal Shift
- [ ] Storybook-Story mit 3 verschachtelten Cards zur Validierung der Nesting Depth

---

### Issue #7 — feat(ui): Status-Badge mit Glow-Effekt

**Labels:** `design-system`, `frontend`, `components`, `size/S`

**Context:** Status-Badges sind das "Herz" des Systems (siehe Design-Doc §6). Sie müssen wie physische Warnlichter wirken.

**Acceptance Criteria:**

- [ ] `<StatusBadge status="critical|warning|success|info" size="sm|md">`
- [ ] 0.5px-Border in Statusfarbe @ 40% Opacity
- [ ] Background in Statusfarbe @ 12% Opacity
- [ ] Outer Glow (`box-shadow`) in Statusfarbe @ 30% Opacity
- [ ] Text in voller Statusfarbe, JetBrains Mono, Uppercase, Letter-Spacing 0.5px
- [ ] Radius `radius-xs` (2px)
- [ ] Optional: Pulsierende Animation für `critical` (CSS `@keyframes pulse`)
- [ ] Storybook-Story zeigt alle vier Status-Typen nebeneinander
- [ ] Kontrast-Check WCAG AA für jede Variante

---

### Issue #8 — feat(ui): Input-Field-System (Text / Number / Select / Toggle)

**Labels:** `design-system`, `frontend`, `components`, `size/M`

**Context:** Inputs müssen "recessed" wirken — auf `surface-container-lowest` mit Ghost-Border und Focus-Glow.

**Acceptance Criteria:**

- [ ] `<TextField>`, `<NumberField>`, `<SelectField>`, `<Toggle>` Komponenten
- [ ] Background `surface-container-lowest` (#000000)
- [ ] Ghost-Border (`outline-variant` @ 15% Opacity) im Default-State
- [ ] Focus: 1px `primary` @ 50% Opacity + Inner Glow
- [ ] Error-State: Border + Glow in `error`-Color, Helper-Text unterhalb
- [ ] `<Label>`-Komponente oberhalb, `<HelperText>` unterhalb mit konsistentem Spacing
- [ ] Number-Inputs nutzen JetBrains Mono
- [ ] Alle Komponenten keyboard-accessible, ARIA-Attribute korrekt
- [ ] Storybook-Stories mit Default / Focus / Error / Disabled / Filled States

---

### Issue #9 — feat(ui): Modal / Popover mit Glassmorphism

**Labels:** `design-system`, `frontend`, `components`, `size/M`

**Context:** Floating-Elemente nutzen Glass-Effect (20px Backdrop-Blur, 60% Opacity). Spec siehe Design-Doc §2.

**Acceptance Criteria:**

- [ ] `<Modal>`-Komponente mit Backdrop, Trap-Focus, Escape-to-Close
- [ ] `<Popover>`-Komponente mit Positioning (floating-ui oder ähnlich)
- [ ] Beide nutzen `.skx-glass` (backdrop-blur: 20px, bg @ 60% Opacity)
- [ ] Elevation `elevation-lg` für Modals, `elevation-md` für Popover
- [ ] Radius `radius-md`
- [ ] Entry/Exit-Animation (fade + slight scale), max 200ms Dauer
- [ ] ARIA: `role="dialog"`, `aria-modal="true"`, Labelled-By gesetzt
- [ ] Storybook-Stories mit verschiedenen Grössen (sm/md/lg)

---

### Issue #10 — feat(ui): Toast / Alert Notification-System

**Labels:** `design-system`, `frontend`, `components`, `size/S`

**Context:** Toasts/Alerts nutzen dasselbe Glow-System wie Status-Badges, um visuelle Konsistenz zu wahren.

**Acceptance Criteria:**

- [ ] `<Toast>`-Komponente und `useToast()`-Hook
- [ ] Varianten: `critical`, `warning`, `success`, `info` — gleiche Farben wie Status-Badges
- [ ] Position: Top-Right, stackable, max 5 gleichzeitig sichtbar
- [ ] Auto-Dismiss nach 5s (ausser `critical` → manuelles Schliessen)
- [ ] Enter/Exit-Animation, Slide-from-Right
- [ ] Screen-Reader-Announcement via `aria-live="polite"` (oder `assertive` für critical)
- [ ] Storybook-Story zeigt alle vier Varianten

---

## Epic 3 — Data Visualization & Navigation (3 Issues)

### Issue #11 — feat(ui): KPI-Widget mit Micro-Sparkline

**Labels:** `design-system`, `frontend`, `components`, `data-viz`, `size/M`

**Context:** KPI-Widgets sind das zentrale Dashboard-Element. Spec siehe Design-Doc §6.

**Acceptance Criteria:**

- [ ] `<KPIWidget label="..." value={123} delta="+12%" trend={[...]} status="healthy|warning|critical">`
- [ ] Grosse Zahl in `display-md` (45px), JetBrains Mono, tabular-nums
- [ ] Micro-Sparkline (Recharts oder Lightweight-SVG) hinter der Zahl, `outline-variant` gefärbt
- [ ] Delta-Indikator (↑/↓) farbcodiert: `success` für positiv, `error` für negativ
- [ ] Optional: Status-Dot-Indicator (kleiner pulsierender Kreis in Statusfarbe)
- [ ] Click-Target für Drill-Down-Navigation
- [ ] Storybook-Story mit 6 KPIs im Grid (typisches Dashboard-Layout)

---

### Issue #12 — feat(ui): Data-Table mit JetBrains Mono und Sorting

**Labels:** `design-system`, `frontend`, `components`, `data-viz`, `size/L`

**Context:** Das Herzstück des CMDB-Views. Muss hochdicht, schnell und perfekt typografisch ausgerichtet sein.

**Acceptance Criteria:**

- [ ] `<DataTable columns={...} rows={...}>` mit TypeScript-Generics
- [ ] Data-Cells in JetBrains Mono, `tabular-nums`, aligned via Monospace-Grid
- [ ] Header-Cells in Inter Semibold, sortable mit Pfeil-Indikator
- [ ] Row-Hover: `surface-container-high`
- [ ] Row-Selection via Checkbox, Multi-Select mit Shift-Click
- [ ] Pagination oder Virtual-Scroll (für >1000 Rows) via `react-window`
- [ ] Column-Resize per Drag
- [ ] Empty-State und Loading-State (Skeleton)
- [ ] Keine sichtbaren Row-Borders — Trennung via Zebra-Pattern mit 3% Opacity-Shift
- [ ] Storybook-Story mit realistischem Asset-Dataset (200 Rows)

---

### Issue #13 — feat(ui): Sidebar-Navigation mit Active-State-Glow

**Labels:** `design-system`, `frontend`, `components`, `size/M`

**Context:** Die Sidebar ist der primäre Navigations-Punkt. Active-State muss klar erkennbar sein, ohne Borders zu nutzen.

**Acceptance Criteria:**

- [ ] `<Sidebar>` mit `<SidebarSection>`- und `<SidebarItem>`-Komponenten
- [ ] Active-Item: `bg-surface-container-high` + linker 2px-Strich in `primary` mit Glow
- [ ] Hover-Item: `bg-surface-container`
- [ ] Icons via lucide-react, 20px Grösse
- [ ] Labels in `title-sm` (Inter Semibold 14px)
- [ ] Collapsible-Sections mit Smooth-Expand-Animation
- [ ] Keyboard-Navigation (Arrow-Up/Down, Enter, Escape)
- [ ] Storybook-Story mit vollständigem BOSSVIEW-Navigationsbaum

---

## Epic 4 — Quality & Compliance (3 Issues)

### Issue #14 — test(ui): WCAG AA Accessibility-Audit

**Labels:** `design-system`, `frontend`, `accessibility`, `compliance`, `size/M`

**Context:** ISO 27001 und Luftfahrt-Compliance verlangen Barrierefreiheit. WCAG AA ist das Minimum.

**Acceptance Criteria:**

- [ ] Automatisierter Axe-Core-Scan in CI für alle Storybook-Stories
- [ ] Manuelles Screen-Reader-Testing (NVDA/VoiceOver) für Haupt-Flows
- [ ] Alle Komponenten erfüllen 4.5:1 Kontrast für Text, 3:1 für UI-Komponenten
- [ ] Focus-States sichtbar auf allen interaktiven Elementen
- [ ] Keyboard-Only-Navigation funktioniert für alle Flows
- [ ] Audit-Report als Markdown in `docs/accessibility/audit-v1.md` dokumentiert
- [ ] Gefundene Issues werden als separate Follow-Up-Tickets angelegt

---

### Issue #15 — docs(ui): Storybook-Setup mit allen Komponenten

**Labels:** `design-system`, `frontend`, `docs`, `size/M`

**Context:** Ohne Storybook verlieren wir das Design-System nach wenigen Wochen. Es muss die Source-of-Truth für alle UI-Entscheidungen sein.

**Acceptance Criteria:**

- [ ] Storybook 8+ installiert und in `frontend/.storybook/` konfiguriert
- [ ] Alle Komponenten aus Epic 2 + 3 haben Stories
- [ ] Design-Tokens-Panel (via `@storybook/addon-themes`) zeigt Farben, Typo, Spacing
- [ ] Controls-Panel für Props aktiviert
- [ ] Deployed als statische Seite (GitHub Pages oder Vercel)
- [ ] Link zur Storybook-Instanz im `README.md`
- [ ] Visual-Regression-Testing via `@storybook/test-runner` oder Chromatic (optional aber empfohlen)

---

### Issue #16 — chore(ui): Design-QA Review aller Views

**Labels:** `design-system`, `frontend`, `review`, `size/M`

**Context:** Nach Abschluss aller Komponenten: End-to-End-Review jeder Seite gegen das Design-System-Dokument.

**Acceptance Criteria:**

- [ ] Review-Checkliste aus `docs/branding/skynex-design-system.md` §7 (Do's & Don'ts) erstellt
- [ ] Jede Seite (Dashboard, Assets, Incidents, Changes, Settings, Login) wird gegen Checkliste geprüft
- [ ] Screenshots aller Views im Tactical-Command-Look als Referenz in `docs/branding/screenshots/`
- [ ] Gefundene Abweichungen werden gefixt oder als Follow-Up-Tickets angelegt
- [ ] Sign-Off durch Design-System-Owner (Christian)
- [ ] Milestone-Closure-Report in `docs/branding/v1-rollout-report.md`

---

## Empfohlene Reihenfolge

1. **Woche 1–2:** Epic 1 (Issues #1–#4) — Foundation muss stehen, bevor Komponenten gebaut werden
2. **Woche 3–5:** Epic 2 (Issues #5–#10) — Core Components parallelisierbar
3. **Woche 5–7:** Epic 3 (Issues #11–#13) — baut auf Core Components auf
4. **Woche 7–8:** Epic 4 (Issues #14–#16) — Quality-Gate und Abnahme

## Ausführung

Nutze das Script `docs/branding/create-github-milestone.sh`, um Milestone und alle Issues automatisch via `gh` CLI auf GitHub anzulegen. Voraussetzung: `gh` ist installiert und authentifiziert (`gh auth login`).
