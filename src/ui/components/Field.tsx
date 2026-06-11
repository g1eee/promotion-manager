import type { ReactNode } from "react";
import { cx } from "../utils/cx";

export interface FieldProps {
  /** The id of the control this label/help/error describes. */
  htmlFor?: string;
  /** Field label text. */
  label?: ReactNode;
  /** Marks the field as required (renders an asterisk). */
  required?: boolean;
  /** Helper text shown below the control when there is no error. */
  helpText?: ReactNode;
  /** Error message; when present it replaces the help text. */
  error?: ReactNode;
  /**
   * Render the label as a floating label that sits over the control and lifts
   * on focus/fill. The control must use a placeholder of `" "` for the CSS
   * `:placeholder-shown` lift to work.
   */
  floating?: boolean;
  /** The control (Input, Select, textarea, etc.). */
  children: ReactNode;
  className?: string;
}

/**
 * Layout wrapper that pairs a label, an optional required marker, the control,
 * and a help/error message. Reused by form-heavy modules to keep field layout
 * consistent. The control is passed as children so any input type can be used.
 *
 * With `floating`, the label overlays the control and animates upward when the
 * field is focused or filled (Material-style). Pair it with an Input that has
 * `placeholder=" "` so the empty state is detected via `:placeholder-shown`.
 */
export function Field({
  htmlFor,
  label,
  required = false,
  helpText,
  error,
  floating = false,
  children,
  className,
}: FieldProps) {
  const describedById = htmlFor
    ? error
      ? `${htmlFor}-error`
      : helpText
        ? `${htmlFor}-help`
        : undefined
    : undefined;

  if (floating) {
    return (
      <div className={cx("pms-field", "pms-field--floating", className)}>
        <div className="pms-field__floating-wrap">
          {children}
          {label != null && (
            <label className="pms-field__floating-label" htmlFor={htmlFor}>
              {label}
              {required && (
                <span className="pms-field__required" aria-hidden="true">
                  *
                </span>
              )}
            </label>
          )}
        </div>
        {error ? (
          <span id={describedById} className="pms-field__error" role="alert">
            {error}
          </span>
        ) : (
          helpText != null && (
            <span id={describedById} className="pms-field__help">
              {helpText}
            </span>
          )
        )}
      </div>
    );
  }

  return (
    <div className={cx("pms-field", className)}>
      {label != null && (
        <label className="pms-field__label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="pms-field__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <span id={describedById} className="pms-field__error" role="alert">
          {error}
        </span>
      ) : (
        helpText != null && (
          <span id={describedById} className="pms-field__help">
            {helpText}
          </span>
        )
      )}
    </div>
  );
}
