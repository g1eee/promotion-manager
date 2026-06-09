/**
 * Design tokens for the Promotion Management System (PMS) design system.
 *
 * These tokens are the single source of truth for spacing, color, typography,
 * radius, shadow, and z-index values used across every module. They are mirrored
 * as CSS custom properties in `app/globals.css` (see `--pms-*` variables) so that
 * components can be styled via CSS classes while values stay consistent with this
 * TypeScript object for programmatic use.
 *
 * Design principles (see design.md "UX & Screen Design"):
 * - Desktop-first: compact spacing scale tuned for dense tables and multi-column layouts.
 * - Information dense but readable: restrained palette, clear status colors, legible type.
 */

export const colors = {
  // Brand / primary action
  primary: "#1d4ed8",
  primaryHover: "#1e40af",
  primaryActive: "#1e3a8a",
  primarySubtle: "#eff6ff",

  // Neutrals (surfaces, borders, text)
  bg: "#f8fafc",
  surface: "#ffffff",
  surfaceAlt: "#f1f5f9",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",

  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  textInverse: "#ffffff",

  // Semantic / status
  success: "#15803d",
  successSubtle: "#dcfce7",
  warning: "#b45309",
  warningSubtle: "#fef3c7",
  danger: "#b91c1c",
  dangerSubtle: "#fee2e2",
  info: "#0369a1",
  infoSubtle: "#e0f2fe",
  neutral: "#475569",
  neutralSubtle: "#f1f5f9",

  focusRing: "#3b82f6",
  overlay: "rgba(15, 23, 42, 0.45)",
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
    'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontFamilyMono:
    'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',

  fontSize: {
    xs: "11px",
    sm: "12px",
    md: "13px",
    lg: "15px",
    xl: "18px",
    xxl: "22px",
    xxxl: "28px",
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
  sm: "4px",
  md: "6px",
  lg: "8px",
  pill: "999px",
} as const;

export const shadow = {
  sm: "0 1px 2px rgba(15, 23, 42, 0.08)",
  md: "0 2px 8px rgba(15, 23, 42, 0.12)",
  lg: "0 8px 24px rgba(15, 23, 42, 0.18)",
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
