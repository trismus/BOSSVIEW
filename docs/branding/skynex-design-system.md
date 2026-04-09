# SKYNEX — Design System

**Version:** 1.0
**Status:** Draft
**Aesthetic Direction:** Tactical Command / Mission Control

---

## 1. Overview & Creative North Star

### Creative North Star: "The Tactical Command"

This design system is engineered for the high-stakes environment of cybersecurity and infrastructure monitoring. It rejects the "friendly SaaS" aesthetic in favor of a **Mission Control** experience — authoritative, data-dense, and unapologetically technical.

The system moves beyond standard dashboard templates by utilizing a **Tactical Layering** approach. Rather than dividing space with crude lines, we define the environment through light, depth, and atmospheric perspective. By using intentional asymmetry in data visualization and overlapping UI elements, we create a sense of a living, breathing digital nervous system.

---

## 2. Colors & Surface Philosophy

The palette is rooted in a "Deep Space" foundation, using high-vibrancy neon accents to draw the eye to critical telemetry data.

### Surface Hierarchy & Nesting

To achieve a premium, custom feel, we strictly adhere to the **Nesting Depth Principle**. Hierarchy is established by shifting background tones rather than drawing boxes.

| Token | Hex | Purpose |
|---|---|---|
| `surface` | `#0b0e14` | The infinite base — "Atmosphere" |
| `surface-container-lowest` | `#000000` | Recessed data input areas |
| `surface-container-low` | `#10131a` | Secondary sections, sidebars |
| `surface-container` | `#161a21` | Primary container for data groups |
| `surface-container-high` | `#1c2028` | Hover / active selection |

### Primary / Accent

| Token | Hex | Purpose |
|---|---|---|
| `primary` | `#99f7ff` | High-contrast neon accent, KPIs |
| `primary-container` | `#00f1fe` | Gradient end-stop, CTA glow |
| `on-primary` | `#001f22` | Text on primary |

### Status Colors

| Token | Hex | Purpose |
|---|---|---|
| `error` | `#ff716c` | Critical alerts, outages |
| `warning` | `#ffd16f` | Degraded, needs attention |
| `success` | `#7cffa8` | Healthy, green state |
| `info` | `#99f7ff` | Neutral info (same as primary) |

### Text & Outlines

| Token | Hex | Purpose |
|---|---|---|
| `on-surface` | `#e4e6eb` | Primary text |
| `on-surface-variant` | `#9ca3af` | Secondary text |
| `on-surface-dim` | `#6b7280` | Tertiary / metadata |
| `outline-variant` | `#45484f` | Ghost borders (15% opacity) |

### The "No-Line" Rule

**1px solid borders are prohibited for sectioning.** To separate a list from a sidebar, use a shift from `surface-container-low` to `surface-container`. This "Tonal Partitioning" creates a sophisticated, seamless interface that feels like high-end hardware.

### The Glass & Gradient Rule

Floating modals, tooltips, and high-level alerts must utilize **Glassmorphism**. Apply `surface-container` with 60% opacity and a `20px` backdrop-blur.

**Signature Glows:** Primary CTAs should utilize a subtle linear gradient from `primary` (#99f7ff) to `primary-container` (#00f1fe). This adds "soul" and mimics the luminescence of a physical monitor.

---

## 3. Typography

The typographic strategy balances human readability with machine-like precision.

### Font Stacks

| Role | Font | Purpose |
|---|---|---|
| Display & Headline | **Space Grotesk** | The "Command" font. Geometric, slightly wider stance. Use for KPIs and Page Titles. |
| Body & Titles | **Inter** | The "Information" font. Extreme legibility at small sizes during high-stress monitoring events. |
| Data & Technical Labels | **JetBrains Mono** | For IP addresses, timestamps, log entries. Monospaced columns aid rapid pattern recognition. |

### Type Scale

| Token | Size | Line Height | Weight | Font |
|---|---|---|---|---|
| `display-lg` | 57px | 64px | 700 | Space Grotesk |
| `display-md` | 45px | 52px | 700 | Space Grotesk |
| `display-sm` | 36px | 44px | 700 | Space Grotesk |
| `headline-lg` | 32px | 40px | 600 | Space Grotesk |
| `headline-md` | 28px | 36px | 600 | Space Grotesk |
| `headline-sm` | 24px | 32px | 600 | Space Grotesk |
| `title-lg` | 22px | 28px | 600 | Inter |
| `title-md` | 16px | 24px | 600 | Inter |
| `title-sm` | 14px | 20px | 600 | Inter |
| `body-lg` | 16px | 24px | 400 | Inter |
| `body-md` | 14px | 20px | 400 | Inter |
| `body-sm` | 12px | 16px | 400 | Inter |
| `label-md` | 12px | 16px | 500 | Inter |
| `data-lg` | 18px | 24px | 500 | JetBrains Mono |
| `data-md` | 14px | 20px | 500 | JetBrains Mono |
| `data-sm` | 12px | 16px | 500 | JetBrains Mono |

---

## 4. Elevation & Depth

In a "Mission Control" aesthetic, depth isn't just decoration; it's priority.

### Tonal Layering

Place a `surface-container-lowest` (#000000) card on a `surface-container-low` background to create a "recessed" look, perfect for data input areas.

### Ambient Shadows

For floating elements, use extra-diffused shadows.

| Token | Value |
|---|---|
| `elevation-sm` | `0px 2px 8px rgba(0, 0, 0, 0.3)` |
| `elevation-md` | `0px 6px 16px rgba(0, 0, 0, 0.35)` |
| `elevation-lg` | `0px 12px 32px rgba(0, 0, 0, 0.4)` |
| `elevation-xl` | `0px 24px 48px rgba(0, 0, 0, 0.45)` |

The shadow color must never be neutral grey; it should be a darkened tint of the background to maintain atmospheric depth.

### The Ghost Border Fallback

When high-density data requires a container, use the `outline-variant` (#45484f) at **15% opacity**. This creates a "suggestion" of a boundary that is visible but does not clutter the visual field.

---

## 5. Spacing & Radii

### Spacing Scale (base 4px)

| Token | Value |
|---|---|
| `space-0` | 0 |
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |

### Corner Radii

| Token | Value | Usage |
|---|---|---|
| `radius-none` | 0 | Full-bleed panels |
| `radius-xs` | 2px | Inline badges |
| `radius-sm` | 2px (0.125rem) | Cards, tight containers |
| `radius-md` | 6px (0.375rem) | Cards, buttons |
| `radius-lg` | 10px (0.625rem) | Modals |
| `radius-xl` | 12px (0.75rem) | Maximum — never exceed |

Corners larger than `xl` are **prohibited**. The system should feel sharp and precise, not "bubbly."

---

## 6. Components

### Cards & Data Groups

- **Style:** No borders. Use `surface-container` with `radius-sm` or `radius-md`.
- **Padding:** `space-6` (24px) default.
- **Nesting:** Child cards step down to `surface-container-lowest` to create recessed look.

### Status Badges

Status badges are the heart of the system. They must include a subtle outer glow (box-shadow) using the status color at 30% opacity to simulate a warning light.

```css
.badge-critical {
  background: rgba(255, 113, 108, 0.15);
  color: #ff716c;
  border: 0.5px solid rgba(255, 113, 108, 0.4);
  box-shadow: 0 0 12px rgba(255, 113, 108, 0.3);
}
```

### Buttons

- **Primary:** Gradient of `primary` (#99f7ff) to `primary-container` (#00f1fe). Text uses `on-primary` (#001f22).
- **Secondary:** Ghost style. `outline-variant` border, `primary` text. No fill until hover.
- **Tertiary:** No border, no fill. Monospaced text with underline on hover.

### Input Fields

- **Style:** Recessed appearance. `surface-container-lowest` (#000000) for the field background.
- **Focus State:** 1px ghost border using `primary` at 50% opacity and a subtle inner glow.

### Infrastructure KPIs

- Large `display-md` monospaced numbers (JetBrains Mono).
- A "Micro-Trend" sparkline sits directly behind the number in a muted `outline-variant` color to provide context without adding noise.

---

## 7. Do's and Don'ts

### Do

- **DO** use JetBrains Mono for any string containing a number (IPs, dates, IDs).
- **DO** use vertical whitespace and background shifts instead of horizontal rules.
- **DO** apply a subtle `0.5px` border to status badges to ensure they "pop" against dark backgrounds.
- **DO** lean into high-density layouts — the user is a professional who needs all the data at once.

### Don't

- **DON'T** use 100% opaque, high-contrast borders. It breaks the "Tactical Command" immersion.
- **DON'T** use standard blue/red/green shades. Use the specific neon tokens (`#00f2ff`, `#ff716c`, `#ffd16f`).
- **DON'T** use rounded corners larger than `xl` (0.75rem). The system should feel sharp and precise.
- **DON'T** use drop shadows on elements that are meant to be part of the dashboard "glass." Only use shadows for elements that physically float over the UI (modals, popovers).

---

## 8. Implementation Files

| File | Purpose |
|---|---|
| `design-tokens.json` | Machine-readable tokens (W3C Design Tokens format) |
| `tokens.css` | CSS custom properties for direct use |
| `tailwind.config.js` | Tailwind theme extension snippet |
| `skynex-logo-concept.svg` | Primary brand mark in all variants |

---

*This document is versioned. Update the version header with every material change and log the rationale in git commit messages.*
