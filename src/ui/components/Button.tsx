import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style of the button. Defaults to "primary". */
  variant?: ButtonVariant;
  /** Size of the button. Defaults to "md". */
  size?: ButtonSize;
  /** Stretch to fill the available width. */
  block?: boolean;
  /** Optional element rendered before the label (e.g. an icon). */
  leadingIcon?: ReactNode;
  /** Optional element rendered after the label (e.g. an icon). */
  trailingIcon?: ReactNode;
}

/**
 * Primary interactive control used across every module. Renders a native
 * `<button>` so it stays accessible and form-aware by default.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      block = false,
      leadingIcon,
      trailingIcon,
      className,
      type,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cx(
          "pms-btn",
          `pms-btn--${variant}`,
          `pms-btn--${size}`,
          block && "pms-btn--block",
          className,
        )}
        {...rest}
      >
        {leadingIcon}
        {children}
        {trailingIcon}
      </button>
    );
  },
);
