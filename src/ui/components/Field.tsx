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
  /** The control (Input, Select, textarea, etc.). */
  children: ReactNode;
  className?: string;
}

/**
 * Layout wrapper that pairs a label, an optional required marker, the control,
 * and a help/error message. Reused by form-heavy modules to keep field layout
 * consistent. The control is passed as children so any input type can be used.
 */
export function Field({
  htmlFor,
  label,
  required = false,
  helpText,
  error,
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
