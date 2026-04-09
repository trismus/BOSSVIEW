#!/usr/bin/env bash
# ============================================================================
# SKYNEX Design System v1.0 — GitHub Milestone + Issues Bootstrap
# ============================================================================
# Creates the "Design System v1.0 — Tactical Command Rollout" milestone
# and all 16 issues in the trismus/BOSSVIEW repository.
#
# Prerequisites:
#   - gh CLI installed (https://cli.github.com/)
#   - Authenticated: gh auth login
#   - Run from any directory — REPO is pinned below
#
# Usage:
#   chmod +x docs/branding/create-github-milestone.sh
#   ./docs/branding/create-github-milestone.sh
#
# Idempotency:
#   - Script checks for existing milestone and labels before creating.
#   - Issues are NOT deduplicated — re-running will create duplicate issues.
#     Only run once per repository.
# ============================================================================

set -euo pipefail

REPO="trismus/BOSSVIEW"
MILESTONE_TITLE="Design System v1.0 — Tactical Command Rollout"
MILESTONE_DESC="Konsistente Umsetzung des SKYNEX Design-Systems v1.0 über die gesamte Web-App. Mission-Control-Ästhetik in allen Views, alle UI-Komponenten im Design-System verankert, keine Legacy-Styles. Siehe docs/branding/design-system-rollout-milestone.md für Details."

# Milestone due date — 8 weeks from today
if date -d "+8 weeks" +%Y-%m-%dT%H:%M:%SZ >/dev/null 2>&1; then
  DUE_DATE=$(date -u -d "+8 weeks" +%Y-%m-%dT%H:%M:%SZ)  # GNU
else
  DUE_DATE=$(date -u -v+8w +%Y-%m-%dT%H:%M:%SZ)          # BSD / macOS
fi

# ----------------------------------------------------------------------------
# Pre-flight checks
# ----------------------------------------------------------------------------
command -v gh >/dev/null 2>&1 || { echo "Error: gh CLI is not installed. See https://cli.github.com/"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Error: gh is not authenticated. Run 'gh auth login' first."; exit 1; }

echo "==> Target repository: $REPO"
echo "==> Milestone:         $MILESTONE_TITLE"
echo "==> Due date:          $DUE_DATE"
echo ""

# ----------------------------------------------------------------------------
# 1) Create labels (idempotent — ignore errors if already exists)
# ----------------------------------------------------------------------------
echo "==> Ensuring labels exist..."
create_label() {
  local name="$1" color="$2" desc="$3"
  gh label create "$name" --color "$color" --description "$desc" --repo "$REPO" 2>/dev/null \
    || gh label edit "$name" --color "$color" --description "$desc" --repo "$REPO" >/dev/null 2>&1 \
    || true
}

create_label "design-system"  "99f7ff" "SKYNEX Design System v1.0"
create_label "frontend"       "10131a" "Frontend / React"
create_label "ui"              "161a21" "UI component work"
create_label "components"     "1c2028" "Reusable UI component"
create_label "foundation"     "0b0e14" "Foundation / scaffolding"
create_label "data-viz"       "00f1fe" "Data visualization"
create_label "accessibility"  "ffd16f" "A11y / WCAG compliance"
create_label "compliance"     "ff716c" "ISO 27001 / regulatory"
create_label "tooling"        "45484f" "Dev tooling / CI"
create_label "docs"            "7cffa8" "Documentation"
create_label "review"         "e4e6eb" "Review / QA"
create_label "size/S"         "c2e0c6" "Small (1-2 days)"
create_label "size/M"         "fef2c0" "Medium (3-5 days)"
create_label "size/L"         "f9d0c4" "Large (>1 week)"

# ----------------------------------------------------------------------------
# 2) Create milestone (via GitHub REST API, as gh CLI has no milestone command)
# ----------------------------------------------------------------------------
echo "==> Creating milestone..."
EXISTING_NUMBER=$(gh api "repos/$REPO/milestones?state=open" \
  --jq ".[] | select(.title == \"$MILESTONE_TITLE\") | .number" | head -n1 || true)

if [[ -n "$EXISTING_NUMBER" ]]; then
  echo "    Milestone already exists: #$EXISTING_NUMBER"
  MILESTONE_NUMBER="$EXISTING_NUMBER"
else
  MILESTONE_NUMBER=$(gh api "repos/$REPO/milestones" \
    --method POST \
    --field title="$MILESTONE_TITLE" \
    --field state="open" \
    --field description="$MILESTONE_DESC" \
    --field due_on="$DUE_DATE" \
    --jq '.number')
  echo "    Created milestone #$MILESTONE_NUMBER"
fi

# ----------------------------------------------------------------------------
# 3) Issue factory
# ----------------------------------------------------------------------------
create_issue() {
  local title="$1"
  local labels="$2"
  local body="$3"

  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --body "$body" \
    --label "$labels" \
    --milestone "$MILESTONE_TITLE" >/dev/null
  echo "    + $title"
}

echo ""
echo "==> Creating issues..."

# ----------------------------------------------------------------------------
# EPIC 1 — FOUNDATION
# ----------------------------------------------------------------------------
create_issue "feat(frontend): Vite + React + TypeScript Skeleton initialisieren" \
  "design-system,frontend,foundation,size/S" \
  "## Context

Der \`frontend/\`-Ordner existiert laut CLAUDE.md noch nicht. Bevor wir Design-Tokens integrieren können, brauchen wir das Grundgerüst.

## Acceptance Criteria

- [ ] Vite + React 18 + TypeScript-Template in \`frontend/\` aufgesetzt
- [ ] Node 20 als \`.nvmrc\` / \`engines\`-Feld fixiert
- [ ] \`npm run dev\` startet die App auf Port 5173
- [ ] \`npm run build\` erzeugt ein produktionsfähiges Build ohne Warnings
- [ ] ESLint + Prettier vorkonfiguriert, \`npm run lint\` läuft sauber
- [ ] \`frontend/Dockerfile.dev\` für Integration in \`docker-compose.dev.yml\`
- [ ] README im \`frontend/\`-Ordner beschreibt lokales Setup

## References

- \`docs/branding/design-system-rollout-milestone.md\`"

create_issue "feat(frontend): SKYNEX Design-Tokens integrieren (tokens.css, Tailwind, Fonts)" \
  "design-system,frontend,foundation,size/M" \
  "## Context

Die Design-Tokens liegen fertig unter \`docs/branding/tokens/\`. Sie müssen in das Frontend eingebunden werden, damit ab Issue #5 alle Komponenten konsistent gebaut werden können.

## Acceptance Criteria

- [ ] Tailwind CSS installiert und \`tailwind.config.js\` mit \`docs/branding/tokens/tailwind.config.js\` als Theme-Extension konfiguriert
- [ ] \`tokens.css\` im Root-Stylesheet importiert, CSS-Custom-Properties global verfügbar
- [ ] Google Fonts für Space Grotesk, Inter, JetBrains Mono eingebunden (self-hosted bevorzugt)
- [ ] Globales Body-Styling: \`background: var(--skx-surface)\`, \`color: var(--skx-on-surface)\`, \`font-family: var(--skx-font-body)\`
- [ ] Beispiel-Seite \`/design-check\` zeigt alle Farb-Tokens, Type-Scale und Base-Komponenten
- [ ] ESLint-Regel verbietet hartkodierte Hex-Farben ausserhalb von \`tokens.css\`

## References

- \`docs/branding/tokens/tokens.css\`
- \`docs/branding/tokens/tailwind.config.js\`
- \`docs/branding/skynex-design-system.md\`"

create_issue "feat(frontend): App-Shell mit Sidebar + Topbar + Content-Area" \
  "design-system,frontend,foundation,size/M" \
  "## Context

Die globale Layout-Struktur muss Tonal Partitioning nutzen: Sidebar = \`surface-container-low\`, Content = \`surface\`, Topbar = \`surface-container\`.

## Acceptance Criteria

- [ ] \`<AppShell>\`-Komponente mit drei Slots: sidebar, topbar, children
- [ ] Sidebar: 240px fix, \`bg-surface-container-low\`, keine sichtbare Border
- [ ] Topbar: 56px fix, \`bg-surface-container\`, keine sichtbare Border
- [ ] Content-Area: \`bg-surface\`, Scroll-Container mit \`padding: space-6\`
- [ ] Responsive: Sidebar kollabiert unter 1024px zu Overlay-Drawer
- [ ] Routing-Setup mit React Router v6, Placeholder-Routes für /dashboard, /assets, /incidents, /changes, /settings
- [ ] Shell rendert in <200ms (Lighthouse)"

create_issue "chore(frontend): Lint-Rules mit Design-System-Enforcement" \
  "design-system,frontend,foundation,tooling,size/S" \
  "## Context

Wir verlieren Konsistenz, wenn Entwickler hartkodierte Werte benutzen. Die Lint-Rules sollen das aktiv verhindern.

## Acceptance Criteria

- [ ] \`stylelint\` mit Plugin \`stylelint-declaration-strict-value\` verbietet hartkodierte Farben
- [ ] ESLint-Plugin \`eslint-plugin-tailwindcss\` erkennt ungültige Tailwind-Klassen
- [ ] Custom ESLint-Regel: Keine inline \`style={{ color: '#...' }}\`-Props
- [ ] CI Job \`npm run lint\` läuft in GitHub Actions und blockt PRs bei Verstössen
- [ ] Dokumentation in \`frontend/CONTRIBUTING.md\`"

# ----------------------------------------------------------------------------
# EPIC 2 — CORE COMPONENTS
# ----------------------------------------------------------------------------
create_issue "feat(ui): Button-System (Primary / Secondary / Tertiary)" \
  "design-system,frontend,ui,components,size/M" \
  "## Context

Spec siehe \`docs/branding/skynex-design-system.md\` §6, CSS-Vorlagen in \`tokens.css\` als \`.skx-btn-primary\` / \`.skx-btn-secondary\`.

## Acceptance Criteria

- [ ] \`<Button variant='primary|secondary|tertiary' size='sm|md|lg'>\` Komponente
- [ ] Primary: Gradient #99f7ff → #00f1fe, on-primary Text, Glow-Shadow
- [ ] Secondary: Ghost-Border + primary Text, Hover füllt Background
- [ ] Tertiary: Nur Text (monospaced), Underline on Hover
- [ ] States: Default, Hover, Focus, Disabled, Loading (mit Spinner)
- [ ] Icon-Slot (left/right) via leftIcon/rightIcon Prop
- [ ] Radius: radius-md (6px), nie grösser als radius-xl
- [ ] Storybook-Story mit allen Varianten und States
- [ ] Keyboard-Navigation (Enter/Space), ARIA-Role korrekt"

create_issue "feat(ui): Card & Data-Group mit Nesting Depth" \
  "design-system,frontend,ui,components,size/S" \
  "## Context

Cards bilden das Rückgrat des Dashboards. Sie müssen ohne Borders auskommen und Hierarchie via Tonal Partitioning aufbauen.

## Acceptance Criteria

- [ ] \`<Card>\`-Komponente, \`bg-surface-container\`, \`radius-md\`, \`padding: space-6\`
- [ ] Prop \`variant='default|recessed'\` — recessed nutzt surface-container-lowest
- [ ] Prop \`elevation='none|sm|md|lg'\` — none ist Default
- [ ] Slot für \`<CardHeader>\`, \`<CardBody>\`, \`<CardFooter>\`
- [ ] Verschachtelte Cards nutzen automatisch die nächsttiefere Surface-Ebene
- [ ] Keine 1px-Borders — Trennung ausschliesslich über Tonal Shift
- [ ] Storybook-Story mit 3 verschachtelten Cards"

create_issue "feat(ui): Status-Badge mit Glow-Effekt" \
  "design-system,frontend,ui,components,size/S" \
  "## Context

Status-Badges sind das Herz des Systems (siehe Design-Doc §6). Sie müssen wie physische Warnlichter wirken.

## Acceptance Criteria

- [ ] \`<StatusBadge status='critical|warning|success|info' size='sm|md'>\`
- [ ] 0.5px-Border in Statusfarbe @ 40% Opacity
- [ ] Background in Statusfarbe @ 12% Opacity
- [ ] Outer Glow (box-shadow) in Statusfarbe @ 30% Opacity
- [ ] Text in voller Statusfarbe, JetBrains Mono, Uppercase
- [ ] Radius radius-xs (2px)
- [ ] Optional: Pulsierende Animation für critical
- [ ] Storybook-Story mit allen vier Varianten
- [ ] Kontrast-Check WCAG AA"

create_issue "feat(ui): Input-Field-System (Text / Number / Select / Toggle)" \
  "design-system,frontend,ui,components,size/M" \
  "## Context

Inputs müssen recessed wirken — auf surface-container-lowest mit Ghost-Border und Focus-Glow.

## Acceptance Criteria

- [ ] \`<TextField>\`, \`<NumberField>\`, \`<SelectField>\`, \`<Toggle>\` Komponenten
- [ ] Background surface-container-lowest (#000000)
- [ ] Ghost-Border (outline-variant @ 15% Opacity) im Default-State
- [ ] Focus: 1px primary @ 50% Opacity + Inner Glow
- [ ] Error-State: Border + Glow in error-Color, Helper-Text unterhalb
- [ ] \`<Label>\` oberhalb, \`<HelperText>\` unterhalb mit konsistentem Spacing
- [ ] Number-Inputs nutzen JetBrains Mono
- [ ] Alle Komponenten keyboard-accessible, ARIA korrekt
- [ ] Storybook-Stories mit allen States"

create_issue "feat(ui): Modal / Popover mit Glassmorphism" \
  "design-system,frontend,ui,components,size/M" \
  "## Context

Floating-Elemente nutzen Glass-Effect (20px Backdrop-Blur, 60% Opacity). Spec siehe Design-Doc §2.

## Acceptance Criteria

- [ ] \`<Modal>\`-Komponente mit Backdrop, Trap-Focus, Escape-to-Close
- [ ] \`<Popover>\`-Komponente mit Positioning (floating-ui)
- [ ] Beide nutzen .skx-glass (backdrop-blur: 20px, bg @ 60% Opacity)
- [ ] Elevation elevation-lg für Modals, elevation-md für Popover
- [ ] Radius radius-md
- [ ] Entry/Exit-Animation (fade + slight scale), max 200ms
- [ ] ARIA: role='dialog', aria-modal='true', Labelled-By gesetzt
- [ ] Storybook-Stories mit verschiedenen Grössen"

create_issue "feat(ui): Toast / Alert Notification-System" \
  "design-system,frontend,ui,components,size/S" \
  "## Context

Toasts/Alerts nutzen dasselbe Glow-System wie Status-Badges.

## Acceptance Criteria

- [ ] \`<Toast>\`-Komponente und \`useToast()\`-Hook
- [ ] Varianten: critical, warning, success, info
- [ ] Position: Top-Right, stackable, max 5 gleichzeitig
- [ ] Auto-Dismiss nach 5s (ausser critical → manuelles Schliessen)
- [ ] Enter/Exit-Animation, Slide-from-Right
- [ ] Screen-Reader-Announcement via aria-live
- [ ] Storybook-Story mit allen Varianten"

# ----------------------------------------------------------------------------
# EPIC 3 — DATA VIZ & NAVIGATION
# ----------------------------------------------------------------------------
create_issue "feat(ui): KPI-Widget mit Micro-Sparkline" \
  "design-system,frontend,ui,components,data-viz,size/M" \
  "## Context

KPI-Widgets sind das zentrale Dashboard-Element. Spec siehe Design-Doc §6.

## Acceptance Criteria

- [ ] \`<KPIWidget label value delta trend status>\`
- [ ] Grosse Zahl in display-md (45px), JetBrains Mono, tabular-nums
- [ ] Micro-Sparkline hinter der Zahl, outline-variant gefärbt
- [ ] Delta-Indikator (↑/↓) farbcodiert: success für positiv, error für negativ
- [ ] Optional: Status-Dot-Indicator (pulsierender Kreis)
- [ ] Click-Target für Drill-Down-Navigation
- [ ] Storybook-Story mit 6 KPIs im Grid"

create_issue "feat(ui): Data-Table mit JetBrains Mono und Sorting" \
  "design-system,frontend,ui,components,data-viz,size/L" \
  "## Context

Das Herzstück des CMDB-Views. Muss hochdicht, schnell und perfekt typografisch ausgerichtet sein.

## Acceptance Criteria

- [ ] \`<DataTable columns rows>\` mit TypeScript-Generics
- [ ] Data-Cells in JetBrains Mono, tabular-nums
- [ ] Header-Cells in Inter Semibold, sortable mit Pfeil-Indikator
- [ ] Row-Hover: surface-container-high
- [ ] Row-Selection via Checkbox, Multi-Select mit Shift-Click
- [ ] Virtual-Scroll via react-window für >1000 Rows
- [ ] Column-Resize per Drag
- [ ] Empty-State und Loading-State (Skeleton)
- [ ] Keine sichtbaren Row-Borders — Zebra-Pattern mit 3% Opacity-Shift
- [ ] Storybook-Story mit 200 Test-Rows"

create_issue "feat(ui): Sidebar-Navigation mit Active-State-Glow" \
  "design-system,frontend,ui,components,size/M" \
  "## Context

Die Sidebar ist der primäre Navigations-Punkt. Active-State muss klar erkennbar sein, ohne Borders.

## Acceptance Criteria

- [ ] \`<Sidebar>\` mit \`<SidebarSection>\` und \`<SidebarItem>\`
- [ ] Active-Item: bg-surface-container-high + linker 2px-Strich in primary mit Glow
- [ ] Hover-Item: bg-surface-container
- [ ] Icons via lucide-react, 20px
- [ ] Labels in title-sm (Inter Semibold 14px)
- [ ] Collapsible-Sections mit Smooth-Expand-Animation
- [ ] Keyboard-Navigation (Arrow-Up/Down, Enter, Escape)
- [ ] Storybook-Story mit vollständigem BOSSVIEW-Navigationsbaum"

# ----------------------------------------------------------------------------
# EPIC 4 — QUALITY & COMPLIANCE
# ----------------------------------------------------------------------------
create_issue "test(ui): WCAG AA Accessibility-Audit" \
  "design-system,frontend,accessibility,compliance,size/M" \
  "## Context

ISO 27001 und Luftfahrt-Compliance verlangen Barrierefreiheit. WCAG AA ist das Minimum.

## Acceptance Criteria

- [ ] Automatisierter Axe-Core-Scan in CI für alle Storybook-Stories
- [ ] Manuelles Screen-Reader-Testing (NVDA/VoiceOver) für Haupt-Flows
- [ ] Alle Komponenten erfüllen 4.5:1 Kontrast für Text, 3:1 für UI
- [ ] Focus-States sichtbar auf allen interaktiven Elementen
- [ ] Keyboard-Only-Navigation funktioniert für alle Flows
- [ ] Audit-Report in \`docs/accessibility/audit-v1.md\`
- [ ] Gefundene Issues als separate Follow-Up-Tickets"

create_issue "docs(ui): Storybook-Setup mit allen Komponenten" \
  "design-system,frontend,docs,size/M" \
  "## Context

Ohne Storybook verlieren wir das Design-System nach wenigen Wochen. Es muss die Source-of-Truth für alle UI-Entscheidungen sein.

## Acceptance Criteria

- [ ] Storybook 8+ installiert und in \`frontend/.storybook/\` konfiguriert
- [ ] Alle Komponenten aus Epic 2 + 3 haben Stories
- [ ] Design-Tokens-Panel zeigt Farben, Typo, Spacing
- [ ] Controls-Panel für Props aktiviert
- [ ] Deployed als statische Seite (GitHub Pages oder Vercel)
- [ ] Link zur Storybook-Instanz im README.md
- [ ] Visual-Regression-Testing via @storybook/test-runner oder Chromatic (optional)"

create_issue "chore(ui): Design-QA Review aller Views" \
  "design-system,frontend,review,size/M" \
  "## Context

Nach Abschluss aller Komponenten: End-to-End-Review jeder Seite gegen das Design-System-Dokument.

## Acceptance Criteria

- [ ] Review-Checkliste aus docs/branding/skynex-design-system.md §7 erstellt
- [ ] Jede Seite (Dashboard, Assets, Incidents, Changes, Settings, Login) gegen Checkliste geprüft
- [ ] Screenshots aller Views in \`docs/branding/screenshots/\`
- [ ] Abweichungen werden gefixt oder als Follow-Up-Tickets angelegt
- [ ] Sign-Off durch Design-System-Owner
- [ ] Milestone-Closure-Report in \`docs/branding/v1-rollout-report.md\`"

# ----------------------------------------------------------------------------
# Done
# ----------------------------------------------------------------------------
echo ""
echo "==> Done!"
echo "==> Milestone URL: https://github.com/$REPO/milestone/$MILESTONE_NUMBER"
echo "==> Issues:        https://github.com/$REPO/issues?q=is%3Aissue+is%3Aopen+milestone%3A%22$MILESTONE_TITLE%22"
