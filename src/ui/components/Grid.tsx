import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { spacing } from "../tokens/tokens";
import type { SpacingToken } from "../tokens/tokens";
import { cx } from "../utils/cx";

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Number of equal-width columns, or an explicit `grid-template-columns`
   * value. Defaults to 12.
   */
  columns?: number | string;
  /** Gap between grid cells, using a spacing token. Defaults to "lg". */
  gap?: SpacingToken;
  /** Cross-axis alignment (CSS align-items). */
  align?: CSSProperties["alignItems"];
  children: ReactNode;
}

/**
 * CSS Grid layout primitive for dense, multi-column desktop layouts.
 */
export function Grid({
  columns = 12,
  gap = "lg",
  align,
  className,
  style,
  children,
  ...rest
}: GridProps) {
  const templateColumns =
    typeof columns === "number" ? `repeat(${columns}, minmax(0, 1fr))` : columns;

  const gridStyle: CSSProperties = {
    gridTemplateColumns: templateColumns,
    gap: spacing[gap],
    alignItems: align,
    ...style,
  };

  return (
    <div className={cx("pms-grid", className)} style={gridStyle} {...rest}>
      {children}
    </div>
  );
}
