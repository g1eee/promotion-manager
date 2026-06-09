import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "../utils/cx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Renders the invalid styling and sets aria-invalid. */
  invalid?: boolean;
}

/**
 * Single-line text input. Pair with `Field` for a label, help text, and errors.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, type, "aria-invalid": ariaInvalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type ?? "text"}
      aria-invalid={ariaInvalid ?? (invalid || undefined)}
      className={cx("pms-control", invalid && "pms-control--invalid", className)}
      {...rest}
    />
  );
});

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Renders the invalid styling and sets aria-invalid. */
  invalid?: boolean;
}

/**
 * Multi-line text input. Pair with `Field` for a label, help text, and errors.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { invalid = false, className, "aria-invalid": ariaInvalid, ...rest },
    ref,
  ) {
    return (
      <textarea
        ref={ref}
        aria-invalid={ariaInvalid ?? (invalid || undefined)}
        className={cx(
          "pms-control",
          invalid && "pms-control--invalid",
          className,
        )}
        {...rest}
      />
    );
  },
);
