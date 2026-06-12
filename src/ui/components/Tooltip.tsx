import type { ReactNode } from "react";

export interface TooltipProps {
  /** Text to show on hover. */
  label: string;
  children: ReactNode;
}

/**
 * Hover tooltip wrapping any element. Renders the tooltip text via
 * `data-tooltip` attribute styled in CSS, keeping the DOM lean.
 * For richer content, use a proper popover.
 */
export function Tooltip({ label, children }: TooltipProps) {
  return (
    <span className="pms-tooltip" data-tooltip={label}>
      {children}
    </span>
  );
}
