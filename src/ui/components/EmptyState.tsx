import { useMemo, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../utils/cx";
import { Button } from "./Button";
import { Megaphone, Package, Search, Tag } from "lucide-react";

/**
 * Preset empty-state scenarios shared across modules. Each variant carries a
 * contextual title, description, and default call-to-action label that guides
 * the user toward the next action.
 *
 * - `no-campaigns`    — Campaigns / Campaign History listing is empty.
 * - `no-promos`       — Promo Scenarios / Promo History listing is empty.
 * - `no-products`     — Product Master listing is empty.
 * - `no-search-results` — A search or filter produced no matches.
 */
export type EmptyStateVariant =
  | "no-campaigns"
  | "no-promos"
  | "no-products"
  | "no-search-results";

interface EmptyStatePreset {
  title: string;
  description: string;
  actionLabel: string;
}

/**
 * Contextual copy for each preset variant. Exported so modules and tests can
 * reuse the canonical messaging instead of re-inventing it per page.
 */
export const emptyStatePresets: Record<EmptyStateVariant, EmptyStatePreset> = {
  "no-campaigns": {
    title: "Belum ada campaign",
    description: "Mulai dengan membuat campaign pertama untuk Brand ini.",
    actionLabel: "Buat Campaign",
  },
  "no-promos": {
    title: "Belum ada promo",
    description:
      "Buat promo scenario pertama untuk mulai merencanakan promo Brand ini.",
    actionLabel: "Buat Promo",
  },
  "no-products": {
    title: "Belum ada produk",
    description:
      "Tambahkan produk ke Product Master untuk Brand ini, atau impor dari Excel/CSV.",
    actionLabel: "Tambah Produk",
  },
  "no-search-results": {
    title: "Tidak ada hasil",
    description:
      "Tidak ada data yang cocok dengan pencarian atau filter saat ini. Coba ubah kata kunci atau reset filter.",
    actionLabel: "Reset Filter",
  },
};

export interface EmptyStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  /**
   * Preset scenario that supplies default title, description, and CTA label.
   * Omit it to build a fully custom empty state via `title`/`description`.
   */
  variant?: EmptyStateVariant;
  /** Overrides the preset title (or provides one when no variant is set). */
  title?: ReactNode;
  /** Overrides the preset description. Pass `null` to hide it entirely. */
  description?: ReactNode;
  /** Optional illustration or icon rendered above the title. */
  icon?: ReactNode;
  /**
   * Convenience CTA: when provided, renders a primary `Button` using
   * `actionLabel` (falling back to the preset label) that invokes this handler.
   * Ignored when a custom `action` slot is supplied.
   */
  onAction?: () => void;
  /** Overrides the CTA label used by `onAction`. */
  actionLabel?: string;
  /**
   * Fully custom action slot (e.g. a link or a group of buttons). Takes
   * precedence over the `onAction`/`actionLabel` convenience button.
   */
  action?: ReactNode;
  /** Vertical spacing of the block. Defaults to "md". */
  size?: "sm" | "md" | "lg";
}

/**
 * Reusable empty-state placeholder shown when a listing has no data or a
 * search/filter returns no matches. Presents contextual messaging plus an
 * optional call-to-action that points the user to the next step.
 *
 * The component is presentation-only: it does not decide when a listing is
 * empty. Modules render it in place of their table/list and wire the CTA to the
 * relevant action (e.g. "Buat Campaign", "Tambah Produk", "Reset Filter").
 */
export function EmptyState({
  variant,
  title,
  description,
  icon,
  onAction,
  actionLabel,
  action,
  size = "md",
  className,
  ...rest
}: EmptyStateProps) {
  const preset = variant ? emptyStatePresets[variant] : undefined;

  const variantIcon = useMemo(() => {
    if (!variant) return null;
    const icons: Record<EmptyStateVariant, ReactNode> = {
      "no-campaigns": <Megaphone size={32} />,
      "no-promos": <Tag size={32} />,
      "no-products": <Package size={32} />,
      "no-search-results": <Search size={32} />,
    };
    return icons[variant] ?? null;
  }, [variant]);

  const resolvedTitle = title ?? preset?.title ?? "Tidak ada data";
  const resolvedDescription =
    description === undefined ? preset?.description : description;
  const resolvedActionLabel = actionLabel ?? preset?.actionLabel;

  let renderedAction: ReactNode = null;
  if (action != null) {
    renderedAction = action;
  } else if (onAction && resolvedActionLabel) {
    renderedAction = (
      <Button variant="primary" onClick={onAction}>
        {resolvedActionLabel}
      </Button>
    );
  }

  return (
    <div
      className={cx("pms-empty", `pms-empty--${size}`, className)}
      role="status"
      {...rest}
    >
      {(icon ?? variantIcon) != null && (
        <div className="pms-empty__icon" aria-hidden="true">
          {icon ?? variantIcon}
        </div>
      )}
      <div className="pms-empty__title">{resolvedTitle}</div>
      {resolvedDescription != null && (
        <p className="pms-empty__description">{resolvedDescription}</p>
      )}
      {renderedAction != null && (
        <div className="pms-empty__action">{renderedAction}</div>
      )}
    </div>
  );
}
