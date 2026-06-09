import type { CSSProperties, HTMLAttributes } from "react";
import { cx } from "../utils/cx";

export type SkeletonShape = "text" | "rect" | "circle";

/** Coerce a number to a px string; pass through string CSS values as-is. */
function toCssSize(value: string | number | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

export interface SkeletonProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Shape of the placeholder. Defaults to "text" (a single line). */
  shape?: SkeletonShape;
  /** Width (number → px, or any CSS width). Defaults to 100%. */
  width?: string | number;
  /** Height (number → px, or any CSS height). Defaults per shape. */
  height?: string | number;
  /** Border radius (number → px, or any CSS radius). Overrides the shape default. */
  radius?: string | number;
}

/**
 * Base shimmering placeholder block used to indicate that content is loading.
 * Decorative by default (`aria-hidden`); composite skeletons (table/card) own
 * the accessible "loading" announcement. Honors `prefers-reduced-motion`.
 */
export function Skeleton({
  shape = "text",
  width,
  height,
  radius,
  className,
  style,
  ...rest
}: SkeletonProps) {
  const resolvedStyle: CSSProperties = {
    width: toCssSize(width),
    height: toCssSize(height),
    borderRadius: toCssSize(radius),
    ...style,
  };

  return (
    <span
      aria-hidden="true"
      className={cx("pms-skeleton", `pms-skeleton--${shape}`, className)}
      style={resolvedStyle}
      {...rest}
    />
  );
}

export interface SkeletonTextProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Number of lines to render. Defaults to 3. */
  lines?: number;
  /** Width of the last line (shortened to look natural). Defaults to "60%". */
  lastLineWidth?: string | number;
  /** Accessible loading label. Defaults to "Memuat konten". */
  label?: string;
}

/**
 * A stack of text-line skeletons. Useful for paragraph/description loading
 * placeholders. The last line is shortened to mimic natural text flow.
 */
export function SkeletonText({
  lines = 3,
  lastLineWidth = "60%",
  label = "Memuat konten",
  className,
  ...rest
}: SkeletonTextProps) {
  const count = Math.max(1, Math.floor(lines));

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cx("pms-skeleton-text", className)}
      {...rest}
    >
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          shape="text"
          width={index === count - 1 && count > 1 ? lastLineWidth : "100%"}
        />
      ))}
      <span className="pms-visually-hidden">{label}</span>
    </div>
  );
}

export interface SkeletonTableProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Number of body rows to render. Defaults to 5. */
  rows?: number;
  /** Number of columns to render. Defaults to 4. */
  columns?: number;
  /** Render a header placeholder row. Defaults to true. */
  header?: boolean;
  /** Accessible loading label. Defaults to "Memuat data tabel". */
  label?: string;
}

/**
 * Table-shaped skeleton mirroring the dense `Table` component layout (optional
 * header row + body rows of cells). Use while a listing is loading.
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  header = true,
  label = "Memuat data tabel",
  className,
  ...rest
}: SkeletonTableProps) {
  const rowCount = Math.max(1, Math.floor(rows));
  const colCount = Math.max(1, Math.floor(columns));

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cx("pms-skeleton-table", className)}
      {...rest}
    >
      {header && (
        <div className="pms-skeleton-table__row pms-skeleton-table__row--header">
          {Array.from({ length: colCount }, (_, col) => (
            <div key={col} className="pms-skeleton-table__cell">
              <Skeleton shape="text" width="70%" />
            </div>
          ))}
        </div>
      )}
      {Array.from({ length: rowCount }, (_, row) => (
        <div key={row} className="pms-skeleton-table__row">
          {Array.from({ length: colCount }, (_, col) => (
            <div key={col} className="pms-skeleton-table__cell">
              <Skeleton shape="text" width={col === 0 ? "80%" : "55%"} />
            </div>
          ))}
        </div>
      ))}
      <span className="pms-visually-hidden">{label}</span>
    </div>
  );
}

export interface SkeletonCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Show a circular media/avatar placeholder in the header. Defaults to false. */
  media?: boolean;
  /** Number of body text lines. Defaults to 3. */
  lines?: number;
  /** Accessible loading label. Defaults to "Memuat kartu". */
  label?: string;
}

/**
 * Card-shaped skeleton (title + optional media + body lines) matching the
 * `Card` surface. Use for dashboard widgets and card-based listings.
 */
export function SkeletonCard({
  media = false,
  lines = 3,
  label = "Memuat kartu",
  className,
  ...rest
}: SkeletonCardProps) {
  const lineCount = Math.max(1, Math.floor(lines));

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cx("pms-skeleton-card", className)}
      {...rest}
    >
      <div className="pms-skeleton-card__header">
        {media && <Skeleton shape="circle" width={40} height={40} />}
        <div className="pms-skeleton-card__heading">
          <Skeleton shape="text" width="55%" height={16} />
          <Skeleton shape="text" width="35%" />
        </div>
      </div>
      <div className="pms-skeleton-card__body">
        {Array.from({ length: lineCount }, (_, index) => (
          <Skeleton
            key={index}
            shape="text"
            width={index === lineCount - 1 && lineCount > 1 ? "70%" : "100%"}
          />
        ))}
      </div>
      <span className="pms-visually-hidden">{label}</span>
    </div>
  );
}
