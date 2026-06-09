"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "../utils/cx";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Called when the user requests to close (overlay click, Escape, close button). */
  onClose: () => void;
  /** Modal title rendered in the header. */
  title?: ReactNode;
  /** Width preset. Defaults to "md". */
  size?: ModalSize;
  /** Footer content, typically action buttons. */
  footer?: ReactNode;
  /** Hide the header close (×) button. */
  hideCloseButton?: boolean;
  /** Disable closing when clicking the overlay backdrop. */
  disableOverlayClose?: boolean;
  children: ReactNode;
}

/**
 * Accessible modal dialog rendered in a portal. Closes on Escape and overlay
 * click (unless disabled), traps initial focus, and locks body scroll while open.
 */
export function Modal({
  open,
  onClose,
  title,
  size = "md",
  footer,
  hideCloseButton = false,
  disableOverlayClose = false,
  children,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog for keyboard users.
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const handleOverlayClick = useCallback(() => {
    if (!disableOverlayClose) {
      onClose();
    }
  }, [disableOverlayClose, onClose]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="pms-modal__overlay" onMouseDown={handleOverlayClick}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title != null ? titleId : undefined}
        tabIndex={-1}
        className={cx("pms-modal", `pms-modal--${size}`)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {(title != null || !hideCloseButton) && (
          <div className="pms-modal__header">
            {title != null ? (
              <h2 id={titleId} className="pms-modal__title">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {!hideCloseButton && (
              <button
                type="button"
                className="pms-modal__close"
                aria-label="Tutup"
                onClick={onClose}
              >
                {"\u00d7"}
              </button>
            )}
          </div>
        )}
        <div className="pms-modal__body">{children}</div>
        {footer != null && <div className="pms-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
