import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";

export type CardPadding = "sm" | "md" | "lg" | "none";

export interface CardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Inner padding. Defaults to "md". Use "none" for full-bleed content (e.g. tables). */
  padding?: CardPadding;
  /** Optional card title rendered in a header row. */
  title?: ReactNode;
  /** Optional subtitle rendered under the title. */
  subtitle?: ReactNode;
  /** Optional content rendered on the right of the header (e.g. actions). */
  headerActions?: ReactNode;
  children: ReactNode;
}

/**
 * Surface container for grouping related content. Provides an optional header
 * (title, subtitle, actions) and a token-based padding scale.
 */
export function Card({
  padding = "md",
  title,
  subtitle,
  headerActions,
  className,
  children,
  ...rest
}: CardProps) {
  const hasHeader = title != null || subtitle != null || headerActions != null;

  return (
    <div
      className={cx(
        "pms-card",
        padding !== "none" && `pms-card--pad-${padding}`,
        className,
      )}
      {...rest}
    >
      {hasHeader && (
        <div
          className="pms-card__header"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--pms-space-md)",
          }}
        >
          <div>
            {title != null && <div className="pms-card__title">{title}</div>}
            {subtitle != null && (
              <div className="pms-card__subtitle">{subtitle}</div>
            )}
          </div>
          {headerActions != null && <div>{headerActions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
