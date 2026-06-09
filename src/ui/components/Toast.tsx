"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { cx } from "../utils/cx";

export type ToastTone = "info" | "success" | "warning" | "danger";

export interface ToastOptions {
  /** Optional bold title line. */
  title?: string;
  /** Main message body. */
  message: ReactNode;
  /** Visual tone. Defaults to "info". */
  tone?: ToastTone;
  /** Auto-dismiss delay in ms. Defaults to 5000. Use 0 to disable auto-dismiss. */
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, "tone">> {
  id: string;
  title?: string;
  message: ReactNode;
  durationMs: number;
}

export interface ToastContextValue {
  /** Show a toast; returns its id. */
  show: (options: ToastOptions) => string;
  /** Convenience helper for success toasts. */
  success: (message: ReactNode, title?: string) => string;
  /** Convenience helper for error/danger toasts. */
  error: (message: ReactNode, title?: string) => string;
  /** Dismiss a toast by id. */
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;
function nextToastId(): string {
  toastCounter += 1;
  return `toast-${toastCounter}`;
}

export interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Provides the toast API to descendants and renders the toast region. Wrap the
 * app (or a subtree) once, then call `useToast()` anywhere below it.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = nextToastId();
      const item: ToastItem = {
        id,
        title: options.title,
        message: options.message,
        tone: options.tone ?? "info",
        durationMs: options.durationMs ?? 5000,
      };
      setToasts((current) => [...current, item]);

      if (item.durationMs > 0) {
        const timer = setTimeout(() => dismiss(id), item.durationMs);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  const success = useCallback(
    (message: ReactNode, title?: string) =>
      show({ message, title, tone: "success" }),
    [show],
  );

  const error = useCallback(
    (message: ReactNode, title?: string) =>
      show({ message, title, tone: "danger" }),
    [show],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ show, success, error, dismiss }),
    [show, success, error, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pms-toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cx("pms-toast", `pms-toast--${toast.tone}`)}
          >
            <div className="pms-toast__content">
              {toast.title && (
                <div className="pms-toast__title">{toast.title}</div>
              )}
              <div className="pms-toast__message">{toast.message}</div>
            </div>
            <button
              type="button"
              className="pms-toast__close"
              aria-label="Tutup notifikasi"
              onClick={() => dismiss(toast.id)}
            >
              {"\u00d7"}
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Access the toast API. Must be used within a `ToastProvider`.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a <ToastProvider>.");
  }
  return context;
}
