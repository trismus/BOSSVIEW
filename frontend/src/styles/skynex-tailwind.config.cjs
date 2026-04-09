/**
 * SKYNEX — Tailwind Theme Extension
 * Aesthetic: Tactical Command / Mission Control
 * Version: 1.0.0
 *
 * ⚠ Synced from docs/branding/tokens/tailwind.config.js — do NOT edit
 * directly. If you need to change tokens, update the source file in
 * docs/branding/tokens/ and then copy the result here.
 *
 * Intentionally a .cjs file because the frontend package.json sets
 * "type": "module" (ESM). The .cjs extension forces CJS interpretation
 * so `module.exports` works. The .cjs copy lives inside frontend/ so
 * the Docker dev container (which only mounts frontend/) can resolve
 * the path — the original file under docs/ is outside the container.
 *
 *   // tailwind.config.js
 *   const skynexTheme = require('./src/styles/skynex-tailwind.config.cjs');
 *
 *   module.exports = {
 *     content: ['./src/**\/*.{js,jsx,ts,tsx}'],
 *     theme: {
 *       extend: skynexTheme.theme.extend,
 *     },
 *     plugins: [],
 *   };
 *
 * Usage examples in JSX:
 *   <div className="bg-surface text-on-surface font-body">
 *   <button className="bg-gradient-primary text-on-primary rounded-md shadow-glow-primary">
 *   <span className="font-mono text-body-sm text-on-surface-variant">192.168.1.1</span>
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Surface hierarchy — Nesting Depth Principle
        surface: {
          DEFAULT: "#0b0e14",
          "container-lowest": "#000000",
          "container-low": "#10131a",
          container: "#161a21",
          "container-high": "#1c2028",
        },
        // Primary / neon accent
        primary: {
          DEFAULT: "#99f7ff",
          container: "#00f1fe",
        },
        "on-primary": "#001f22",
        // Status
        error: "#ff716c",
        warning: "#ffd16f",
        success: "#7cffa8",
        info: "#99f7ff",
        // Text on surface
        "on-surface": {
          DEFAULT: "#e4e6eb",
          variant: "#9ca3af",
          dim: "#6b7280",
        },
        // Outline
        "outline-variant": "#45484f",
      },

      fontFamily: {
        display: ['"Space Grotesk"', "sans-serif"],
        body: ['"Inter"', "-apple-system", '"Helvetica Neue"', "sans-serif"],
        mono: ['"JetBrains Mono"', '"SF Mono"', "Consolas", "monospace"],
      },

      fontSize: {
        "display-lg": ["57px", { lineHeight: "64px", fontWeight: "700" }],
        "display-md": ["45px", { lineHeight: "52px", fontWeight: "700" }],
        "display-sm": ["36px", { lineHeight: "44px", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "600" }],
        "headline-md": ["28px", { lineHeight: "36px", fontWeight: "600" }],
        "headline-sm": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "title-lg": ["22px", { lineHeight: "28px", fontWeight: "600" }],
        "title-md": ["16px", { lineHeight: "24px", fontWeight: "600" }],
        "title-sm": ["14px", { lineHeight: "20px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-sm": ["12px", { lineHeight: "16px", fontWeight: "400" }],
        "label-md": ["12px", { lineHeight: "16px", fontWeight: "500" }],
      },

      spacing: {
        // Tailwind defaults already cover 0–16 on the 4px grid.
        // Explicit aliases for clarity when referring to design tokens:
        "skx-1": "4px",
        "skx-2": "8px",
        "skx-3": "12px",
        "skx-4": "16px",
        "skx-5": "20px",
        "skx-6": "24px",
        "skx-8": "32px",
        "skx-10": "40px",
        "skx-12": "48px",
        "skx-16": "64px",
      },

      borderRadius: {
        // SKYNEX radius scale — never exceed xl (12px)
        "skx-none": "0",
        "skx-xs": "2px",
        "skx-sm": "2px",
        "skx-md": "6px",
        "skx-lg": "10px",
        "skx-xl": "12px",
      },

      boxShadow: {
        // Ambient elevation
        "elevation-sm": "0px 2px 8px rgba(0, 0, 0, 0.3)",
        "elevation-md": "0px 6px 16px rgba(0, 0, 0, 0.35)",
        "elevation-lg": "0px 12px 32px rgba(0, 0, 0, 0.4)",
        "elevation-xl": "0px 24px 48px rgba(0, 0, 0, 0.45)",
        // Neon status glow
        "glow-primary": "0 0 16px rgba(0, 241, 254, 0.4)",
        "glow-primary-strong": "0 0 24px rgba(0, 241, 254, 0.6)",
        "glow-error": "0 0 12px rgba(255, 113, 108, 0.3)",
        "glow-warning": "0 0 12px rgba(255, 209, 111, 0.3)",
        "glow-success": "0 0 12px rgba(124, 255, 168, 0.3)",
      },

      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #99f7ff 0%, #00f1fe 100%)",
      },

      backdropBlur: {
        glass: "20px",
      },

      // Ghost border as a custom border color using outline-variant @ 15% opacity
      borderColor: {
        ghost: "rgba(69, 72, 79, 0.15)",
        "ghost-strong": "rgba(69, 72, 79, 0.3)",
        "primary-ghost": "rgba(153, 247, 255, 0.3)",
      },

      // Tabular numbers for data density
      fontVariantNumeric: {
        tabular: "tabular-nums",
      },
    },
  },
};
