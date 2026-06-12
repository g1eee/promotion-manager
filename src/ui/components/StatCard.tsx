import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";

export type StatCardTone = "default" | "info" | "success" | "warning" | "danger";

export interface StatCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Uppercase eyebrow label, e.g. "PENDING REVIEW". */
  label: string;
  /** Headline metric, rendered in the display font. */
  value: string | number;
  /** Optional small sub line under the value. */
  caption?: ReactNode;
  /** Optional icon (Lucide), shown as a chip in the top-right. */
  icon?: ReactNode;
  /** Tints the icon chip and, when `accent` is set, the whole card. Defaults to "default". */
  tone?: StatCardTone;
  /** When true, applies the tinted-card look (colored background + border). */
  accent?: boolean;
}

/**
 * Compact KPI / metric card: an uppercase label, an icon chip in the top-right,
 * a large headline value, and an optional caption. Mirrors the dashboard stat
 * tiles in the product's visual language and reuses the shared design tokens.
 */
export function StatCard({
  label,
  value,
  caption,
  icon,
  tone = "default",
  accent = false,
  className,
  ...rest
}: StatCardProps) {
  return (
    <div
      className={cx(
        "pms-stat-card",
        tone !== "default" && `pms-stat-card--${tone}`,
        accent && "pms-stat-card--accent",
        className,
      )}
      {...rest}
    >
      <span className="pms-stat-card__label">{label}</span>
      {icon != null && (
        <span className="pms-stat-card__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <strong className="pms-stat-card__value">{value}</strong>
      {caption != null && (
        <span className="pms-stat-card__caption">{caption}</span>
      )}
    </div>
  );
}
