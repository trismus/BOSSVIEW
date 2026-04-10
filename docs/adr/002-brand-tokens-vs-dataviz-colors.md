# ADR 002: Brand Tokens vs. Data Visualization Colors

**Status:** Accepted
**Date:** 2026-04-10
**Author:** Kim (UI/UX)
**Related Issues:** #91, #75, #77

## Context

Bei der Integration des SKYNEX Design-Systems (Issue #75) kam die Frage auf, wie die ~126 hartkodierten Hex-Farben in den Infrastructure/Topology-Komponenten mit dem Brand-Token-System zusammenhängen.

Die Analyse ergab:
- Das SKYNEX Design-System definiert ~15 Brand-Tokens für UI-Chrome (Backgrounds, Borders, Text, Status-Farben)
- Die 126 Hex-Werte in den Infra-Komponenten sind **kategoriale Data-Visualization-Farben** für:
  - VLAN-Unterscheidung (perzeptuell distinkte Kategorien)
  - Device-Typ-Farbcodes (Server, Switch, Firewall, etc.)
  - Link-Status (up/down/degraded)
  - Port-Status (access/trunk/routed/down)
  - Drop-Target-Feedback (valid/invalid)

Diese Farben sind **funktional anders** als Brand-Tokens:
- Brand-Tokens sind ableitbar aus einer Designentscheidung (Primärfarbe → daraus abgeleitete Schattierungen)
- Data-Viz-Farben müssen **perzeptuell distinct** sein (VLAN 10 vs. VLAN 20 müssen auf einen Blick unterscheidbar sein)
- Data-Viz-Farben sind nicht aus einer Brand-Palette ableitbar

## Decision

**Wir trennen Brand-Tokens und Data-Visualization-Farben in separate Systeme:**

### 1. Brand-Tokens → SKYNEX Design System (`tokens.css`)
- UI-Chrome: Backgrounds, Borders, Shadows
- Text-Farben: Primary, Secondary, Muted
- Semantische Status: Success, Warning, Error, Info
- Interaktive Elemente: Focus-Rings, Hover-States

### 2. Data-Viz-Farben → Zentrale Palette (`frontend/src/styles/data-viz-colors.ts`)
- **Explizit ausgenommen** vom Brand-Token-System
- Zentral gepflegt, typisiert, importierbar
- Kategorisiert nach Verwendungszweck:
  - `UI_CHROME` — Dark-Theme Hintergründe/Borders für Infra-Views
  - `STATUS_COLORS` — Semantische Status (operational/warning/critical)
  - `PORT_STATUS_COLORS` — Port-Zustände im PortGrid
  - `LINK_STATUS_COLORS` — WAN-Link-Status
  - `DROP_TARGET_COLORS` — Drag-and-Drop-Feedback
  - `VLAN_STATE_COLORS` — VLAN-Overlay-Visualisierung

### 3. Lint-Rule-Exemption (Issue #77)
Die ESLint-Regel „no-hardcoded-hex" bekommt ein File-Pattern-Override:
- `frontend/src/styles/data-viz-colors.ts` — erlaubt (Single Source of Truth)
- `frontend/src/styles/tokens.css` — erlaubt (SKYNEX-Tokens)
- Alle anderen `.tsx`/`.ts`-Dateien — **müssen** aus diesen Dateien importieren

## Consequences

### Positive
- **Single Source of Truth**: Alle Data-Viz-Farben an einem Ort
- **Typisierung**: TypeScript-Types für alle Paletten → keine Tippfehler
- **Wiederverwendbarkeit**: Neue Komponenten importieren einfach die passende Palette
- **Lint-Enforcement**: Neue Hex-Literale werden vom Linter gefangen
- **Klare Trennung**: Brand-Team kann Tokens ändern ohne Data-Viz zu brechen

### Negative
- **Zwei Systeme**: Entwickler müssen wissen, welches System für welchen Anwendungsfall gilt
- **Migration**: Bestehende Komponenten mussten refactored werden (8 Dateien, 126 Vorkommen)

### Neutral
- **Accessibility-Audit**: Die Data-Viz-Paletten müssen separat auf WCAG-Konformität geprüft werden (Issue #87). Das ist unabhängig von dieser ADR.

## Files Affected

Refactored (importieren jetzt aus `data-viz-colors.ts`):
- `frontend/src/components/infra/DeviceConfigPanel.tsx`
- `frontend/src/components/infra/NetworkTopologyView.tsx`
- `frontend/src/components/infra/PortGrid.tsx`
- `frontend/src/components/infra/RackView.tsx`
- `frontend/src/components/infra/VlanConsistencyPanel.tsx`
- `frontend/src/components/infra/WorldMapView.tsx`
- `frontend/src/pages/InfrastructurePage.tsx`
- `frontend/src/pages/NamingConventionPage.tsx`

New:
- `frontend/src/styles/data-viz-colors.ts`
- `docs/adr/002-brand-tokens-vs-dataviz-colors.md` (this file)

## References

- SKYNEX Design System: `docs/branding/design-system-rollout-milestone.md`
- Issue #75: SKYNEX Tokens integrieren
- Issue #77: Lint-Rules mit Design-System-Enforcement
- Issue #91: Data-Viz Color Strategy (this work)
