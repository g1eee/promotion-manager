/**
 * Design tokens for the Promotion Management System (PMS) design system.
 *
 * These tokens are the single source of truth for spacing, color, typography,
 * radius, shadow, and z-index values used across every module. They mirror the
 * CSS custom properties in `app/globals.css` (see `--pms-*` variables) so that
 * TypeScript code can reference values programmatically while CSS uses the
 * custom properties directly.
 *
 * Design principles (see design.md "UX & Screen Design"):
 * - Dark Command Center palette (Linear/Vercel-inspired).
 * - Desktop-first: compact spacing scale tuned for dense tables and
 *   multi-column layouts.
 * - Information dense but readable: restrained palette, clear status colors,
 *   legible type.
 *
 * IMPORTANT: Keep this file in sync with `app/globals.css` :root variables.
 * When updating one, update the other.
 */

export const colors = {
  // Brand / primary action — indigo
  primary: "#6366f1",
  primaryHover: "#818cf8",
  primaryActive: "#4f46e5",
  primarySubtle: "#1e213a",

  // Secondary — blue
  secondary: "#3b82f6",
  secondaryHover: "#60a5fa",
  secondarySubtle: "#15233f",

  // Neutrals (surfaces, borders, text)
  bg: "#0b0f14",
  surface: "#111827",
  surfaceAlt: "#161e2e",
  border: "#1f2937",
  borderStrong: "#2c3a4f",

  textPrimary: "#e5e7eb",
  textSecondary: "#9ca3af",
  textMuted: "#7d8594",
  textInverse: "#0b0f14",

  // Semantic / status
  success: "#22c55e",
  successSubtle: "#0f2a1a",
  warning: "#f59e0b",
  warningSubtle: "#2c2410",
  danger: "#ef4444",
  dangerSubtle: "#2c1518",
  info: "#3b82f6",
  infoSubtle: "#15233f",
  feedback: "#8b5cf6",
  feedbackSubtle: "#211a3a",
  execution: "#3b82f6",
  executionSubtle: "#15233f",
  neutral: "#9ca3af",
  neutralSubtle: "#1b2433",

  focusRing: "#6366f1",
  overlay: "rgba(3, 6, 12, 0.72)",
} as const;

export const spacing = {
  none: "0",
  xxs: "2px",
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
  xxxl: "48px",
} as const;

export const typography = {
  fontFamily:
    'var(--pms-font-inter), system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontFamilyDisplay:
    'var(--pms-font-space-grotesk), var(--pms-font-inter), system-ui, sans-serif',
  fontFamilyMono:
    'var(--pms-font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',

  fontSize: {
    xs: "11px",
    sm: "12px",
    md: "13px",
    lg: "15px",
    xl: "18px",
    xxl: "24px",
    xxxl: "30px",
  },

  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.65,
  },
} as const;

export const radius = {
  none: "0",
  sm: "8px",
  md: "10px",
  lg: "12px",
  pill: "999px",
} as const;

export const shadow = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.4)",
  md: "0 2px 8px rgba(0, 0, 0, 0.45)",
  lg: "0 12px 32px rgba(0, 0, 0, 0.55)",
} as const;

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1300,
  toast: 1400,
} as const;

export const tokens = {
  colors,
  spacing,
  typography,
  radius,
  shadow,
  zIndex,
} as const;

export type Tokens = typeof tokens;
export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
