import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "secondary"
  | "feedback"
  | "execution";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Color tone of the badge. Defaults to "neutral". */
  tone?: BadgeTone;
  children: ReactNode;
}

/**
 * Small pill used to surface a state or category. `StatusBadge` builds on this
 * with domain status → tone mapping.
 */
export function Badge({ tone = "neutral", className, children, ...rest }: BadgeProps) {
  return (
    <span className={cx("pms-badge", `pms-badge--${tone}`, className)} {...rest}>
      {children}
    </span>
  );
}
