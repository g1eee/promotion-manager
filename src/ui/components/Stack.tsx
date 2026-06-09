import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { spacing } from "../tokens/tokens";
import type { SpacingToken } from "../tokens/tokens";
import { cx } from "../utils/cx";

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  /** Layout direction. Defaults to "vertical". */
  direction?: "vertical" | "horizontal";
  /** Gap between children, using a spacing token. Defaults to "md". */
  gap?: SpacingToken;
  /** Cross-axis alignment (CSS align-items). */
  align?: CSSProperties["alignItems"];
  /** Main-axis distribution (CSS justify-content). */
  justify?: CSSProperties["justifyContent"];
  /** Allow children to wrap onto multiple lines. */
  wrap?: boolean;
  children: ReactNode;
}

/**
 * Flexbox layout primitive for arranging children in a row or column with a
 * consistent, token-based gap.
 */
export function Stack({
  direction = "vertical",
  gap = "md",
  align,
  justify,
  wrap = false,
  className,
  style,
  children,
  ...rest
}: StackProps) {
  const stackStyle: CSSProperties = {
    gap: spacing[gap],
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap ? "wrap" : undefined,
    ...style,
  };

  return (
    <div
      className={cx("pms-stack", `pms-stack--${direction}`, className)}
      style={stackStyle}
      {...rest}
    >
      {children}
    </div>
  );
}
