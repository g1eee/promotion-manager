import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { cx } from "../utils/cx";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  /** Options to render. */
  options: SelectOption[];
  /** Optional placeholder rendered as a disabled, empty-value first option. */
  placeholder?: string;
  /** Renders the invalid styling and sets aria-invalid. */
  invalid?: boolean;
}

/**
 * Dropdown built on the native `<select>` for accessibility and zero-JS
 * keyboard support. Pair with `Field` for a label, help text, and errors.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      options,
      placeholder,
      invalid = false,
      className,
      defaultValue,
      value,
      "aria-invalid": ariaInvalid,
      ...rest
    },
    ref,
  ) {
    // When a placeholder is used as the empty selection, default to it unless a
    // value/defaultValue is explicitly provided by the caller.
    const resolvedDefault =
      value === undefined && defaultValue === undefined && placeholder
        ? ""
        : defaultValue;

    return (
      <select
        ref={ref}
        value={value}
        defaultValue={resolvedDefault}
        aria-invalid={ariaInvalid ?? (invalid || undefined)}
        className={cx(
          "pms-control",
          "pms-select",
          invalid && "pms-control--invalid",
          className,
        )}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    );
  },
);
