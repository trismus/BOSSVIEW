/**
 * SKYNEX Data Visualization Color Palette
 *
 * This file is the SINGLE SOURCE OF TRUTH for all hex color values used
 * in data visualization components (Infrastructure, Topology, Rack views).
 *
 * These colors are INTENTIONALLY separate from the SKYNEX Design System tokens.
 * See docs/adr/002-brand-tokens-vs-dataviz-colors.md for the reasoning.
 *
 * ESLint: This file is exempt from the no-hardcoded-hex rule.
 */

// ═══════════════════════════════════════════════════════════════════════════
// UI CHROME — Dark Trace Theme
// Background, border, and text colors for the infrastructure UI shell.
// These provide the "mission control" aesthetic for NOC environments.
// ═══════════════════════════════════════════════════════════════════════════

export const UI_CHROME = {
  // Backgrounds (darkest to lighter)
  bg: '#0a0e17',           // Main background — near black
  bgCard: '#0f1420',       // Card/panel background
  bgPanel: '#111827',      // Alternate panel background (slate-900)
  bgHover: '#151c2c',      // Hover state background
  bgOverlay: '#0f172a',    // Overlay/tooltip background (slate-900)

  // Borders
  border: '#1e293b',       // Default border (slate-800)
  borderActive: '#0ea5e9', // Active/focused border (sky-500)

  // Text
  text: '#e2e8f0',         // Primary text (slate-200)
  textDim: '#94a3b8',      // Secondary text (slate-400)
  textMuted: '#64748b',    // Muted/disabled text (slate-500)

  // Grid overlay
  grid: 'rgba(6, 182, 212, 0.04)', // Subtle cyan grid lines
} as const

// ═══════════════════════════════════════════════════════════════════════════
// SEMANTIC STATUS COLORS
// Consistent status indicators across all data visualizations.
// ═══════════════════════════════════════════════════════════════════════════

export const STATUS_COLORS = {
  // Core status
  cyan: '#06b6d4',         // Primary accent / active (cyan-500)
  cyanDim: '#0e7490',      // Dimmed cyan (cyan-700)
  green: '#10b981',        // Online / healthy / success (emerald-500)
  amber: '#f59e0b',        // Warning / maintenance (amber-500)
  red: '#ef4444',          // Critical / error / offline (red-500)
  blue: '#3b82f6',         // Info / maintenance mode (blue-500)
  purple: '#8b5cf6',       // Special / VLAN overlay (violet-500)
  purpleGlow: '#a78bfa',   // Purple with glow effect (violet-400)
} as const

// ═══════════════════════════════════════════════════════════════════════════
// PORT STATUS COLORS
// Used in PortGrid.tsx for switch port visualization.
// Each color maps to a specific port operational state.
// ═══════════════════════════════════════════════════════════════════════════

export const PORT_STATUS_COLORS = {
  upAccess: '#10b981',     // Port up, access mode (green)
  upTrunk: '#06b6d4',      // Port up, trunk mode (cyan)
  adminDown: '#334155',    // Administratively disabled (slate-700)
  down: '#ef4444',         // Port down / error (red)
  noConfig: '#64748b',     // No configuration / unknown (muted)
  routed: '#8b5cf6',       // Layer 3 routed port (purple)
} as const

// ═══════════════════════════════════════════════════════════════════════════
// LINK STATUS COLORS
// Used in NetworkTopologyView.tsx for WAN link and connection visualization.
// ═══════════════════════════════════════════════════════════════════════════

export const LINK_STATUS_COLORS = {
  up: '#0891b2',           // Link operational (cyan-600)
  down: '#dc2626',         // Link down (red-600)
  degraded: '#f59e0b',     // Performance degraded (amber-500)
} as const

// ═══════════════════════════════════════════════════════════════════════════
// DRAG & DROP FEEDBACK
// Used in RackView.tsx for slot assignment drag-and-drop operations.
// ═══════════════════════════════════════════════════════════════════════════

export const DROP_TARGET_COLORS = {
  valid: '#064e3b',        // Valid drop target (emerald-950)
  invalid: '#7f1d1d',      // Invalid drop target (red-950)
} as const

// ═══════════════════════════════════════════════════════════════════════════
// VLAN STATE COLORS
// Used in VlanConsistencyPanel.tsx and NetworkTopologyView.tsx
// for VLAN overlay and consistency visualization.
// ═══════════════════════════════════════════════════════════════════════════

export const VLAN_STATE_COLORS = {
  active: '#10b981',       // VLAN active on port
  inactive: '#f59e0b',     // VLAN configured but inactive
  overlay: '#8b5cf6',      // VLAN overlay mode highlight
} as const

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSITE PALETTE OBJECTS
// Pre-composed objects matching the existing COLORS constants in each file.
// Import these to minimize refactoring in consuming components.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full COLORS palette for components that need everything.
 * Used by: NetworkTopologyView, WorldMapView, InfrastructurePage
 */
export const INFRA_COLORS = {
  ...UI_CHROME,
  ...STATUS_COLORS,
} as const

/**
 * Minimal palette for simpler components.
 * Used by: PortGrid, VlanConsistencyPanel
 */
export const INFRA_COLORS_MINIMAL = {
  bg: UI_CHROME.bg,
  bgCard: UI_CHROME.bgCard,
  border: UI_CHROME.border,
  cyan: STATUS_COLORS.cyan,
  text: UI_CHROME.text,
  textDim: UI_CHROME.textDim,
  textMuted: UI_CHROME.textMuted,
} as const

// ═══════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type UIChrome = typeof UI_CHROME
export type StatusColors = typeof STATUS_COLORS
export type PortStatusColors = typeof PORT_STATUS_COLORS
export type LinkStatusColors = typeof LINK_STATUS_COLORS
export type DropTargetColors = typeof DROP_TARGET_COLORS
export type VlanStateColors = typeof VLAN_STATE_COLORS
export type InfraColors = typeof INFRA_COLORS
