import { Badge } from "./Badge";
import type { BadgeProps, BadgeTone } from "./Badge";

/**
 * Default tone mapping for the status vocabularies used across PMS
 * (promo status, campaign status, execution status, margin health). Keys are
 * compared case-insensitively. Callers can override via the `tone` prop.
 */
const STATUS_TONE: Record<string, BadgeTone> = {
  // Promo / campaign status
  draft: "neutral",
  review: "info",
  approved: "success",
  rejected: "danger",
  active: "success",
  completed: "neutral",
  archived: "neutral",
  inactive: "neutral",
  // Execution status
  "sent to admin": "info",
  "marketplace setup": "warning",
  // Margin health
  healthy: "success",
  warning: "warning",
  risky: "danger",
};

export interface StatusBadgeProps extends Omit<BadgeProps, "children" | "tone"> {
  /** The status text to display (also used to look up the default tone). */
  status: string;
  /** Override the automatically derived tone. */
  tone?: BadgeTone;
}

/**
 * Status pill that derives its color tone from the status text, so the same
 * status renders consistently everywhere it appears.
 */
export function StatusBadge({ status, tone, ...rest }: StatusBadgeProps) {
  const resolvedTone = tone ?? STATUS_TONE[status.trim().toLowerCase()] ?? "neutral";
  return (
    <Badge tone={resolvedTone} {...rest}>
      {status}
    </Badge>
  );
}
