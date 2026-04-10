# SKYNEX Design System — QA Checklist

**Version:** 1.0
**Reference:** `docs/branding/skynex-design-system.md` §7

Use this checklist to verify that each page/view adheres to the SKYNEX Design System.

---

## General Checks

### Surface Hierarchy

- [ ] Background uses `surface` (#0b0e14) as base
- [ ] Sidebar uses `surface-container-low` (#10131a)
- [ ] Cards/panels use `surface-container` (#161a21)
- [ ] Hover states use `surface-container-high` (#1c2028)
- [ ] Input fields use `surface-container-lowest` (#000000)

### No-Line Rule

- [ ] No 1px solid borders for sectioning content
- [ ] Hierarchy achieved via tonal shifts only
- [ ] Ghost borders (if any) use `outline-variant` @ 15% opacity

### Glass Effect

- [ ] Modals/popovers have 20px backdrop-blur
- [ ] Floating elements use 60% opacity background

---

## Typography

### Font Usage

- [ ] Page titles use Space Grotesk
- [ ] Body text uses Inter
- [ ] IP addresses, timestamps, IDs use JetBrains Mono
- [ ] Data tables use JetBrains Mono for values

### Scale Adherence

- [ ] Display text ≥ 36px uses display-* tokens
- [ ] Headlines use headline-* tokens (24-32px)
- [ ] Body text uses body-md (14px)
- [ ] Labels use label-md (12px, uppercase)

### Weights

- [ ] Max 2 font weights per view (regular + semibold)

---

## Colors

### Primary Accent

- [ ] CTAs use primary gradient (#99f7ff → #00f1fe)
- [ ] Active states use primary color
- [ ] No custom blue/cyan colors (use tokens only)

### Status Colors

- [ ] Critical/Error: #ff716c
- [ ] Warning: #ffd16f
- [ ] Success: #7cffa8
- [ ] Info: #99f7ff (same as primary)

### Text Colors

- [ ] Primary text: on-surface (#e4e6eb)
- [ ] Secondary text: on-surface-variant (#9ca3af)
- [ ] Disabled/muted: on-surface-dim (#6b7280)

---

## Components

### Buttons

- [ ] Primary: Gradient with glow shadow
- [ ] Secondary: Ghost border, primary text
- [ ] Tertiary: Text-only, monospaced, underline hover
- [ ] Disabled state at 50% opacity

### Cards

- [ ] No borders — tonal background only
- [ ] Radius: radius-md (6px)
- [ ] Padding: space-6 (24px)
- [ ] Nested cards step down surface level

### Status Badges

- [ ] Background @ 12% opacity
- [ ] Border @ 40% opacity (0.5px)
- [ ] Outer glow @ 30% opacity
- [ ] JetBrains Mono, uppercase

### Input Fields

- [ ] Recessed appearance (lowest surface)
- [ ] Ghost border in default state
- [ ] Focus: primary border + inner glow
- [ ] Error: error border + error glow

### Tables

- [ ] JetBrains Mono for data cells
- [ ] Inter Semibold for headers
- [ ] No row borders — zebra pattern (3% shift)
- [ ] Hover: surface-container-high

---

## Spacing

- [ ] Consistent use of 4px grid (space-1 through space-16)
- [ ] Card padding: 24px (space-6)
- [ ] Section gaps: 32px (space-8) or 48px (space-12)
- [ ] Tight element gaps: 8px (space-2) or 12px (space-3)

---

## Border Radius

- [ ] Buttons: radius-md (6px)
- [ ] Cards: radius-md (6px)
- [ ] Badges: radius-xs (2px)
- [ ] Modals: radius-lg (10px)
- [ ] **No radius larger than radius-xl (12px)**

---

## Shadows

- [ ] Cards: No shadow (none) or elevation-sm for floating
- [ ] Modals: elevation-lg
- [ ] Popovers: elevation-md
- [ ] Status badges: glow-* shadows

---

## Interactions

### Hover States

- [ ] Background shift to surface-container-high
- [ ] No jarring color changes
- [ ] Smooth transitions (150-200ms)

### Focus States

- [ ] Visible 2px outline in primary color
- [ ] Offset of 2px from element
- [ ] Never remove focus indicators

### Loading States

- [ ] Skeleton uses surface-container-high
- [ ] Pulse animation for skeletons
- [ ] Spinner for buttons

---

## Page-Specific Checks

### Dashboard

- [ ] KPI widgets use display-md for numbers
- [ ] Sparklines in outline-variant color
- [ ] Delta indicators color-coded (success/error)

### Assets (CMDB)

- [ ] DataTable with sticky header
- [ ] Sortable columns with arrow indicators
- [ ] Selection checkboxes aligned

### Incidents

- [ ] Priority badges with correct colors
- [ ] Timeline uses consistent spacing

### Login

- [ ] Centered card layout
- [ ] Logo uses primary color
- [ ] Input fields properly recessed

---

## Accessibility Quick Checks

- [ ] All interactive elements keyboard-focusable
- [ ] Color never sole indicator of meaning
- [ ] Text contrast ratio ≥ 4.5:1
- [ ] Form fields have labels
- [ ] Modals trap focus

---

## Sign-Off

| Page | Reviewer | Date | Status |
|------|----------|------|--------|
| Dashboard | — | — | ☐ |
| Assets | — | — | ☐ |
| Incidents | — | — | ☐ |
| Changes | — | — | ☐ |
| Settings | — | — | ☐ |
| Login | — | — | ☐ |

---

*Use this checklist for every design review. Update version number when checklist changes.*
