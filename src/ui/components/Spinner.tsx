import type { CSSProperties, HTMLAttributes } from "react";
import { cx } from "../utils/cx";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Size of the spinner. Defaults to "md". */
  size?: SpinnerSize;
  /**
   * Accessible label announced to assistive tech. Defaults to "Memuat".
   * Set `decorative` when the spinner sits next to its own visible label
   * (e.g. inside a button) to avoid duplicate announcements.
   */
  label?: string;
  /**
   * Treat the spinner as purely decorative (`aria-hidden`). Use when an
   * adjacent visible label already conveys the loading state (e.g. a button
   * showing "Menyimpan…").
   */
  decorative?: boolean;
}

/**
 * Indeterminate spinner for in-progress actions (button submits, inline
 * fetches). Inherits the current text color so it adapts to any surface or
 * button variant. Honors `prefers-reduced-motion`.
 */
export function Spinner({
  size = "md",
  label = "Memuat",
  decorative = false,
  className,
  ...rest
}: SpinnerProps) {
  const a11yProps = decorative
    ? ({ "aria-hidden": "true" } as const)
    : ({ role: "status", "aria-live": "polite", "aria-label": label } as const);

  return (
    <span
      className={cx("pms-spinner", `pms-spinner--${size}`, className)}
      {...a11yProps}
      {...rest}
    >
      <span className="pms-spinner__circle" aria-hidden="true" />
      {!decorative && <span className="pms-visually-hidden">{label}</span>}
    </span>
  );
}

export interface SpinnerOverlayProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Accessible loading label. Defaults to "Memuat". */
  label?: string;
  /** Optional visible caption rendered under the spinner. */
  caption?: string;
  /** Spinner size. Defaults to "lg". */
  size?: SpinnerSize;
  /** Stretch to fill (and center within) the nearest positioned ancestor. */
  fill?: boolean;
}

/**
 * Centered spinner with an optional caption for blocking a region (e.g. a card
 * or panel) while an action completes. Set `fill` to overlay a positioned
 * container.
 */
export function SpinnerOverlay({
  label = "Memuat",
  caption,
  size = "lg",
  fill = false,
  className,
  style,
  ...rest
}: SpinnerOverlayProps) {
  const resolvedStyle: CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, ...style }
    : style;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cx("pms-spinner-overlay", fill && "pms-spinner-overlay--fill", className)}
      style={resolvedStyle}
      {...rest}
    >
      <Spinner size={size} decorative />
      {caption != null && (
        <span className="pms-spinner-overlay__caption">{caption}</span>
      )}
      <span className="pms-visually-hidden">{label}</span>
    </div>
  );
}
