import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cx } from "../utils/cx";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  invalid?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    { invalid = false, className, "aria-invalid": ariaInvalid, ...rest },
    ref,
  ) {
    return (
      <input
        ref={ref}
        type="checkbox"
        aria-invalid={ariaInvalid ?? (invalid || undefined)}
        className={cx(
          "pms-checkbox",
          invalid && "pms-control--invalid",
          className,
        )}
        {...rest}
      />
    );
  },
);
